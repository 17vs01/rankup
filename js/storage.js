// localStorage 기반 상태 저장
import { START_RATING, pendingDecay } from './rating.js';

const KEY = 'rankup-state-v1';

// 랭크 종목. 스도쿠는 여기 없다 — 랭크 밖 별관이라 LP·부식·리그와 무관하다.
const DISC_IDS = [
  'math', 'lexi', 'anagram', 'compare', 'memory', 'simon', 'focus', 'schulte',
  'unpredict', 'chrono', 'compass', 'eyeball',
  't24',
];

// 스도쿠 난이도 (별관 해금 순서). sudoku.js의 LEVELS와 이름이 같아야 한다.
const SUDOKU_ORDER = ['쉬움', '보통', '어려움', '전문가', '마스터', '극한'];

// 레이팅은 조합(variant) 단위로 산다.
// 어휘력의 "우리말만"과 "통합"은 판이 아예 달라서 실력도 따로 재야 한다.
// 고를 게 없는 종목은 기본 조합('') 하나만 갖는다.
export function freshVariant() {
  return {
    rating: START_RATING,
    peak: START_RATING,
    lastPlayed: 0,
    lastDecay: 0,
    sessions: 0,
    best: 0,     // 이 조합 최고 점수
    last: 0,     // 이 조합 최근 점수
    lp: 0,       // 이 조합에서 딴 누적 LP
  };
}

// 종목(disc)의 값들은 조합에서 파생된다 — 홈 목록·종합 평균·오늘의 훈련용.
function freshDisc() {
  return {
    rating: START_RATING,
    peak: START_RATING,
    lastPlayed: 0,
    lastDecay: 0,
    sessions: 0,
    best: 0,      // 종목 전체 최고 점수 (조합 중 가장 높은 값)
    records: {},  // 최단 시간 기록. key -> 값(초 또는 ms), 낮을수록 좋음
    variants: {}, // 조합 key -> freshVariant()
  };
}

/** 조합을 꺼낸다. 없으면 만든다. */
export function getVariant(d, key) {
  if (!d.variants) d.variants = {};
  const k = key || '';
  if (!d.variants[k]) d.variants[k] = freshVariant();
  return d.variants[k];
}

/** 조합들로부터 종목 값을 다시 계산한다. 레이팅은 판수 가중 평균. */
export function recomputeDisc(d) {
  const vs = Object.values(d.variants || {}).filter(v => v.sessions > 0);
  if (!vs.length) return;
  const total = vs.reduce((a, v) => a + v.sessions, 0);
  // 가중 평균이라 새 조합을 한 판 해봤다고 종목 레이팅이 훅 떨어지지 않는다
  d.rating = Math.round(vs.reduce((a, v) => a + v.rating * v.sessions, 0) / total);
  d.peak = Math.max(d.peak || 0, ...vs.map(v => v.peak || 0));
  d.lastPlayed = Math.max(0, ...vs.map(v => v.lastPlayed || 0));
  d.sessions = total;
  d.best = Math.max(0, ...vs.map(v => v.best || 0));
}

function freshState() {
  const disc = {};
  for (const id of DISC_IDS) disc[id] = freshDisc();
  return {
    disc,
    vocab: {},          // wordIdx -> { box, due } 라이트너 박스 (영어)
    korvocab: {},       // 같은 구조 (한국어)
    sudoku: null,       // 진행 중인 스도쿠 판 (이어하기)
    // 스도쿠 별관 진행. 랭크와 완전히 분리된 자체 해금·기록.
    sudokuProg: { unlocked: 1, recs: {}, plays: 0, clears: 0 },
    theme: 'onyx',      // 화면 테마
    seenRules: {},      // gameId -> 1, 방법 화면을 본 종목
    modes: {},          // gameId -> 마지막으로 고른 모드 id
    totalSessions: 0,
    streak: 0,
    lastStreakDay: '',
    freeze: 0,          // 스트릭 보호권 (7일 연속마다 +1, 최대 2)
    freezeAt: 0,        // 마지막으로 보호권을 준 스트릭 값 (중복 지급 방지)
    daily: null,        // 오늘의 훈련 { day, ids[], done[] }
    week: null,         // 이번 주 { key, lp, sessions }
    onboarded: 0,       // 첫 실행 안내를 봤는가
    history: [],        // 최근 세션 기록 (최대 120)
  };
}

