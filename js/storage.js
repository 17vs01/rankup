// localStorage 기반 상태 저장
import { START_RATING, pendingDecay } from './rating.js';

const KEY = 'rankup-state-v1';

const DISC_IDS = [
  'math', 'lexi', 'memory', 'focus',
  'unpredict', 'chrono', 'compass', 'eyeball',
  'sudoku', 'chain', 't24',
];

function freshDisc() {
  return {
    rating: START_RATING,
    peak: START_RATING,
    lastPlayed: 0,
    lastDecay: 0,
    sessions: 0,
    best: 0,      // 종목별 최고 점수
    records: {},  // 최단 시간 기록. key -> 값(초 또는 ms), 낮을수록 좋음
  };
}

function freshState() {
  const disc = {};
  for (const id of DISC_IDS) disc[id] = freshDisc();
  return {
    disc,
    vocab: {},          // wordIdx -> { box, due } 라이트너 박스 (영어)
    korvocab: {},       // 같은 구조 (한국어)
    sudoku: null,       // 진행 중인 스도쿠 판 (이어하기)
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

// 부식을 지연 적용하고 적용된 총량 반환
export function applyDecay(s) {
  const now = Date.now();
  let total = 0;
  const details = [];
  for (const id of DISC_IDS) {
    const d = s.disc[id];
    const loss = pendingDecay(d, now);
    if (loss > 0) {
      d.rating -= loss;
      d.lastDecay = now;
      total += loss;
      details.push({ id, loss });
    }
  }
  if (total > 0) saveState(s);
  return details;
}

function dayKey(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// 세션 종료 기록
export function recordSession(s, discId, { score, delta, perf }) {
  const d = s.disc[discId];
  d.rating = Math.max(600, d.rating + delta);
  d.peak = Math.max(d.peak, d.rating);
  d.lastPlayed = Date.now();
  d.lastDecay = 0;
  d.sessions++;
  // 첫 판은 무조건 최고기록이 되므로 트로피는 두 번째 판부터
  const newRecord = score > d.best && d.sessions > 1;
  if (score > d.best) d.best = score;
  s.totalSessions++;

  // 스트릭. 하루를 건너뛰었어도 보호권(freeze)이 있으면 하나 쓰고 이어간다.
  const today = dayKey();
  let freezeUsed = false;
  if (s.lastStreakDay !== today) {
    const yesterday = dayKey(Date.now() - 24 * 3600 * 1000);
    const dayBefore = dayKey(Date.now() - 48 * 3600 * 1000);
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
  }

  s.history.unshift({
    t: Date.now(), discId, score, delta,
    perf: Math.round(perf * 100) / 100,
    r: d.rating,   // 그때의 레이팅 — 주간 추이 그래프용
  });
  if (s.history.length > 120) s.history.length = 120;
  saveState(s);
  return { newRecord, freezeUsed };
}
