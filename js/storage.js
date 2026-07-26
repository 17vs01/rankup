// localStorage 기반 상태 저장
import { START_RATING, pendingDecay } from './rating.js';

const KEY = 'rankup-state-v1';

const DISC_IDS = [
  'math', 'vocab', 'memory', 'focus',
  'unpredict', 'chrono', 'compass', 'eyeball',
  'sudoku', 'chain', 'calib', 'metamem', 't24',
];

function freshDisc() {
  return {
    rating: START_RATING,
    peak: START_RATING,
    lastPlayed: 0,
    lastDecay: 0,
    sessions: 0,
    best: 0, // 종목별 최고 점수
  };
}

function freshState() {
  const disc = {};
  for (const id of DISC_IDS) disc[id] = freshDisc();
  return {
    disc,
    vocab: {},          // wordIdx -> { box, due } 라이트너 박스
    sudoku: null,       // 진행 중인 스도쿠 판 (이어하기)
    theme: 'onyx',      // 화면 테마
    totalSessions: 0,
    streak: 0,
    lastStreakDay: '',
    history: [],        // 최근 세션 기록 (최대 50)
  };
}

export function loadState() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch { s = null; }
  if (!s || !s.disc) s = freshState();
  for (const id of DISC_IDS) if (!s.disc[id]) s.disc[id] = freshDisc();
  if (!s.vocab) s.vocab = {};
  if (s.sudoku === undefined) s.sudoku = null;
  if (!s.theme) s.theme = 'onyx';
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

  // 스트릭
  const today = dayKey();
  if (s.lastStreakDay !== today) {
    const yesterday = dayKey(Date.now() - 24 * 3600 * 1000);
    s.streak = (s.lastStreakDay === yesterday) ? s.streak + 1 : 1;
    s.lastStreakDay = today;
  }

  s.history.unshift({ t: Date.now(), discId, score, delta, perf: Math.round(perf * 100) / 100 });
  if (s.history.length > 50) s.history.length = 50;
  saveState(s);
  return { newRecord };
}
