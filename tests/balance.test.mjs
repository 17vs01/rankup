// 균형 검사 — "생각 없이 누르는 전략"이 레이팅과 주간 점수에서 이득을 보면 안 된다.
// 실제로 잡힌 것: 예측 불가에서 동전만 던져도 300판에 2,379까지 오르고 계속 올랐다.
import { expose, read, collector } from './_load.mjs';

export const name = '점수 균형';

// main.js는 화면을 바로 건드려서 통째로 불러올 수 없다. 순수 함수만 글자로 떼어 온다.
function grabFunction(src, fnName) {
  const start = src.indexOf(`function ${fnName}(`);
  if (start < 0) throw new Error(`${fnName}을 main.js에서 찾지 못함`);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}
function grabConst(src, constName) {
  const m = src.match(new RegExp(`const ${constName} = ([^;]+);`));
  if (!m) throw new Error(`${constName}을 main.js에서 찾지 못함`);
  return `const ${constName} = ${m[1]};`;
}

export async function run() {
  const c = collector();
  const main = read('js/main.js');
  const rating = await expose('js/rating.js', ['ratingDelta']);

  // ---------- 주간 점수표 ----------
  const weekSrc = ['WEEK_PTS_PER_GAME', 'WEEK_PTS_MAX', 'WEEK_PERF_FLOOR'].map(k => grabConst(main, k)).join('\n')
    + '\n' + grabFunction(main, 'weekPointsFor') + '\nreturn weekPointsFor;';
  const weekPointsFor = new Function(weekSrc)();
  const expectPts = [[0, 0], [0.375, 0], [0.5, 0], [1, 10], [1.5, 20], [2.2, 20], [NaN, 0]];
  for (const [perf, want] of expectPts) {
    const got = weekPointsFor(perf);
    if (got !== want) c.note('주간 점수표가 약속과 다름', `perf ${perf} → ${got}점 (기대 ${want}점)`);
  }
  // 함정 퀴즈를 안 읽고 찍으면: 3문제 × 25% → 평균 0.75개 → perf 0.375 → 0점이어야 한다
  if (weekPointsFor(0.75 / 2.0) !== 0) c.note('함정 퀴즈 찍기가 주간 점수를 번다', weekPointsFor(0.375));

  // ---------- 난이도 상한 보정 ----------
  const ceilSrc = ['CEILING_STEP', 'CEILING_GAIN'].map(k => grabConst(main, k)).join('\n')
    + '\n' + grabFunction(main, 'ceilingAdjust') + '\nreturn ceilingAdjust;';
  const ceilingAdjust = new Function(ceilSrc)();
  const g = { ceiling: 2000 };
  if (ceilingAdjust(g, 1900, 1.3) !== 1.3) c.note('상한 아래에서 성과가 바뀜', ceilingAdjust(g, 1900, 1.3));
  if (!(ceilingAdjust(g, 2300, 1.3) < 1.3)) c.note('상한 위에서 기대치가 안 오름', ceilingAdjust(g, 2300, 1.3));
  if (ceilingAdjust({}, 3000, 1.3) !== 1.3) c.note('상한이 없는 종목의 성과가 바뀜', ceilingAdjust({}, 3000, 1.3));
  // 늘 기대의 1.3배를 하는 사람이 상한 종목에서 끝없이 오르지 않는가
  {
    let r = 1000;
    for (let i = 0; i < 2000; i++) r = Math.max(600, r + rating.ratingDelta(ceilingAdjust(g, r, 1.3)));
    if (r > g.ceiling + 900) c.note('상한 종목에서 레이팅이 멈추지 않음', `성과 1.3 고정으로 2000판 → ${r}`);
  }

  // ---------- 예측 불가: 생각 없는 전략 ----------
  {
    const u = await expose('js/games/unpredict.js', ['makePredictor', 'expectedMissRate']);
    const play = (r, strat) => {
      const L = Math.max(0, (r - 800) / 200);
      const ai = u.makePredictor(Math.min(8, 2 + Math.floor(L)), r >= 1400);
      let hits = 0, last = 0;
      for (let i = 0; i < 60; i++) {
        const pred = ai.predict();
        const mv = strat(i, last);
        if (pred === mv) hits++;
        ai.record(mv, false);
        last = mv;
      }
      return (60 - hits) / 60 / u.expectedMissRate(r);
    };
    const settle = strat => {
      let r = 1000, pts = 0;
      const N = 1200;
      for (let i = 0; i < N; i++) {
        const p = play(r, strat);
        r = Math.max(600, r + rating.ratingDelta(p));
        if (i >= N - 300) pts += weekPointsFor(p);
      }
      return { r, pts: pts / 300 };
    };
    const coin = settle(() => (Math.random() < 0.5 ? 0 : 1));
    // 완전 무작위는 이론상 최선이라 높은 곳에서 멈추는 건 맞다. "멈춘다"는 것만 본다.
    if (coin.r > 2500) c.note('예측 불가: 동전 던지기로 레이팅이 멈추지 않음', `1200판 뒤 ${coin.r}`);
    if (coin.pts > 11.5) c.note('예측 불가: 동전 던지기의 주간 점수가 기대(10점)를 크게 넘음', `판당 ${coin.pts.toFixed(1)}점`);
    const alt = settle(i => i % 2);
    if (alt.r > 700) c.note('예측 불가: 번갈아 누르기가 벌을 안 받음', `레이팅 ${alt.r}`);
  }

  return c;
}
