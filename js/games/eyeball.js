// 눈대중 — 각도·비율·개수·넓이를 순간 추정
// 눈금 위를 한 번 탭하면 답 확정. 레벨이 오르면 허용 오차가 조여든다.
import { sfx } from '../audio.js';

const ROUNDS = 8;
const EXPECTED_PER_ROUND = 55;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const rnd = (a, b) => a + Math.random() * (b - a);

export const eyeballGame = {
  id: 'eyeball',
  name: '눈대중',
  icon: '📐',
  desc: '각도·비율·개수 순간 추정',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 800) / 150);
    // 허용 오차: 눈금 전체 범위 대비 비율. 레벨이 오르면 좁아진다.
    const tolFrac = Math.max(0.025, 0.14 - L * 0.011);

    let round = 0, total = 0;
    const hits = [];

    ctx.body.innerHTML = `
      <div class="eb-round" id="eb-round"></div>
      <div class="eb-prompt" id="eb-prompt"></div>
      <div class="eb-canvas" id="eb-canvas"></div>
      <div class="eb-scale" id="eb-scale">
        <div class="eb-track" id="eb-track">
          <div class="eb-ticks" id="eb-ticks"></div>
          <div class="eb-marker hidden" id="eb-mine"></div>
          <div class="eb-marker truth hidden" id="eb-truth"></div>
        </div>
        <div class="eb-labels"><span id="eb-lo"></span><span id="eb-hi"></span></div>
      </div>
      <div class="eb-feedback" id="eb-feedback">눈금을 탭해서 답하세요</div>
    `;
    const $round = ctx.body.querySelector('#eb-round');
    const $prompt = ctx.body.querySelector('#eb-prompt');
    const $canvas = ctx.body.querySelector('#eb-canvas');
    const $track = ctx.body.querySelector('#eb-track');
    const $ticks = ctx.body.querySelector('#eb-ticks');
    const $mine = ctx.body.querySelector('#eb-mine');
    const $truth = ctx.body.querySelector('#eb-truth');
    const $lo = ctx.body.querySelector('#eb-lo');
    const $hi = ctx.body.querySelector('#eb-hi');
    const $fb = ctx.body.querySelector('#eb-feedback');

    let cur = null, locked = true;

    // ---------- 문제 유형 ----------
    const TYPES = [
      function angle() {
        const deg = ri(8, 172);
        const rot = ri(0, 359);
        const r = 100;
        const p = a => [150 + r * Math.cos(a * Math.PI / 180), 150 - r * Math.sin(a * Math.PI / 180)];
        const [x1, y1] = p(rot), [x2, y2] = p(rot + deg);
        return {
          prompt: '두 선이 이루는 각은?',
          svg: `<svg viewBox="0 0 300 300"><g stroke="var(--accent)" stroke-width="5" stroke-linecap="round">
            <line x1="150" y1="150" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>
            <line x1="150" y1="150" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>
            </g><circle cx="150" cy="150" r="5" fill="var(--text)"/></svg>`,
          answer: deg, lo: 0, hi: 180, unit: '°', flashMs: 0,
        };
      },
      function ratio() {
        const pct = ri(12, 92);
        const hA = 200, hB = Math.round(hA * pct / 100);
        return {
          prompt: '오른쪽 막대는 왼쪽의 몇 %?',
          svg: `<svg viewBox="0 0 300 300">
            <rect x="60" y="${290 - hA}" width="60" height="${hA}" rx="4" fill="var(--text-dim)"/>
            <rect x="180" y="${290 - hB}" width="60" height="${hB}" rx="4" fill="var(--accent)"/>
            </svg>`,
          answer: pct, lo: 0, hi: 100, unit: '%', flashMs: 0,
        };
      },
      function count() {
        const n = ri(18, 110);
        let dots = '';
        for (let i = 0; i < n; i++) {
          dots += `<circle cx="${rnd(12, 288).toFixed(1)}" cy="${rnd(12, 288).toFixed(1)}" r="5" fill="var(--accent)"/>`;
        }
        return {
          prompt: '점이 몇 개였나?',
          svg: `<svg viewBox="0 0 300 300">${dots}</svg>`,
          answer: n, lo: 0, hi: 130, unit: '개', flashMs: 700,  // 잠깐 보여주고 가림
        };
      },
      function area() {
        const pct = ri(10, 90);
        const rA = 110, rB = Math.round(rA * Math.sqrt(pct / 100));
        return {
          prompt: '작은 원의 넓이는 큰 원의 몇 %?',
          svg: `<svg viewBox="0 0 300 300">
            <circle cx="105" cy="150" r="${rA}" fill="var(--text-dim)"/>
            <circle cx="215" cy="215" r="${rB}" fill="var(--accent)"/>
            </svg>`,
          answer: pct, lo: 0, hi: 100, unit: '%', flashMs: 0,
        };
      },
    ];

    function drawTicks(lo, hi) {
      $ticks.innerHTML = '';
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const t = document.createElement('span');
        t.className = 'eb-tick' + (i % 5 === 0 ? ' major' : '');
        t.style.left = (i / n * 100) + '%';
        $ticks.appendChild(t);
      }
      $lo.textContent = lo;
      $hi.textContent = hi;
    }

    function next() {
      round++;
      if (round > ROUNDS) return end();
      cur = TYPES[ri(0, TYPES.length - 1)]();
      $round.textContent = `${round} / ${ROUNDS}라운드`;
      $prompt.textContent = cur.prompt;
      $canvas.innerHTML = cur.svg;
      $mine.classList.add('hidden');
      $truth.classList.add('hidden');
      drawTicks(cur.lo, cur.hi + cur.unit);
      locked = true;
      if (cur.flashMs > 0) {
        $fb.textContent = '잘 보세요…';
        ctx.delay(() => {
          $canvas.innerHTML = '<div class="eb-hidden-note">?</div>';
          $fb.textContent = '눈금을 탭해서 답하세요';
          locked = false;
        }, cur.flashMs);
      } else {
        $fb.textContent = '눈금을 탭해서 답하세요';
        locked = false;
      }
    }

    $track.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (locked || !cur) return;
      locked = true;
      const r = $track.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const guess = Math.round(cur.lo + frac * (cur.hi - cur.lo));
      const err = Math.abs(guess - cur.answer);
      const tol = (cur.hi - cur.lo) * tolFrac;
      const pts = Math.max(0, Math.round(100 * (1 - err / tol)));
      total += pts;
      hits.push(pts);

      const truthFrac = (cur.answer - cur.lo) / (cur.hi - cur.lo);
      $mine.style.left = (frac * 100) + '%';
      $truth.style.left = (truthFrac * 100) + '%';
      $mine.classList.remove('hidden');
      $truth.classList.remove('hidden');
      $mine.className = 'eb-marker ' + (pts >= 70 ? 'good' : pts > 0 ? 'ok' : 'miss');
      if (cur.flashMs > 0) $canvas.innerHTML = cur.svg;   // 개수 문제는 정답 공개
      $fb.innerHTML = `내 답 <b>${guess}${cur.unit}</b> · 정답 <b>${cur.answer}${cur.unit}</b> · ${pts}점`;
      if (pts >= 70) sfx.good(); else sfx.bad();

      ctx.delay(next, 1300);
    });

    function end() {
      const good = hits.filter(p => p >= 70).length;
      ctx.finish({
        score: total,
        perf: total / (ROUNDS * EXPECTED_PER_ROUND),
        detail: `정확 ${good}/${ROUNDS} · 허용 오차 ±${Math.round(tolFrac * 100)}%`,
      });
    }

    next();
  },
};
