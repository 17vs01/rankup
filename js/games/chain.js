// 연쇄 스도쿠 — 도미노 한 방
//
// 논리적으로 확정 가능한 칸(싱글)을 전부 채워둔 "막힌 판"에서 시작한다.
// 여기서부터는 고급 기법 없이는 한 칸도 못 채운다. 그런데 그 한 칸을 뚫으면
// 나머지가 전부 연쇄로 무너진다 — 측정해보니 어떤 난이도에서도 최적해는 항상 1수였다.
// 그래서 판 하나를 오래 붙드는 대신, 막힌 판을 여러 개 내고 매번 "그 한 칸"을 찾게 한다.
import { SPEC9, generate, boxOf, findSingles, candidates } from '../sudoku-core.js';
import { sfx } from '../audio.js';

const N = 9;
const ROUNDS = 4;
const MAX_MISTAKES = 3;
const EXPECTED_CLEAR = 2.6;

function runSingles(grid) {
  let count = 0;
  for (;;) {
    const s = findSingles(SPEC9, grid);
    if (!s.length) break;
    for (const { idx, val } of s) { grid[idx] = val; count++; }
  }
  return count;
}

// 싱글이 소진된 판 (시작하자마자 저절로 풀리면 게임이 아니다)
function buildStalled(clues) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { puzzle, solution } = generate(SPEC9, clues);
    const g = Int8Array.from(puzzle);
    runSingles(g);
    let empty = 0;
    for (let i = 0; i < 81; i++) if (!g[i]) empty++;
    if (empty >= 15) return { start: g, solution, empty };
  }
  const { puzzle, solution } = generate(SPEC9, clues);
  const g = Int8Array.from(puzzle);
  runSingles(g);
  let empty = 0;
  for (let i = 0; i < 81; i++) if (!g[i]) empty++;
  return { start: g, solution, empty };
}

// 낮은 랭크용: 싱글을 미리 채우지 않은 판. 쉬운 한 칸에서 큰 연쇄가 터진다.
function buildEasy() {
  const { puzzle, solution } = generate(SPEC9, 34);
  let empty = 0;
  for (let i = 0; i < 81; i++) if (!puzzle[i]) empty++;
  return { start: Int8Array.from(puzzle), solution, empty };
}

