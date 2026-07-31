// 슐테 테이블 — 시각 탐색 + 주의 분배
// 흩어진 1~N²를 순서대로 찾아 탭한다. 눈이 아니라 "주변시로 훑는" 능력을 쓴다.
// 격자 크기가 커질수록 한 번에 담아야 할 시야가 넓어진다.
import { sfx } from '../audio.js';
import { judge } from '../feedback.js';

// 한 라운드가 30~60초라 3라운드는 한 판이 너무 길어진다. 2라운드로 끊는다.
const ROUNDS = 2;

// 레벨에 따라 격자가 커진다. 5×5가 고전적인 기본.
// 시작 레이팅(1000)이 레벨 0. 25칸 → 36칸은 체감이 커서 천천히 올린다.
function sizeFor(rating) {
  const L = Math.max(0, (rating - 1000) / 450);
  return Math.min(7, 5 + Math.floor(L));
}

// 이 크기를 이만큼에 끝내면 기대치 (초).
// 보통 성인의 5×5가 30~50초다. 26초로 잡으면 처음부터 거의 다 LP를 잃는다.
const EXPECT = { 5: 36, 6: 58, 7: 85 };

export const schulteGame = {
  id: 'schulte',
  name: '슐테 테이블',
  icon: '🔎',
  desc: '흩어진 숫자를 순서대로 찾기',
  run(ctx) {
    const n = sizeFor(ctx.rating);
    const total = n * n;
    const expect = EXPECT[n];

    let round = 0, next = 1, misses = 0;
    let roundStart = 0;
    const times = [];        // 라운드별 걸린 시간 (초)

    ctx.body.innerHTML = `
      <div class="sh-head">
        <span id="sh-round"></span>
        <span class="sh-next">다음 <b id="sh-next">1</b></span>
        <span>실수 <b id="sh-miss">0</b></span>
      </div>
      <div class="sh-grid" id="sh-grid"></div>
      <div class="sh-note" id="sh-note">가운데를 보고 주변시로 훑으세요</div>
    `;
    const $round = ctx.body.querySelector('#sh-round');
    const $next = ctx.body.querySelector('#sh-next');
    const $miss = ctx.body.querySelector('#sh-miss');
    const $grid = ctx.body.querySelector('#sh-grid');
    const $note = ctx.body.querySelector('#sh-note');

    const elapsed = ctx.stopwatch();

    function shuffled() {
      const a = [];
      for (let i = 1; i <= total; i++) a.push(i);
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function startRound() {
      round++;
      if (round > ROUNDS) return end();
      next = 1;
      roundStart = performance.now();
      $round.textContent = `${round} / ${ROUNDS}라운드 · ${n}×${n}`;
      $next.textContent = '1';
      $grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      $grid.innerHTML = '';
      for (const v of shuffled()) {
        const b = document.createElement('button');
        b.className = 'sh-cell';
        b.textContent = v;
        b.dataset.v = v;
        $grid.appendChild(b);
      }
    }

    $grid.addEventListener('pointerdown', e => {
      const b = e.target.closest('.sh-cell');
      if (!b || b.classList.contains('done')) return;
      e.preventDefault();
      const v = Number(b.dataset.v);
      if (v !== next) {
        misses++;
        $miss.textContent = misses;
        sfx.bad();
        b.classList.add('bad');
        ctx.delay(() => b.classList.remove('bad'), 320);
        return;
      }
      b.classList.add('done');
      next++;
      $next.textContent = next <= total ? next : '✓';
      sfx.tick();
      if (next > total) {
        const sec = (performance.now() - roundStart) / 1000;
        times.push(sec);
        sfx.good();
        judge(ctx.body, true, `${sec.toFixed(1)}초`);
        $note.textContent = `${round}라운드 ${sec.toFixed(1)}초`;
        ctx.delay(startRound, 1100);
      }
    });

    function end() {
      const best = Math.min(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      // 기대 시간보다 빠를수록 높게. 실수는 한 번에 5% 감점.
      const perf = Math.max(0.3, Math.min(2.2,
        (expect / Math.max(4, avg)) * (1 - misses * 0.05)));
      ctx.finish({
        score: Math.max(1, Math.round(expect / Math.max(4, avg) * 100)),
        perf,
        detail: `${n}×${n} · 평균 ${avg.toFixed(1)}초 · 최고 ${best.toFixed(1)}초 · 실수 ${misses}`,
        time: { key: `time_${n}x${n}`, value: best, unit: 'sec', label: `${n}×${n} 최단` },
      });
      // elapsed는 상단 시계 표시용이라 결과에는 쓰지 않는다
      void elapsed;
    }

    startRound();
  },
};
