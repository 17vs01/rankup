// 스도쿠 (9×9 클래식)
// 실수 3회 제한, 메모, 되돌리기, 힌트 3회, 하이라이트. 중단해도 진행이 남는다.
import { SPEC9, generate, boxOf, conflicts, findSingles } from '../sudoku-core.js';
import { sfx } from '../audio.js';

const N = 9;
const MAX_MISTAKES = 3;
const MAX_HINTS = 3;

// 랭크가 오르면 단서가 줄어든다
const LEVELS = [
  { name: '쉬움',   clues: 42, min: 0 },
  { name: '보통',   clues: 36, min: 1100 },
  { name: '어려움', clues: 32, min: 1300 },
  { name: '전문가', clues: 29, min: 1550 },
  { name: '마스터', clues: 27, min: 1800 },
  { name: '극한',   clues: 25, min: 2100 },
];

function levelFor(rating) {
  let lv = LEVELS[0];
  for (const l of LEVELS) if (rating >= l.min) lv = l;
  return lv;
}

// 기대 소요시간(초). 이보다 빠르면 랭크가 오른다.
const EXPECTED_SEC = { 쉬움: 300, 보통: 420, 어려움: 540, 전문가: 660, 마스터: 780, 극한: 900 };

export const sudokuGame = {
  id: 'sudoku',
  long: true,   // 한 판이 5~20분. 오늘의 훈련·첫 판에서는 뒤로 미룬다.
  name: '스도쿠',
  icon: '🔢',
  desc: '9×9 클래식 · 이어하기 지원',
  run(ctx) {
    const level = levelFor(ctx.rating);
    const store = ctx.state.sudoku;

    // 저장된 판이 같은 난이도면 이어서, 아니면 새 판
    let given, solution, grid, notes, mistakes, hintsLeft, elapsedBefore;
    if (store && store.level === level.name && store.grid && !store.done) {
      given = Int8Array.from(store.given);
      solution = Int8Array.from(store.solution);
      grid = Int8Array.from(store.grid);
      notes = store.notes.map(a => new Set(a));
      mistakes = store.mistakes;
      hintsLeft = store.hints;
      elapsedBefore = store.elapsed || 0;
    } else {
      const g = generate(SPEC9, level.clues);
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
      <div class="sd-pad" id="sd-pad"></div>
    `;

    const $grid = ctx.body.querySelector('#sd-grid');
    const $pad = ctx.body.querySelector('#sd-pad');
    const $mist = ctx.body.querySelector('#sd-mist');
    const $left = ctx.body.querySelector('#sd-left');
    const $noteBadge = ctx.body.querySelector('#sd-note-badge');
    const $hintBadge = ctx.body.querySelector('#sd-hint-badge');

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
      };
      ctx.persist();
    }

    // ---------- 입력 ----------
    $grid.addEventListener('pointerdown', e => {
      const t = e.target.closest('.sd-cell');
      if (!t) return;
      e.preventDefault();
      sel = Number(t.dataset.i);
      render();
    });

    function place(v) {
      if (finished || sel < 0 || given[sel]) return;
      if (noteMode) {
        if (grid[sel]) return;
        undoStack.push({ i: sel, prev: 0, prevNotes: new Set(notes[sel]) });
        if (notes[sel].has(v)) notes[sel].delete(v); else notes[sel].add(v);
        render(); save();
        return;
      }
      undoStack.push({ i: sel, prev: grid[sel], prevNotes: new Set(notes[sel]) });
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
      // 같은 숫자를 다 채웠으면 잠깐 강조
      render(); save();
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
      sel = u.i;
      render(); save();
    });

    ctx.body.querySelector('#sd-erase').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (sel < 0 || given[sel]) return;
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
        target = { idx: empty[Math.floor(Math.random() * empty.length)], val: 0 };
        target.val = solution[target.idx];
      }
      hintsLeft--;
      undoStack.push({ i: target.idx, prev: grid[target.idx], prevNotes: new Set(notes[target.idx]) });
      grid[target.idx] = target.val;
      notes[target.idx].clear();
      sel = target.idx;
      sfx.tick();
      cells[target.idx].classList.add('hinted');
      ctx.delay(() => cells[target.idx].classList.remove('hinted'), 900);
      render(); save();
      if (isSolved()) end(true);
    });

    // ---------- 시간 / 종료 ----------
    let readElapsed = () => 0;
    const stop = ctx.stopwatch();
    readElapsed = stop;

    ctx.onAbort = () => save(false);

    function end(solved) {
      if (finished) return;
      finished = true;
      const sec = elapsedBefore + readElapsed();
      const expect = EXPECTED_SEC[level.name];
      let perf;
      if (solved) {
        // 기대 시간보다 빠를수록 높게. 실수는 감점.
        perf = (expect / Math.max(30, sec)) * (1 - mistakes * 0.15);
        perf = Math.max(0.5, Math.min(2.0, perf));
      } else {
        perf = 0.35;   // 실수 3회 실패
      }
      ctx.state.sudoku = null;   // 판은 끝났으니 이어하기 제거
      ctx.persist();
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      ctx.finish({
        score: solved ? Math.max(1, Math.round(expect / Math.max(30, sec) * 100)) : 0,
        perf,
        detail: solved
          ? `${level.name} 완성 · ${mm}:${ss} · 실수 ${mistakes}`
          : `${level.name} 실패 · 실수 ${MAX_MISTAKES}회`,
        // 난이도별 최단 완주 기록 (쉬움 기록과 극한 기록은 다른 기록)
        time: solved ? { key: 'time_' + level.name, value: sec, unit: 'sec', label: level.name + ' 완주' } : null,
      });
    }

    render();
    if (elapsedBefore > 0) {
      ctx.setTitle(`🔢 스도쿠 · ${level.name} (이어하기)`);
    }
  },
};