export const chainGame = {
  id: 'chain',
  name: '연쇄 스도쿠',
  icon: '💥',
  desc: '막힌 판을 뚫는 한 칸 찾기',
  run(ctx) {
    // 난이도 3단계.
    // 막힌 판은 싱글(단독후보·숨은단독)이 이미 소진돼 있어서 포인팅 페어 같은
    // 고급 기법이 필요하다. 브론즈에게 그걸 요구하면 한 칸도 못 뚫는다.
    // 그래서 낮은 랭크는 싱글이 살아 있는 판을 준다 — 찾기 쉽고 연쇄는 그대로 크다.
    const tier = ctx.rating >= 1600 ? 'hard' : ctx.rating >= 1200 ? 'mid' : 'easy';
    const clues = tier === 'hard' ? 24 : 26;
    const showCands = tier !== 'hard';
    const HINT_TEXT = {
      easy: '후보가 하나뿐인 칸을 찾으세요',
      mid: '싱글은 이미 없습니다 — 후보 2개짜리 칸을 노리세요',
      hard: '이 판을 뚫는 한 칸을 찾으세요',
    };

    let round = 0, cleared = 0, mistakes = 0, totalChain = 0;
    let grid, solution, fixed, cands, sel = -1, busy = false, finished = false, roundDone = false;
    const cells = [];

    ctx.setTitle('💥 연쇄 스도쿠');
    ctx.body.innerHTML = `
      <div class="sd-status">
        <span>실수 <b id="ch2-mist">0</b>/${MAX_MISTAKES}</span>
        <span id="ch2-round">1 / ${ROUNDS}</span>
        <span>연쇄 <b class="hot" id="ch2-auto">0</b></span>
      </div>
      <div class="ch2-banner" id="ch2-banner"></div>
      <div class="sd-grid" id="ch2-grid"></div>
      <div class="sd-pad" id="ch2-pad"></div>
      <button class="btn-secondary ch2-skip" id="ch2-skip">이 판 건너뛰기</button>
    `;
    const $grid = ctx.body.querySelector('#ch2-grid');
    const $pad = ctx.body.querySelector('#ch2-pad');
    const $mist = ctx.body.querySelector('#ch2-mist');
    const $round = ctx.body.querySelector('#ch2-round');
    const $auto = ctx.body.querySelector('#ch2-auto');
    const $banner = ctx.body.querySelector('#ch2-banner');

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

    function render() {
      const selV = sel >= 0 ? grid[sel] : 0;
      const sr = sel >= 0 ? (sel / N) | 0 : -1, sc = sel >= 0 ? sel % N : -1;
      const sb = sel >= 0 ? boxOf(SPEC9, sr, sc) : -1;
      for (let i = 0; i < 81; i++) {
        const el = cells[i];
        const r = (i / N) | 0, c = i % N;
        const keep = el.classList.contains('pop');
        el.className = 'sd-cell'
          + (c % 3 === 2 && c !== 8 ? ' br' : '')
          + (r % 3 === 2 && r !== 8 ? ' bb' : '')
          + (keep ? ' pop' : '');
        if (fixed[i]) el.classList.add('given');
        else if (grid[i]) el.classList.add('mine');
        if (i === sel) el.classList.add('sel');
        else if (sel >= 0 && (r === sr || c === sc || boxOf(SPEC9, r, c) === sb)) el.classList.add('peer');
        if (grid[i] && selV && grid[i] === selV) el.classList.add('same');

        if (grid[i]) {
          el.textContent = grid[i];
        } else if (showCands && cands[i]) {
          el.innerHTML = '<div class="sd-notes">' +
            [...Array(9)].map((_, k) => `<span>${cands[i].includes(k + 1) ? k + 1 : ''}</span>`).join('') +
            '</div>';
        } else {
          el.textContent = '';
        }
      }
      for (const b of $pad.children) {
        const v = Number(b.dataset.v);
        let used = 0;
        for (let i = 0; i < 81; i++) if (grid[i] === v) used++;
        b.classList.toggle('done', used >= 9);
        b.querySelector('.sd-key-left').textContent = used < 9 ? 9 - used : '';
      }
      $mist.textContent = mistakes;
      $auto.textContent = totalChain;
    }

    function newRound() {
      round++;
      if (round > ROUNDS) return end();
      const b = tier === 'easy' ? buildEasy() : buildStalled(clues);
      grid = Int8Array.from(b.start);
      fixed = Int8Array.from(b.start);
      solution = b.solution;
      cands = candidates(SPEC9, grid);
      sel = -1; roundDone = false; busy = false;
      $round.textContent = `${round} / ${ROUNDS}`;
      $banner.textContent = HINT_TEXT[tier];
      $banner.className = 'ch2-banner';
      render();
    }

    $grid.addEventListener('pointerdown', e => {
      if (busy || roundDone) return;
      const t = e.target.closest('.sd-cell');
      if (!t) return;
      e.preventDefault();
      const i = Number(t.dataset.i);
      if (grid[i]) return;
      sel = i;
      render();
    });

    // 도미노: 확정되는 칸을 하나씩 터뜨린다
    function cascade() {
      busy = true;
      let burst = 0;
      const step = () => {
        const next = findSingles(SPEC9, grid).filter(s => !grid[s.idx]);
        if (!next.length) {
          busy = false; roundDone = true;
          totalChain += burst;
          cleared++;
          $banner.textContent = `연쇄 ${burst}칸 폭발! (${cleared}/${round} 클리어)`;
          $banner.className = 'ch2-banner boom';
          cands = candidates(SPEC9, grid);
          render();
          ctx.delay(newRound, 1600);
          return;
        }
        const s = next[0];
        grid[s.idx] = s.val;
        burst++;
        cells[s.idx].classList.add('pop');
        sfx.tick();
        cands = candidates(SPEC9, grid);
        render();
        ctx.delay(() => cells[s.idx].classList.remove('pop'), 350);
        ctx.delay(step, 70);
      };
      step();
    }

    function place(v) {
      if (finished || busy || roundDone || sel < 0 || grid[sel]) return;
      if (v !== solution[sel]) {
        mistakes++;
        sfx.bad();
        cells[sel].classList.add('clash');
        ctx.delay(() => cells[sel].classList.remove('clash'), 600);
        $banner.textContent = `틀렸습니다 (실수 ${mistakes}/${MAX_MISTAKES})`;
        $banner.className = 'ch2-banner bad';
        render();
        if (mistakes >= MAX_MISTAKES) return end();
        return;
      }
      grid[sel] = v;
      sfx.good();
      cells[sel].classList.add('pop');
      ctx.delay(() => cells[sel].classList.remove('pop'), 350);
      sel = -1;
      cands = candidates(SPEC9, grid);
      render();
      cascade();
    }

    $pad.addEventListener('pointerdown', e => {
      const b = e.target.closest('.sd-key');
      if (!b) return;
      e.preventDefault();
      place(Number(b.dataset.v));
    });

    ctx.body.querySelector('#ch2-skip').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (busy || roundDone || finished) return;
      roundDone = true;
      sfx.bad();
      $banner.textContent = '건너뜀';
      $banner.className = 'ch2-banner';
      ctx.delay(newRound, 700);
    });

    const readSec = ctx.stopwatch();

    function end() {
      if (finished) return;
      finished = true;
      ctx.finish({
        score: totalChain,
        perf: cleared / EXPECTED_CLEAR,
        detail: `${cleared}/${ROUNDS}판 돌파 · ${totalChain}칸 연쇄 · ${readSec()}초`,
      });
    }

    newRound();
  },
};