export function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { s = null; }
  if (!s || !s.disc) s = freshState();
  // 이관: 어휘(vocab) + 우리말(korvocab) → 어휘력(lexi)으로 통합.
  // 기존 두 종목의 LP를 판수 가중 평균으로 물려받는다. 라이트너 데이터
  // (s.vocab / s.korvocab)는 lexi가 그대로 이어 쓴다.
  if (!s.disc.lexi && s.disc.vocab && s.disc.korvocab
    && (s.disc.vocab.sessions > 0 || s.disc.korvocab.sessions > 0)) {
    const a = s.disc.vocab, b = s.disc.korvocab;
    const w = Math.max(1, (a.sessions || 0) + (b.sessions || 0));
    s.disc.lexi = {
      rating: Math.round(((a.rating || START_RATING) * (a.sessions || 0)
        + (b.rating || START_RATING) * (b.sessions || 0)) / w) || START_RATING,
      peak: Math.max(a.peak || START_RATING, b.peak || START_RATING),
      lastPlayed: Math.max(a.lastPlayed || 0, b.lastPlayed || 0),
      lastDecay: Math.max(a.lastDecay || 0, b.lastDecay || 0),
      sessions: (a.sessions || 0) + (b.sessions || 0),
      best: Math.max(a.best || 0, b.best || 0),
      records: {},
    };
  }
  // 예전 저장본·불완전한 백업 파일 모두 여기서 보강한다.
  // 필드 하나가 빠져도 NaN 오염이나 크래시 없이 새 값으로 채워져야 한다.
  const num = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) ? v : dflt);

  // 이관: 스도쿠를 랭크 종목에서 별관으로 옮긴다.
  // LP는 버리고(랭크 밖이라 의미가 없다) 난이도별 최단 기록과 판수만 물려받는다.
  // 이미 깬 난이도는 그대로 해금된 상태로 시작한다.
  if (!s.sudokuProg || typeof s.sudokuProg !== 'object') {
    const old = s.disc && s.disc.sudoku;
    const recs = {};
    if (old && old.records) {
      for (const name of SUDOKU_ORDER) {
        const v = old.records['time_' + name];
        if (typeof v === 'number' && Number.isFinite(v)) recs[name] = v;
      }
    }
    // 깬 난이도의 다음 단계까지 열어준다 (앞에서부터 연속으로)
    let unlocked = 1;
    for (let i = 0; i < SUDOKU_ORDER.length; i++) {
      if (recs[SUDOKU_ORDER[i]] === undefined) break;
      unlocked = Math.min(SUDOKU_ORDER.length, i + 2);
    }
    s.sudokuProg = {
      unlocked,
      recs,
      plays: old ? num(old.sessions, 0) : 0,
      clears: Object.keys(recs).length,
    };
  }
  const sp = s.sudokuProg;
  sp.unlocked = Math.max(1, Math.min(SUDOKU_ORDER.length, num(sp.unlocked, 1)));
  sp.plays = num(sp.plays, 0);
  sp.clears = num(sp.clears, 0);
  if (!sp.recs || typeof sp.recs !== 'object') sp.recs = {};
  if (s.disc) delete s.disc.sudoku;   // 랭크 목록에서 완전히 뺀다
  for (const id of DISC_IDS) {
    if (!s.disc[id]) s.disc[id] = freshDisc();
    const d = s.disc[id];
    d.rating = num(d.rating, START_RATING);
    d.peak = Math.max(num(d.peak, d.rating), d.rating);
    d.lastPlayed = num(d.lastPlayed, 0);
    d.lastDecay = num(d.lastDecay, 0);
    d.sessions = num(d.sessions, 0);
    d.best = num(d.best, 0);
    if (!d.records || typeof d.records !== 'object') d.records = {};
    if (!d.variants || typeof d.variants !== 'object') d.variants = {};

    // 이관: 레이팅을 종목에서 조합으로 내린다.
    // ① 조합 기록만 있던 저장본(plays/best/last/lp)은 종목 레이팅을 시작점으로 물려받는다.
    // ② 조합이 아예 없던 저장본은 기본 조합('') 하나로 옮긴다.
    const vals = Object.values(d.variants);
    const needsMigrate = vals.length > 0 && vals.some(v => v && typeof v.rating !== 'number');
    if (needsMigrate) {
      for (const [k, v] of Object.entries(d.variants)) {
        const plays = num(v && v.plays, 0);
        d.variants[k] = {
          ...freshVariant(),
          // 조합별 실력을 따로 잰 적이 없으니 종목 레이팅에서 함께 출발한다
          rating: d.rating, peak: d.peak,
          lastPlayed: plays > 0 ? d.lastPlayed : 0,
          lastDecay: plays > 0 ? d.lastDecay : 0,
          sessions: plays,
          best: num(v && v.best, 0),
          last: num(v && v.last, 0),
          lp: num(v && v.lp, 0),
        };
      }
      // 조합에 안 잡힌 지난 판들은 기본 조합으로 몰아둔다
      const counted = Object.values(d.variants).reduce((a, v) => a + v.sessions, 0);
      if (d.sessions > counted) {
        d.variants[''] = {
          ...freshVariant(),
          rating: d.rating, peak: d.peak,
          lastPlayed: d.lastPlayed, lastDecay: d.lastDecay,
          sessions: d.sessions - counted, best: d.best,
        };
      }
    } else if (!vals.length && d.sessions > 0) {
      d.variants[''] = {
        ...freshVariant(),
        rating: d.rating, peak: d.peak,
        lastPlayed: d.lastPlayed, lastDecay: d.lastDecay,
        sessions: d.sessions, best: d.best,
      };
    }
    // 필드가 깨진 조합 보강
    for (const v of Object.values(d.variants)) {
      v.rating = num(v.rating, START_RATING);
      v.peak = Math.max(num(v.peak, v.rating), v.rating);
      v.lastPlayed = num(v.lastPlayed, 0);
      v.lastDecay = num(v.lastDecay, 0);
      v.sessions = num(v.sessions, 0);
      v.best = num(v.best, 0);
      v.last = num(v.last, 0);
      v.lp = num(v.lp, 0);
    }
    recomputeDisc(d);
  }
  if (!s.vocab) s.vocab = {};
  if (!s.korvocab) s.korvocab = {};
  if (s.sudoku === undefined) s.sudoku = null;
  if (!s.theme) s.theme = 'onyx';
  if (!s.seenRules) s.seenRules = {};
  if (!s.modes) s.modes = {};
  s.totalSessions = num(s.totalSessions, 0);
  s.streak = num(s.streak, 0);
  s.freeze = Math.max(0, Math.min(2, num(s.freeze, 0)));
  s.freezeAt = num(s.freezeAt, 0);
  s.onboarded = num(s.onboarded, 0);
  if (typeof s.lastStreakDay !== 'string') s.lastStreakDay = '';
  if (!Array.isArray(s.history)) s.history = [];
  if (s.daily && (typeof s.daily !== 'object' || !Array.isArray(s.daily.ids))) s.daily = null;
  if (s.daily && !Array.isArray(s.daily.done)) s.daily.done = [];
  if (s.week && (typeof s.week !== 'object' || typeof s.week.key !== 'string')) s.week = null;
  if (s.week) { s.week.lp = num(s.week.lp, 0); s.week.sessions = num(s.week.sessions, 0); }
  return s;
}

