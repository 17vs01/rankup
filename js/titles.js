// 칭호 — 종목별로 높은 티어에 오르면 붙는 별명
//
// 티어(브론즈~그랜드마스터)는 숫자에 가깝다. 칭호는 그 숫자를 사람 말로 바꿔서
// "내가 뭘 잘하는 사람인지" 한마디로 말해준다. 자랑할 거리가 있어야 다시 온다.
//
// 세 단계만 준다 — 골드 / 다이아 / 그랜드마스터.
// 티어마다 주면 흔해져서 아무 감흥이 없고, 하나만 주면 너무 멀다.

export const TITLES = {
  //            골드(1400)      다이아(2000)     그랜드마스터(2600)
  lexi:      ['어휘 수집가',   '어휘 부자',     '어휘 천재'],
  anagram:   ['낱말 조립공',   '음절 마술사',   '낱말의 신'],
  math:      ['빠른 셈',       '암산 갑',       '인간 계산기'],
  compare:   ['어림셈 고수',   '수 감각 갑',    '직감의 신'],
  t24:       ['숫자 요리사',   '역산 장인',     '24의 지배자'],
  memory:    ['패턴 기억가',   '기억력 갑',     '사진 기억'],
  simon:     ['순서 지킴이',   '멜로디 기억가', '순서의 신'],
  focus:     ['딴생각 없음',   '집중력 갑',     '무아지경'],
  schulte:   ['빠른 눈',       '매의 눈',       '시야의 신'],
  compass:   ['길눈 밝음',     '인간 내비',     '방향의 신'],
  eyeball:   ['눈썰미',        '눈대중 장인',   '인간 자'],
  chrono:    ['시간 감각',     '체내 시계 갑',  '인간 시계'],
  unpredict: ['종잡을 수 없음', '예측 불허',    'AI 사냥꾼'],
  pattern:   ['눈치 백단',     '패턴 탐정',     '수열의 신'],
};

// 티어 인덱스: 0 브론즈 · 1 실버 · 2 골드 · 3 플래티넘 · 4 다이아 · 5 마스터 · 6 그랜드마스터
const STEPS = [
  { minTier: 6, i: 2 },
  { minTier: 4, i: 1 },
  { minTier: 2, i: 0 },
];

/** 이 종목의 이 티어에서 받는 칭호. 골드 미만이면 null. */
export function titleOf(gameId, tierIdx) {
  const list = TITLES[gameId];
  if (!list) return null;
  for (const s of STEPS) {
    if (tierIdx >= s.minTier) return { name: list[s.i], step: s.i };
  }
  return null;
}

/** 다음 칭호까지 필요한 티어 인덱스. 이미 최고면 null. */
export function nextTitleTier(tierIdx) {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (tierIdx < STEPS[i].minTier) return STEPS[i].minTier;
  }
  return null;
}

/**
 * 가진 칭호 중 대표 하나. 단계가 높은 것 우선, 같으면 레이팅이 높은 쪽.
 * games: [{id, name, icon}], ratingOf: id -> 레이팅, tierIdxOf: id -> 티어 인덱스
 */
export function bestTitle(games, ratingOf, tierIdxOf) {
  let best = null;
  for (const g of games) {
    const t = titleOf(g.id, tierIdxOf(g.id));
    if (!t) continue;
    const cand = { ...t, game: g, rating: ratingOf(g.id) };
    if (!best || cand.step > best.step
      || (cand.step === best.step && cand.rating > best.rating)) best = cand;
  }
  return best;
}
