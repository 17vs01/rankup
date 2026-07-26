// 체내 시계 — 화면 없이 시간 재기
// 목표 시간을 보고, 빈 화면에서 그 시각에 탭. 레벨이 오르면 목표가 길어지고
// 가짜 진행바(엉뚱한 속도로 차오름)가 체감을 흔든다.
import { sfx } from '../audio.js';

const ROUNDS = 4;
const EXPECTED_PER_ROUND = 55;

const rnd = (a, b) => a + Math.random() * (b - a);

export const chronoGame = {
  id: 'chrono',
  name: '체내 시계',
  icon: '⏳',
  desc: '보지 않고 시간 맞히기',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 800) / 150);
    // 목표 시간대와 허용 오차(비율)가 레벨에 따라 조여든다
    const lo = 4 + Math.min(8, L * 1.3);
    const hi = 8 + Math.min(14, L * 2.2);
    const tol = Math.max(0.05, 0.16 - L * 0.012);  // 0 오차 = 100점, tol 오차 = 0점
    const fakeBar = L >= 2;

    let round = 0, total = 0;
    const errs = [];

    ctx.body.innerHTML = `
      <div class="ch-round" id="ch-round"></div>
      <div class="ch-target" id="ch-target"></div>
      <div class="ch-hint" id="ch-hint"></div>
      <div class="ch-fake" id="ch-fake"><div class="ch-fake-fill" id="ch-fake-fill"></div></div>
      <button class="ch-pad" id="ch-pad"></button>
      <div class="ch-log" id="ch-log"></div>
    `;
    const $round = ctx.body.querySelector('#ch-round');
    const $target = ctx.body.querySelector('#ch-target');
    const $hint = ctx.body.querySelector('#ch-hint');
    const $fake = ctx.body.querySelector('#ch-fake');
    const $fakeFill = ctx.body.querySelector('#ch-fake-fill');
    const $pad = ctx.body.querySelector('#ch-pad');
    const $log = ctx.body.querySelector('#ch-log');

    let phase = 'ready';   // ready → running → result
    let target = 0, startAt = 0, rafId = null;

    function setup() {
      round++;
      if (round > ROUNDS) return end();
      target = Math.round(rnd(lo, hi) * 10) / 10;
      phase = 'ready';
      $round.textContent = `${round} / ${ROUNDS}라운드`;
      $target.textContent = `${target.toFixed(1)}초`;
      $hint.textContent = '탭하면 시작 — 다시 탭할 때까지의 시간을 맞추세요';
      $fake.classList.add('hidden');
      $pad.className = 'ch-pad ready';
      $pad.textContent = '시작';
    }

    function start() {
      phase = 'running';
      startAt = performance.now();
      $target.textContent = '';
      $hint.textContent = '';
      $pad.className = 'ch-pad running';
      $pad.textContent = '지금!';
      if (fakeBar) {
        // 0.6~1.5배 속도로 차오르는 가짜 진행바. 믿으면 틀린다.
        const speed = rnd(0.6, 1.5);
        $fake.classList.remove('hidden');
        const tick = () => {
          if (phase !== 'running') return;
          const p = Math.min(1, (performance.now() - startAt) / (target * 1000) * speed);
          $fakeFill.style.width = (p * 100) + '%';
          rafId = requestAnimationFrame(tick);
        };
        tick();
      }
    }

    function stop() {
      phase = 'result';
      if (rafId) cancelAnimationFrame(rafId);
      const actual = (performance.now() - startAt) / 1000;
      const relErr = Math.abs(actual - target) / target;
      const pts = Math.max(0, Math.round(100 * (1 - relErr / tol)));
      total += pts;
      errs.push({ target, actual, pts });

      const diff = actual - target;
      const sign = diff >= 0 ? '+' : '';
      $fake.classList.add('hidden');
      $pad.className = 'ch-pad ' + (pts >= 70 ? 'good' : pts > 0 ? 'ok' : 'miss');
      $pad.textContent = `${actual.toFixed(2)}초`;
      $hint.textContent = `목표 ${target.toFixed(1)}초 · ${sign}${diff.toFixed(2)}초 · ${pts}점`;
      if (pts >= 70) sfx.good(); else sfx.bad();

      const chip = document.createElement('span');
      chip.className = 'ch-chip ' + (pts >= 70 ? 'good' : pts > 0 ? 'ok' : 'miss');
      chip.textContent = `${sign}${diff.toFixed(1)}s`;
      $log.appendChild(chip);

      ctx.delay(setup, 1400);
    }

    $pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (phase === 'ready') start();
      else if (phase === 'running') stop();
    });

    function end() {
      const avgErr = errs.reduce((a, e) => a + Math.abs(e.actual - e.target), 0) / errs.length;
      ctx.finish({
        score: total,
        perf: total / (ROUNDS * EXPECTED_PER_ROUND),
        detail: `평균 오차 ${avgErr.toFixed(2)}초 · 허용 ±${Math.round(tol * 100)}%`,
      });
    }

    setup();
  },
};