export function saveState(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// 부식을 지연 적용하고 적용된 총량 반환.
// 조합마다 따로 썩는다 — 통합만 계속 하면 "우리말만"이 조용히 줄어든다.
export function applyDecay(s) {
  const now = Date.now();
  let total = 0;
  const details = [];
  for (const id of DISC_IDS) {
    const d = s.disc[id];
    let discLoss = 0;
    const hit = [];   // 어느 조합이 얼마나 줄었는지 — 알림에서 이름을 부르려고
    for (const [key, v] of Object.entries(d.variants || {})) {
      const loss = pendingDecay(v, now);
      if (loss > 0) {
        v.rating -= loss;
        v.lastDecay = now;
        discLoss += loss;
        hit.push({ key, loss });
      }
    }
    if (discLoss > 0) {
      recomputeDisc(d);
      total += discLoss;
      details.push({ id, loss: discLoss, variants: hit });
    }
  }
  if (total > 0) saveState(s);
  return details;
}

function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// 오늘 뭔가 했다고 표시한다. 하루를 건너뛰었어도 보호권(freeze)이 있으면
// 하나 쓰고 이어간다. 랭크 종목과 스도쿠 별관 양쪽에서 부른다 —
// 스트릭은 "오늘 앱을 열고 뭔가 했는가"의 지표라 별관도 인정한다.
export function touchStreak(s) {
  const today = dayKey();
  if (s.lastStreakDay === today) return { changed: false, freezeUsed: false };
  const yesterday = dayKey(Date.now() - 24 * 3600 * 1000);
  const dayBefore = dayKey(Date.now() - 48 * 3600 * 1000);
  let freezeUsed = false;
  if (s.lastStreakDay === yesterday) {
    s.streak = s.streak + 1;
  } else if (s.lastStreakDay === dayBefore && (s.freeze || 0) > 0) {
    s.freeze--;                 // 딱 하루 빠진 것만 메워준다
    s.streak = s.streak + 1;
    freezeUsed = true;
  } else {
    s.streak = 1;
  }
  s.lastStreakDay = today;
  return { changed: true, freezeUsed };
}

// 스도쿠 별관 한 판 기록. LP·부식·리그와 무관하고 해금과 최단 기록만 다룬다.
// 반환: { isNew, prev, unlockedName } — 신기록 여부와 이번에 열린 난이도
export function recordSudoku(s, levelName, { solved, sec }) {
  const p = s.sudokuProg;
  p.plays++;
  let isNew = false, prev, unlockedName = null;
  if (solved) {
    p.clears++;
    prev = p.recs[levelName];
    if (prev === undefined || sec < prev) { p.recs[levelName] = sec; isNew = true; }
    const i = SUDOKU_ORDER.indexOf(levelName);
    // 깬 난이도의 바로 다음 단계를 연다 (건너뛰기는 없다)
    if (i >= 0 && i + 1 < SUDOKU_ORDER.length && p.unlocked === i + 1) {
      p.unlocked = i + 2;
      unlockedName = SUDOKU_ORDER[i + 1];
    }
  }
  touchStreak(s);
  saveState(s);
  return { isNew, prev, unlockedName };
}

// 세션 종료 기록. 레이팅은 이번에 고른 조합(variantKey)에만 붙는다.
export function recordSession(s, discId, variantKey, { score, delta, perf }) {
  const d = s.disc[discId];
  const v = getVariant(d, variantKey);
  v.rating = Math.max(600, v.rating + delta);
  v.peak = Math.max(v.peak, v.rating);
  v.lastPlayed = Date.now();
  v.lastDecay = 0;
  v.sessions++;
  v.last = score;
  v.lp += delta;
  // 첫 판은 무조건 최고기록이 되므로 트로피는 두 번째 판부터
  const newRecord = score > v.best && v.sessions > 1;
  if (score > v.best) v.best = score;
  recomputeDisc(d);
  s.totalSessions++;

  const { freezeUsed } = touchStreak(s);

  s.history.unshift({
    t: Date.now(), discId, vk: variantKey || '', score, delta,
    perf: Math.round(perf * 100) / 100,
    r: v.rating,   // 그때의 조합 레이팅 — 주간 추이 그래프용
  });
  if (s.history.length > 120) s.history.length = 120;
  saveState(s);
  return { newRecord, freezeUsed, variant: v };
}
