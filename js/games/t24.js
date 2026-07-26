// 24 만들기 — 역산
// 숫자 4개와 사칙연산으로 목표값을 만든다. 푸는 것보다 만드는 게 어렵다.
// 숫자 탭 → 연산자 탭 → 숫자 탭 하면 두 수가 하나로 합쳐진다. 마지막 한 수가 목표값이면 성공.
import { sfx } from '../audio.js';

const ROUNDS = 5;
const EPS = 1e-6;
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 네 수로 target을 만들 수 있는지 (분수 허용)
function solvable(nums, target) {
  function rec(arr) {
    if (arr.length === 1) return Math.abs(arr[0] - target) < EPS;
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const rest = arr.filter((_, k) => k !== i && k !== j);
        const a = arr[i], b = arr[j];
        const results = [a + b, a - b, a * b];
        if (Math.abs(b) > EPS) results.push(a / b);
        for (const r of results) if (rec([...rest, r])) return true;
      }
    }
    return false;
  }
  return rec(nums);
}

// 난이도: 목표값과 숫자 범위가 올라간다
function makePuzzle(L) {
  const target = L < 1 ? 24 : L < 2.5 ? [24, 36][ri(0, 1)] : [24, 36, 48, 60][ri(0, 3)];
  const hi = Math.min(13, 9 + Math.floor(L * 1.5));
  for (let t = 0; t < 800; t++) {
    const nums = [ri(1, hi), ri(1, hi), ri(1, hi), ri(1, hi)];
    if (solvable(nums, target)) return { nums, target };
  }
  return { nums: [4, 6, 2, 3], target: 24 };
}

const fmt = x => {
  const r = Math.round(x);
  if (Math.abs(x - r) < EPS) return String(r);
  return String(Math.round(x * 100) / 100);
};

export const t24Game = {
  id: 't24',
  name: '24 만들기',
  icon: '🧩',
  desc: '숫자 4개로 목표값 만들기',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 800) / 250);
    let round = 0, solved = 0, totalSec = 0;
    let tiles = [], target = 0, selIdx = -1, op = null, startAt = 0;
    const history = [];   // 되돌리기용 타일 스냅샷

    ctx.body.innerHTML = `
      <div class="t24-round" id="t24-round"></div>
      <div class="t24-target">목표 <b id="t24-target"></b></div>
      <div class="t24-tiles" id="t24-tiles"></div>
      <div class="t24-ops" id="t24-ops">
        <button class="t24-op" data-o="+">+</button>
        <button class="t24-op" data-o="-">−</button>
        <button class="t24-op" data-o="*">×</button>
        <button class="t24-op" data-o="/">÷</button>
      </div>
      <div class="t24-actions">
        <button class="btn-secondary" id="t24-undo">↺ 되돌리기</button>
        <button class="btn-secondary" id="t24-skip">건너뛰기</button>
      </div>
      <div class="t24-fb" id="t24-fb"></div>
    `;
    const $round = ctx.body.querySelector('#t24-round');
    const $target = ctx.body.querySelector('#t24-target');
    const $tiles = ctx.body.querySelector('#t24-tiles');
    const $ops = ctx.body.querySelector('#t24-ops');
    const $fb = ctx.body.querySelector('#t24-fb');

    function render() {
      $tiles.innerHTML = '';
      tiles.forEach((v, i) => {
        const b = document.createElement('button');
        b.className = 't24-tile' + (i === selIdx ? ' sel' : '');
        b.textContent = fmt(v);
        b.dataset.i = i;
        $tiles.appendChild(b);
      });
      for (const b of $ops.children) b.classList.toggle('sel', b.dataset.o === op);
    }

    function newRound() {
      round++;
      if (round > ROUNDS) return end();
      const p = makePuzzle(L);
      tiles = p.nums.slice();
      target = p.target;
      selIdx = -1; op = null;
      history.length = 0;
      startAt = performance.now();
      $round.textContent = `${round} / ${ROUNDS}라운드`;
      $target.textContent = target;
      $fb.textContent = '두 수를 골라 합치세요';
      $fb.className = 't24-fb';
      render();
    }

    $tiles.addEventListener('pointerdown', e => {
      const b = e.target.closest('.t24-tile');
      if (!b) return;
      e.preventDefault();
      const i = Number(b.dataset.i);
      if (selIdx === -1) { selIdx = i; render(); return; }
      if (i === selIdx) { selIdx = -1; render(); return; }
      if (!op) { selIdx = i; render(); return; }

      const a = tiles[selIdx], c = tiles[i];
      let r;
      if (op === '+') r = a + c;
      else if (op === '-') r = a - c;
      else if (op === '*') r = a * c;
      else { if (Math.abs(c) < EPS) { $fb.textContent = '0으로 나눌 수 없습니다'; $fb.className = 't24-fb bad'; return; } r = a / c; }

      history.push(tiles.slice());
      const rest = tiles.filter((_, k) => k !== selIdx && k !== i);
      tiles = [...rest, r];
      selIdx = -1; op = null;
      sfx.tick();
      render();

      if (tiles.length === 1) {
        const ok = Math.abs(tiles[0] - target) < EPS;
        if (ok) {
          solved++;
          totalSec += (performance.now() - startAt) / 1000;
          sfx.good();
          $fb.textContent = `성공! ${fmt(tiles[0])} = ${target}`;
          $fb.className = 't24-fb good';
          ctx.delay(newRound, 1100);
        } else {
          sfx.bad();
          $fb.textContent = `${fmt(tiles[0])} … 목표는 ${target}. 되돌리세요`;
          $fb.className = 't24-fb bad';
        }
      }
    });

    $ops.addEventListener('pointerdown', e => {
      const b = e.target.closest('.t24-op');
      if (!b) return;
      e.preventDefault();
      op = b.dataset.o === op ? null : b.dataset.o;
      render();
    });

    ctx.body.querySelector('#t24-undo').addEventListener('pointerdown', e => {
      e.preventDefault();
      const prev = history.pop();
      if (!prev) return;
      tiles = prev; selIdx = -1; op = null;
      $fb.textContent = '두 수를 골라 합치세요';
      $fb.className = 't24-fb';
      render();
    });

    ctx.body.querySelector('#t24-skip').addEventListener('pointerdown', e => {
      e.preventDefault();
      sfx.bad();
      newRound();
    });

    function end() {
      const avg = solved > 0 ? (totalSec / solved).toFixed(0) : '–';
      ctx.finish({
        score: solved,
        perf: solved / 3.2,
        detail: `${solved}/${ROUNDS} 성공${solved ? ` · 평균 ${avg}초` : ''}`,
      });
    }

    newRound();
  },
};
