// 스도쿠 (9×9 클래식) — 랭크 밖 별관
// 실수 3회 제한, 메모, 되돌리기, 힌트 3회, 하이라이트. 중단해도 진행이 남는다.
// 숫자를 넣으면 같은 줄·박스의 메모가 저절로 정리되고, 힌트는 왜 그 칸인지 말해준다.
// 오늘의 스도쿠(ctx.sudokuDay)는 날짜 시드라 모두가 같은 판을 푼다.
//
// LP·부식·리그와 무관하다. 한 판이 5~20분이라 "60초 랭크전"의 경제와 맞지 않아
// 따로 뺐다. 대신 난이도 해금과 난이도별 최단 기록이 자체 진행감을 만든다.
// 난이도는 ctx.sudokuLevel(이름)로 받는다 — 고르는 건 별관 화면의 몫.
import { SPEC9, generate, boxOf, conflicts, findSingles } from '../sudoku-core.js';
import { sfx } from '../audio.js';
import { seededRandom, seedFor } from '../daily.js';

const N = 9;
const MAX_MISTAKES = 3;
const MAX_HINTS = 3;

// 단서가 적을수록 어렵다. 앞에서부터 하나씩 깨야 다음이 열린다.
export const SUDOKU_LEVELS = [
  { name: '쉬움',   clues: 42, expect: 300 },
  { name: '보통',   clues: 36, expect: 420 },
  { name: '어려움', clues: 32, expect: 540 },
  { name: '전문가', clues: 29, expect: 660 },
  { name: '마스터', clues: 27, expect: 780 },
  { name: '극한',   clues: 25, expect: 900 },
];

// 오늘의 스도쿠 — 해금과 무관하게 누구나. 난이도는 "보통"과 같다.
export const SUDOKU_DAILY = { name: '오늘의 스도쿠', clues: 36, expect: 420, daily: true };

// 숫자 뒤 조사 (1이, 2가, 3이 …) — 숫자는 읽는 소리로 받침을 정한다
const GA = ['', '이', '가', '이', '가', '가', '이', '이', '이', '가'];

