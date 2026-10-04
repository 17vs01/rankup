// 마인드 리딩 머신 — 예측 불가능해지기
// 1953년 벨연구소 섀넌/하겔바거의 동전 맞히기 기계를 폰으로 옮긴 것.
// 사람은 무작위를 못 만든다. AI가 다음 수를 미리 예측하고, 적중률 50%면 만점.
import { sfx } from '../audio.js';
import { comboTick } from '../feedback.js';

// 오늘의 도전이면 ctx.rng(날짜 시드 난수)가 들어온다. 문제를 만들 때는 반드시 R()을 쓴다 —
// Math.random을 섞으면 같은 날 같은 종목이어도 사람마다 판이 갈린다.
let R = Math.random;

const TRIALS = 60;
// 이 정도 피하면 본전. 시작 레이팅에서 45%이고 레이팅 200마다 1%p씩 오른다.
// 예전에는 44%로 고정이라, 동전만 던져도(50%) 언제나 기대 이상이었다 — 300판에 2,379까지
// 오르고도 계속 올랐고, 생각 없이 주간 점수를 가장 많이 버는 방법이었다.
// 완전 무작위가 본전이 되는 곳이 2000 근처(다이아)다. 그 위는 무작위보다 잘해야 하는데
// 평균적으로는 불가능하므로 거기서 멈춘다.
const expectedMissRate = rating => 0.44 + 0.01 * Math.max(0, (rating - 800) / 200);

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
      if (Math.abs(s0 - s1) < 1e-9) return R() < 0.5 ? 0 : 1;
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
    R = ctx.rng || Math.random;
    const L = Math.max(0, (ctx.rating - 800) / 200);
    const maxOrder = Math.min(8, 2 + Math.floor(L));
    const useTiming = ctx.rating >= 1400;
    const ai = makePredictor(maxOrder, useTiming);

    let trial = 0, aiHits = 0, streakEvade = 0, bestEvade = 0;
    let pending = null;      // 이번 판 AI 예측
    let lastTapAt = ctx.now();
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
      const now = ctx.now();
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
        comboTick(ctx.body, streakEvade);   // 5연속마다 "따돌리는 중"을 크게
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
        perf: (misses / TRIALS) / expectedMissRate(ctx.rating),
        detail: `AI 적중률 ${hitRate}% · 최고 ${bestEvade}연속 회피`,
        times: [
          { key: 'ai_rate_min', value: hitRate, unit: 'pct', label: '최저 AI 적중률' },
          { key: 'evade_best', value: bestEvade, unit: 'count', label: '최다 연속 회피' },
        ],
      });
    }

    arm();
  },
};
