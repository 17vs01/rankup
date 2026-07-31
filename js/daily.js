// 데일리 챌린지 — 오늘 날짜를 시드로 쓰면 모든 사람이 같은 문제를 받는다.
// 문제가 전부 절차 생성이라 서버 없이도 "같은 판"이 만들어진다 (Wordle 모델).
//
// 게임은 ctx.rng를 쓰면 되고, 평소에는 Math.random이 들어간다.
// 데일리일 때만 이 시드 난수로 바뀐다.

// mulberry32 — 짧고 분포가 고른 시드 난수
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 날짜 + 종목 id를 섞어 시드를 만든다. 같은 날 같은 종목이면 항상 같은 값.
export function seedFor(dayKey, gameId) {
  let h = 2166136261;
  for (const ch of `${dayKey}|${gameId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 오늘의 도전 종목을 날짜로 정한다 (매일 하나, 전 유저 동일).
// 긴 종목과 고르는 화면이 있는 종목은 뺀다 — "같은 판"이 성립하지 않는다.
export function dailyChallengeId(dayKey, games) {
  const pool = games.filter(g => !g.long && !g.picker).map(g => g.id).sort();
  if (!pool.length) return null;
  return pool[seedFor(dayKey, 'challenge') % pool.length];
}