export const sudokuGame = {
  id: 'sudoku',
  annex: true,   // 랭크 밖. GAMES 배열에 넣지 않는다.
  name: '스도쿠',
  icon: '🔢',
  desc: '9×9 클래식 · 이어하기 지원',
  run(ctx) {
    const day = ctx.sudokuDay || null;   // 'YYYY-M-D'면 오늘의 스도쿠
    const level = day ? SUDOKU_DAILY
      : (SUDOKU_LEVELS.find(l => l.name === ctx.sudokuLevel) || SUDOKU_LEVELS[0]);
    const store = ctx.state.sudoku;

    // 저장된 판이 같은 난이도(오늘의 스도쿠면 같은 날)면 이어서, 아니면 새 판
    let given, solution, grid, notes, mistakes, hintsLeft, elapsedBefore;
    if (store && store.level === level.name && store.grid && !store.done
      && (!day || store.day === day)) {
      given = Int8Array.from(store.given);
      solution = Int8Array.from(store.solution);
      grid = Int8Array.from(store.grid);
      notes = store.notes.map(a => new Set(a));
      mistakes = store.mistakes;
      hintsLeft = store.hints;
      elapsedBefore = store.elapsed || 0;
    } else {
      const g = generate(SPEC9, level.clues,
        day ? seededRandom(seedFor(day, 'sudoku')) : Math.random);
      given = Int8Array.from(g.puzzle);
      solution = g.solution;
      grid = Int8Array.from(g.puzzle);
      notes = [...Array(81)].map(() => new Set());
      mistakes = 0; hintsLeft = MAX_HINTS; elapsedBefore = 0;
    }

    let sel = -1, noteMode = false, finished = false;
    const undoStack = [];

    ctx.setTitle(`🔢 스도쿠 · ${level.name}`);
    ctx.body.innerHTML = `
      <div class="sd-status">
        <span>실수 <b id="sd-mist">${mistakes}</b>/${MAX_MISTAKES}</span>
        <span id="sd-level">${level.name}</span>
        <span>남은 칸 <b id="sd-left">0</b></span>
      </div>
      <div class="sd-grid" id="sd-grid"></div>
      <div class="sd-tools">
        <button class="sd-tool" id="sd-undo"><span>↺</span><small>되돌리기</small></button>
        <button class="sd-tool" id="sd-erase"><span>⌫</span><small>지우개</small></button>
        <button class="sd-tool" id="sd-note"><span>✎</span><small>메모</small><i class="sd-badge" id="sd-note-badge">OFF</i></button>
        <button class="sd-tool" id="sd-hint"><span>💡</span><small>힌트</small><i class="sd-badge on" id="sd-hint-badge">${hintsLeft}</i></button>
      </div>
      <div class="sd-msg" id="sd-msg"></div>
      <div class="sd-pad" id="sd-pad"></div>
    `;

    const $grid = ctx.body.querySelector('#sd-grid');
    const $pad = ctx.body.querySelector('#sd-pad');
    const $mist = ctx.body.querySelector('#sd-mist');
    const $left = ctx.body.querySelector('#sd-left');
    const $noteBadge = ctx.body.querySelector('#sd-note-badge');
    const $hintBadge = ctx.body.querySelector('#sd-hint-badge');
    const $msg = ctx.body.querySelector('#sd-msg');
    let msgTimer = null;
    function say(text, ms = 4200) {
      $msg.textContent = text;
      $msg.classList.add('on');
      ctx.cancel(msgTimer);
      msgTimer = ctx.delay(() => $msg.classList.remove('on'), ms);
    }

    // ---------- 판 그리기 ----------
    const cells = [];
    for (let i = 0; i < 81; i++) {
      const r = (i / N) | 0, c = i % N;
      const el = document.createElement('div');
      el.className = 'sd-cell';
      if (c % 3 === 2 && c !== 8) el.classList.add('br');
      if (r % 3 === 2 && r !== 8) el.classList.add('bb');
      el.dataset.i = i;
      $grid.appendChild(el);
      cells.push(el);
    }

    for (let v = 1; v <= 9; v++) {
      const b = document.createElement('button');
      b.className = 'sd-key';
      b.dataset.v = v;
      b.innerHTML = `${v}<i class="sd-key-left"></i>`;
      $pad.appendChild(b);
    }

    function countLeft() { let n = 0; for (let i = 0; i < 81; i++) if (!grid[i]) n++; return n; }
    function countOf(v) { let n = 0; for (let i = 0; i < 81; i++) if (grid[i] === v) n++; return n; }

    function render() {
      const selV = sel >= 0 ? grid[sel] : 0;
      const sr = sel >= 0 ? (sel / N) | 0 : -1;
      const sc = sel >= 0 ? sel % N : -1;
      const sb = sel >= 0 ? boxOf(SPEC9, sr, sc) : -1;

      for (let i = 0; i < 81; i++) {
        const el = cells[i];
        const r = (i / N) | 0, c = i % N;
        const v = grid[i];
        el.className = 'sd-cell'
          + (c % 3 === 2 && c !== 8 ? ' br' : '')
          + (r % 3 === 2 && r !== 8 ? ' bb' : '');
        if (given[i]) el.classList.add('given');
        if (i === sel) el.classList.add('sel');
        else if (sel >= 0 && (r === sr || c === sc || boxOf(SPEC9, r, c) === sb)) el.classList.add('peer');
        if (v && selV && v === selV) el.classList.add('same');
        if (v && !given[i] && v !== solution[i]) el.classList.add('bad');

        if (v) {
          el.textContent = v;
        } else if (notes[i].size) {
          el.innerHTML = '<div class="sd-notes">' +
            [...Array(9)].map((_, k) => `<span>${notes[i].has(k + 1) ? k + 1 : ''}</span>`).join('') +
            '</div>';
        } else {
          el.textContent = '';
        }
      }

      // 숫자패드: 다 쓴 숫자는 흐리게 + 남은 개수 표시
      for (const b of $pad.children) {
        const v = Number(b.dataset.v);
        const remain = 9 - countOf(v);
        b.classList.toggle('done', remain <= 0);
        b.querySelector('.sd-key-left').textContent = remain > 0 ? remain : '';
      }
      $left.textContent = countLeft();
      $mist.textContent = mistakes;
      $hintBadge.textContent = hintsLeft;
      $hintBadge.classList.toggle('on', hintsLeft > 0);
    }

    // ---------- 저장 ----------
    function save(done = false) {
      ctx.state.sudoku = {
        level: level.name,
        given: [...given], solution: [...solution], grid: [...grid],
        notes: notes.map(s => [...s]),
        mistakes, hints: hintsLeft, elapsed: elapsedBefore + readElapsed(), done,
        day,
      };
      ctx.persist();
    }

    // ---------- 같은 줄·박스 ----------
    const peersOf = idx => {
      const r = (idx / N) | 0, c = idx % N, b = boxOf(SPEC9, r, c);
      const out = [];
      for (let i = 0; i < 81; i++) {
        if (i === idx) continue;
        const rr = (i / N) | 0, cc = i % N;
        if (rr === r || cc === c || boxOf(SPEC9, rr, cc) === b) out.push(i);
      }
      return out;
    };

    // 맞는 숫자를 놓으면 같은 행·열·박스 메모에서 그 숫자를 지운다.
    // 손으로 지우는 건 규칙 적용이 아니라 잡일이다. 되돌리기로 되살릴 수 있게 원래 메모를 돌려준다.
    function clearPeerNotes(idx, v) {
      const changed = [];
      for (const i of peersOf(idx)) {
        if (!notes[i].has(v)) continue;
        changed.push({ i, prev: new Set(notes[i]) });
        notes[i].delete(v);
      }
      return changed;
    }

    // 방금 채운 칸 때문에 행·열·박스가 완성됐으면 그 줄을 잠깐 반짝인다
    function celebrateUnits(idx) {
      const r = (idx / N) | 0, c = idx % N, b = boxOf(SPEC9, r, c);
      const units = [[], [], []];
      for (let i = 0; i < 81; i++) {
        const rr = (i / N) | 0, cc = i % N;
        if (rr === r) units[0].push(i);
        if (cc === c) units[1].push(i);
        if (boxOf(SPEC9, rr, cc) === b) units[2].push(i);
      }
      const lit = new Set();
      for (const u of units) if (u.every(i => grid[i] === solution[i])) u.forEach(i => lit.add(i));
      if (!lit.size) return;
      for (const i of lit) cells[i].classList.add('pop');
      ctx.delay(() => { for (const i of lit) cells[i].classList.remove('pop'); }, 450);
    }

    // ---------- 입력 ----------
    $grid.addEventListener('pointerdown', e => {
      const t = e.target.closest('.sd-cell');
      if (!t) return;
      e.preventDefault();
      sel = Number(t.dataset.i);
      render();
    });

    // 맞게 채운 칸은 주어진 칸처럼 잠근다. 넣는 순간 맞는지 알려주는 판이라 그 칸은 이미
    // 확정이다 — 예전에는 그 칸을 고른 채 숫자판을 스치면 실수 1회에 맞던 숫자까지 지워졌다.
    const settled = i => grid[i] !== 0 && grid[i] === solution[i];

    function place(v) {
      if (finished || sel < 0 || given[sel] || settled(sel)) return;
      if (noteMode) {
        if (grid[sel]) return;
        undoStack.push({ i: sel, prev: 0, prevNotes: new Set(notes[sel]) });
        if (notes[sel].has(v)) notes[sel].delete(v); else notes[sel].add(v);
        render(); save();
        return;
      }
      const u = { i: sel, prev: grid[sel], prevNotes: new Set(notes[sel]), peers: [] };
      undoStack.push(u);
      grid[sel] = v;
      notes[sel].clear();

      if (v !== solution[sel]) {
        mistakes++;
        sfx.bad();
        const bad = conflicts(SPEC9, grid, sel, v);
        for (const b of bad) cells[b].classList.add('clash');
        ctx.delay(() => bad.forEach(b => cells[b].classList.remove('clash')), 600);
        render(); save();
        if (mistakes >= MAX_MISTAKES) return end(false);
        return;
      }

      sfx.good();
      u.peers = clearPeerNotes(sel, v);
      render(); save();
      celebrateUnits(sel);
      if (isSolved()) return end(true);
    }

    // 빈 칸 0개만으로는 부족하다 — 오답이 남아 있으면 완성이 아니다
    function isSolved() {
      for (let i = 0; i < 81; i++) if (grid[i] !== solution[i]) return false;
      return true;
    }

    $pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('.sd-key');
      if (!b) return;
      e.preventDefault();
      place(Number(b.dataset.v));
    });

    ctx.body.querySelector('#sd-undo').addEventListener('pointerdown', e => {
      e.preventDefault();
      const u = undoStack.pop();
      if (!u) return;
      grid[u.i] = u.prev;
      notes[u.i] = u.prevNotes;
      for (const p of u.peers || []) notes[p.i] = p.prev;   // 자동으로 지운 메모도 되살린다
      sel = u.i;
      render(); save();
    });

    ctx.body.querySelector('#sd-erase').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (sel < 0 || given[sel] || settled(sel)) return;
      undoStack.push({ i: sel, prev: grid[sel], prevNotes: new Set(notes[sel]) });
      grid[sel] = 0;
      notes[sel].clear();
      render(); save();
    });

    ctx.body.querySelector('#sd-note').addEventListener('pointerdown', e => {
      e.preventDefault();
      noteMode = !noteMode;
      $noteBadge.textContent = noteMode ? 'ON' : 'OFF';
      $noteBadge.classList.toggle('on', noteMode);
    });

    ctx.body.querySelector('#sd-hint').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (finished || hintsLeft <= 0) return;
      // 지금 논리적으로 확정되는 칸을 하나 열어준다 (아무 칸이나 열지 않는다).
      // 사용자의 오답이 섞인 판에서는 싱글이 오답을 가리킬 수 있으니 정답과 대조한다.
      const singles = findSingles(SPEC9, grid);
      let target = singles.find(s => !grid[s.idx] && s.val === solution[s.idx]);
      if (!target) {
        const empty = [];
        for (let i = 0; i < 81; i++) if (!grid[i]) empty.push(i);
        if (!empty.length) return;
        target = { idx: empty[Math.floor(Math.random() * empty.length)], val: 0, why: null };
        target.val = solution[target.idx];
      }
      hintsLeft--;
      const u = { i: target.idx, prev: grid[target.idx], prevNotes: new Set(notes[target.idx]), peers: [] };
      undoStack.push(u);
      grid[target.idx] = target.val;
      notes[target.idx].clear();
      u.peers = clearPeerNotes(target.idx, target.val);
      sel = target.idx;
      sfx.tick();
      say(hintReason(target));
      render(); save();
      cells[target.idx].classList.add('hinted');
      ctx.delay(() => cells[target.idx].classList.remove('hinted'), 900);
      celebrateUnits(target.idx);
      if (isSolved()) end(true);
    });

    // 힌트는 칸을 채우는 게 아니라 "어떻게 찾는지"를 가르쳐야 한다
    function hintReason(t) {
      const v = t.val, ga = GA[v];
      if (!t.why) {
        let wrong = false;
        for (let i = 0; i < 81; i++) if (grid[i] && !given[i] && grid[i] !== solution[i]) wrong = true;
        return wrong
          ? '틀린 숫자가 남아 있어 논리로 짚을 칸이 없어요. 붉은 숫자부터 지워 보세요'
          : '지금은 한 번에 확정되는 칸이 없어서 정답 하나를 열었어요';
      }
      if (t.why.kind === 'naked') return `같은 행·열·박스에 다른 숫자가 모두 있어서 ${v}${ga} 남는 칸이에요`;
      const where = t.why.unit === 'row' ? `${t.why.no}행에서`
        : t.why.unit === 'col' ? `${t.why.no}열에서` : '이 박스에서';
      return `${where} ${v}${ga} 들어갈 수 있는 칸은 여기뿐이에요`;
    }

    // ---------- 시간 / 종료 ----------
    let readElapsed = () => 0;
    const stop = ctx.stopwatch(null, elapsedBefore);   // 이어하는 판은 지난 시간부터 센다
    readElapsed = stop;

    ctx.onAbort = () => save(false);

    function end(solved) {
      if (finished) return;
      finished = true;
      const sec = elapsedBefore + readElapsed();
      ctx.state.sudoku = null;   // 판은 끝났으니 이어하기 제거
      ctx.persist();
      // 별관은 LP가 없다. 결과는 시간·실수·해금으로만 말한다.
      ctx.finish({
        annex: true,
        solved,
        level: level.name,
        day,
        sec,
        mistakes,
        hints: MAX_HINTS - hintsLeft,
        expect: level.expect,
      });
    }

    render();
    if (elapsedBefore > 0) {
      ctx.setTitle(`🔢 스도쿠 · ${level.name} (이어하기)`);
    }
  },
};
