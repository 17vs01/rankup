// 마인드 리딩 머신 — 예측 불가능해지기
// 1953년 벨연구소 섀넌/하겔바거의 동전 맞히기 기계를 폰으로 옮긴 것.
// 사람은 무작위를 못 만든다. AI가 다음 수를 미리 예측하고, 적중률 50%면 만점.
import { sfx } from '../audio.js';

const TRIALS = 60;
const EXPECTED_MISS_RATE = 0.44; // 이 정도 피하면 본전. 완전 무작위(0.5)면 소폭 상승.

// 다중 차수 마르코프 예측기 (문맥 혼합)
function makePredictor(maxOrder, useTiming) {
  const table = new Map();
  const hist = [];   // 0 = 좌, 1 = 우
  const speed = [];  // 0 = 빠름, 1 = 느림

  function keysFor(i) {
    // i번째 수를 예측할 때 쓸 문맥 키들
    const out = [];
    for (let o = 1; o <= maxOrder; o++) {
      if (i < o) break;
      out.push({ k: o + '|' + hist.slice(i - o, i).join(''), w: Math.pow(1.8, o) });
    }
    // 상위 랭크: 누른 속도(빠름/느림)도 문맥에 넣는다. 사람은 여기서도 버릇이 샌다.
    if (useTiming && i >= 2) {
      out.push({ k: 't|' + speed.slice(i - 2, i).join('') + hist.slice(i - 2, i).join(''), w: 2.5 });
    }
    return out;
  }

  return {
    predict() {
      let s0 = 0, s1 = 0;
      for (const { k, w } of keysFor(hist.length)) {
        const c = table.get(k);
        if (!c) continue;
        const n = c[0] + c[1];
        if (n === 0) continue;
        // 관측이 쌓일수록 신뢰도 상승
        const conf = n / (n + 1.5);
        s0 += w * conf * (c[0] / n);
        s1 += w * conf * (c[1] / n);
      }
      if (Math.abs(s0 - s1) < 1e-9) return Math.random() < 0.5 ? 0 : 1;
      return s0 > s1 ? 0 : 1;
    },
    record(move, fast) {
      for (const { k } of keysFor(hist.length)) {
        let c = table.get(k);
        if (!c) { c = [0, 0]; table.set(k, c); }
        c[move]++;
      }
      hist.push(move);
      speed.push(fast ? 0 : 1);
    },
  };
}

export const unpredictGame = {
  id: 'unpredict',
  name: '예측 불가',
  icon: '🎭',
  desc: 'AI가 내 다음 수를 맞힌다',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 800) / 200);
    const maxOrder = Math.min(8, 2 + Math.floor(L));
    const useTiming = ctx.rating >= 1400;
    const ai = makePredictor(maxOrder, useTiming);

    let trial = 0, aiHits = 0, streakEvade = 0, bestEvade = 0;
    let pending = null;      // 이번 판 AI 예측
    let lastTapAt = performance.now();
    let locked = false;

    ctx.body.innerHTML = `
      <div class="up-head">
        <div class="up-brain">🤖 <span id="up-order">${maxOrder}수 기억</span>${useTiming ? ' + 리듬' : ''}</div>
        <div class="up-rate"><span id="up-rate">–</span> <small>AI 적중률</small></div>
      </div>
      <div class="up-bar"><div class="up-bar-fill" id="up-bar"></div><div class="up-bar-mid"></div></div>
      <div class="up-verdict" id="up-verdict">아무 쪽이나. 단, 읽히지 않게.</div>
      <div class="up-tape" id="up-tape"></div>
      <div class="up-buttons">
        <button class="up-btn" data-m="0">◀</button>
        <button class="up-btn" data-m="1">▶</button>
      </div>
      <div class="up-count"><span id="up-trial">0</span> / ${TRIALS}</div>
    `;
    const $rate = ctx.body.querySelector('#up-rate');
    const $bar = ctx.body.querySelector('#up-bar');
    const $verdict = ctx.body.querySelector('#up-verdict');
    const $tape = ctx.body.querySelector('#up-tape');
    const $trial = ctx.body.querySelector('#up-trial');

    function arm() {
      pending = ai.predict();   // 사람이 누르기 전에 AI가 먼저 정한다
      locked = false;
    }

    function tap(move) {
      if (locked || trial >= TRIALS) return;
      locked = true;
      const now = performance.now();
      const dt = now - lastTapAt;
      lastTapAt = now;

      const caught = pending === move;
      trial++;
      if (caught) {
        aiHits++;
        streakEvade = 0;
        sfx.bad();
        $verdict.textContent = '읽혔다';
        $verdict.className = 'up-verdict caught';
      } else {
        streakEvade++;
        bestEvade = Math.max(bestEvade, streakEvade);
        sfx.good();
        $verdict.textContent = streakEvade >= 4 ? `따돌리는 중 ${streakEvade}연속` : '따돌렸다';
        $verdict.className = 'up-verdict evaded';
      }

      // 기록 테이프 (최근 20수)
      const dot = document.createElement('span');
      dot.className = 'up-dot ' + (caught ? 'caught' : 'evaded');
      dot.textContent = move === 0 ? '◀' : '▶';
      $tape.appendChild(dot);
      while ($tape.children.length > 20) $tape.removeChild($tape.firstChild);

      const rate = Math.round(aiHits / trial * 100);
      $rate.textContent = rate + '%';
      $bar.style.width = rate + '%';
      $bar.className = 'up-bar-fill' + (rate > 55 ? ' hot' : rate < 45 ? ' cool' : '');
      $trial.textContent = trial;

      ai.record(move, dt < 500);

      if (trial >= TRIALS) return end();
      ctx.delay(arm, 130);
    }

    ctx.body.querySelector('.up-buttons').addEventListener('pointerdown', e => {
      const m = e.target.dataset && e.target.dataset.m;
      if (m === undefined) return;
      e.preventDefault();
      tap(Number(m));
    });

    function end() {
      const misses = TRIALS - aiHits;
      const hitRate = Math.round(aiHits / TRIALS * 100);
      ctx.finish({
        score: misses,
        perf: (misses / TRIALS) / EXPECTED_MISS_RATE,
        detail: `AI 적중률 ${hitRate}% · 최고 ${bestEvade}연속 회피`,
      });
    }

    arm();
  },
};
