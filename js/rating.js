// 레이팅 & 티어 시스템 (ELO식 상대 성과 기반)

// 색은 채도를 낮춘 금속 계열로 통일한다. 원색이 7개 섞이면 목록이 시끄러워진다.
export const TIERS = [
  { name: '브론즈',       min: 0,    color: '#B08258' },
  { name: '실버',         min: 1100, color: '#A9B2BF' },
  { name: '골드',         min: 1400, color: '#C9A961' },
  { name: '플래티넘',     min: 1700, color: '#79BDB4' },
  { name: '다이아',       min: 2000, color: '#7FA0E8' },
  { name: '마스터',       min: 2300, color: '#A98BD6' },
  { name: '그랜드마스터', min: 2600, color: '#D97B7B' },
];

export const START_RATING = 1000;
const K = 32;               // 판당 최대 변동폭 근처
const DECAY_GRACE_H = 48;   // 부식 유예 (시간)
const DECAY_PER_DAY = 8;    // 유예 이후 하루당 부식량
const DECAY_FLOOR_GAP = 250; // 최고점 대비 최대 부식 폭
// 몇 판 안 해본 조합은 녹슬지 않는다. 구경 삼아 한두 판 해본 걸 벌주면
// 여러 조합을 시도할 이유가 없어진다 (집중력만 조합이 7개다).
export const DECAY_MIN_SESSIONS = 3;

export function tierOf(rating) {
  let t = TIERS[0], idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (rating >= TIERS[i].min) { t = TIERS[i]; idx = i; }
  }
  return { ...t, idx };
}

// 티어 내 진행률 0~1
export function tierProgress(rating) {
  const t = tierOf(rating);
  const next = TIERS[t.idx + 1];
  if (!next) return 1;
  return Math.min(1, Math.max(0, (rating - t.min) / (next.min - t.min)));
}

// perf: 실제성과/기대성과 비율 (1.0 = 기대치 정확히 달성)
export function ratingDelta(perf) {
  const clamped = Math.max(0, Math.min(2.2, perf));
  let delta = Math.round(K * (clamped - 1));
  // 상승은 살짝 후하게, 하락은 살짝 완만하게 (초반 동기 유지)
  if (delta < 0) delta = Math.round(delta * 0.75);
  return Math.max(-24, Math.min(K + 8, delta));
}

// 방치 부식 계산. state: {rating, peak, lastPlayed, lastDecay}
// 반환: 새로 적용할 부식량 (양수)
export function pendingDecay(disc, now = Date.now()) {
  if (!disc.lastPlayed) return 0;
  if ((disc.sessions || 0) < DECAY_MIN_SESSIONS) return 0;
  const graceEnd = disc.lastPlayed + DECAY_GRACE_H * 3600 * 1000;
  if (now <= graceEnd) return 0;
  const from = Math.max(graceEnd, disc.lastDecay || 0);
  const days = (now - from) / (24 * 3600 * 1000);
  if (days <= 0) return 0;
  const raw = Math.floor(days * DECAY_PER_DAY);
  const floor = Math.max(START_RATING - 150, (disc.peak || disc.rating) - DECAY_FLOOR_GAP);
  const maxLoss = Math.max(0, disc.rating - floor);
  return Math.min(raw, maxLoss);
}

// 부식까지 남은 시간(ms). 이미 부식 중이면 0
export function timeToDecay(disc, now = Date.now()) {
  if (!disc.lastPlayed) return Infinity;
  if ((disc.sessions || 0) < DECAY_MIN_SESSIONS) return Infinity;
  return Math.max(0, disc.lastPlayed + DECAY_GRACE_H * 3600 * 1000 - now);
}
