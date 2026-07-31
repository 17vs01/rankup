import {
  loadState, saveState, applyDecay, recordSession, recordSudoku, getVariant,
} from './storage.js';
import { tierOf, tierProgress, ratingDelta, timeToDecay, TIERS } from './rating.js';
import { sfx } from './audio.js';
import { exportState, readBackup, fmtDate } from './backup.js';
import { RULES } from './rules.js';
import { seededRandom, seedFor, dailyChallengeId } from './daily.js';
import {
  initPlatform, inToss, getNickname, setLocalNickname, canEditNickname,
  submitScore, openLeaderboard, hasLeaderboard, onBack,
  getLeaderboardInfo,
} from './platform.js';
import { mathGame } from './games/math.js';
import { lexiGame } from './games/lexi.js';
import { memoryGame } from './games/memory.js';
import { focusGame } from './games/focus.js';
import { unpredictGame } from './games/unpredict.js';
import { chronoGame } from './games/chrono.js';
import { compassGame } from './games/compass.js';
import { eyeballGame } from './games/eyeball.js';
import { sudokuGame, SUDOKU_LEVELS } from './games/sudoku.js';
import { t24Game } from './games/t24.js';

// 랭크 종목. 스도쿠는 여기 없다 — 한 판 5~20분이라 "60초 랭크전"의 LP 경제와
// 맞지 않아 랭크 밖 별관으로 뺐다 (아래 '스도쿠 별관' 참고).
const GAMES = [
  lexiGame, mathGame, memoryGame, focusGame,
  unpredictGame, chronoGame, compassGame, eyeballGame,
  t24Game,
];
const $ = sel => document.querySelector(sel);

let state = loadState();
let activeTimers = [];    // 세션 중 타이머 (중단 시 정리)
let sessionTimer = null;  // 카운트다운 인터벌
let currentGame = null;
let sessionActive = false;
let sessionToken = 0;
let currentCtx = null;
let dailyMode = false;   // 이번 판이 데일리 챌린지인가

// ---------- 화면 전환 ----------
// 전환 직후 짧게 입력을 막는다. 게임 마지막 탭이 결과 화면 버튼으로 새는
// tap-through(모바일에서 흔함)를 방지.
let inputLockedUntil = 0;
const LOCK_MS = 350;

function locked() { return performance.now() < inputLockedUntil; }

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  inputLockedUntil = performance.now() + LOCK_MS;
}

// 전환 직후 도착한 포인터/클릭 이벤트를 캡처 단계에서 삼킨다
for (const type of ['pointerdown', 'click']) {
  document.addEventListener(type, e => {
    if (locked()) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}

// ---------- 홈 ----------
function fmtRemain(ms) {
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}일`;
  if (h >= 1) return `${h}시간`;
  return `${Math.max(1, Math.floor(ms / 60000))}분`;
}

const nf = n => n.toLocaleString('ko-KR');

// 시간 기록을 가진 종목과 표시 이름
const TIME_RECORDS = {
  // order 각 행은 [키, 라벨, 단위?]. 단위를 생략하면 spec.unit을 쓴다.
  t24:     { unit: 'sec', title: '내 기록', order: [['time_one', '한 문제 최단'], ['time_all', '5문제 전체 최단'], ['level_max', '타임어택 최고', 'level']] },
  focus:   { unit: 'ms',  title: '최고 기록', order: [['time_reaction', '반응속도'], ['focus_level', '3종목 레벨', 'level']] },
  memory:  { unit: 'cells', title: '내 기록', order: [['memory_cells', '최고 칸수']] },
  unpredict: { unit: 'count', title: '내 기록', order: [['ai_rate_min', '최저 AI 적중률', 'pct'], ['evade_best', '최다 연속 회피']] },
};

// 홈 목록 한 줄에 넣을 대표 기록 (가장 어려운 난이도 우선)
function bestRecordOf(gameId) {
  const spec = TIME_RECORDS[gameId];
  if (!spec) return null;
  const recs = state.disc[gameId].records || {};
  for (let i = spec.order.length - 1; i >= 0; i--) {
    const [key, label, unit] = spec.order[i];
    if (recs[key] !== undefined) return `${label} ${fmtDur(recs[key], unit || spec.unit)}`;
  }
  return null;
}

// 아래에 내용이 더 있으면 페이드를 띄운다. 끝까지 내리면 감춘다.
function updateScrollHint() {
  const el = $('#home-scroll');
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
  const noOverflow = el.scrollHeight <= el.clientHeight + 6;
  $('#scroll-fade').classList.toggle('off', atBottom || noOverflow);
}
$('#home-scroll').addEventListener('scroll', updateScrollHint, { passive: true });
window.addEventListener('resize', updateScrollHint);

function renderHome() {
  const decayed = applyDecay(state);
  const now = Date.now();

  // ----- 종합: 전 종목 평균을 한 줄로 -----
  const avg = Math.round(GAMES.reduce((a, g) => a + state.disc[g.id].rating, 0) / GAMES.length);
  const avgTier = tierOf(avg);
  const nextTier = TIERS[avgTier.idx + 1];
  $('#ov-tier').textContent = avgTier.name;
  $('#ov-tier').style.color = avgTier.color;
  $('#ov-lp').textContent = nf(avg);
  $('#ov-bar').style.width = (tierProgress(avg) * 100) + '%';
  $('#ov-bar').style.background = avgTier.color;
  $('#ov-streak').textContent = state.streak > 0 ? `${state.streak}일 연속` : '';
  $('#ov-meta').textContent = state.totalSessions === 0
    ? `${GAMES.length}종목 · 아무거나 한 판 해보세요`
    : nextTier
      ? `${GAMES.length}종목 평균 · ${nextTier.name}까지 ${nf(nextTier.min - avg)}`
      : `${GAMES.length}종목 평균 · 최고 티어`;

  // ----- 랭킹 카드 -----
  refreshRankCard();

  // ----- 부식 알림: 붉은 상자 대신 조용한 한 줄 -----
  const $notice = $('#notice');
  if (decayed.length > 0) {
    const names = decayed.map(dd => {
      const g = GAMES.find(x => x.id === dd.id);
      // 어느 조합이 줄었는지까지 — 종목 이름만으로는 뭘 눌러야 할지 모른다
      const vs = (dd.variants || []).filter(v => v.key).map(v => variantLabelOf(g, v.key));
      return `${g.name}${vs.length ? `(${vs.join(', ')})` : ''} −${dd.loss}`;
    }).join(', ');
    $notice.textContent = `쉬는 동안 LP가 줄었어요 · ${names}`;
    $notice.classList.remove('hidden');
  } else {
    $notice.classList.add('hidden');
  }

  // ----- 오늘의 훈련: 3종목을 골라준다 -----
  const plan = todayPlan();
  const doneN = plan.done.length;
  $('#daily-count').textContent = doneN >= plan.ids.length
    ? '완주 ✓' : `${doneN} / ${plan.ids.length}`;
  $('#daily-count').classList.toggle('done', doneN >= plan.ids.length);

  const $dl = $('#daily-list');
  $dl.innerHTML = '';
  for (const id of plan.ids) {
    const g = GAMES.find(x => x.id === id);
    const d = state.disc[id];
    const done = plan.done.includes(id);
    const note = decayNote(g, d, now);
    const why = d.sessions === 0 ? '아직 안 해본 종목'
      : (note && note.urgent) ? note.text
      : '평균보다 뒤처져 있어요';
    const b = document.createElement('button');
    b.className = 'daily-item' + (done ? ' done' : '');
    b.innerHTML = `
      <span class="di-check">${done ? '✓' : ''}</span>
      <span class="di-icon">${g.icon}</span>
      <span class="di-main">
        <span class="di-name">${g.name}</span>
        <span class="di-why">${done ? '완료' : why}</span>
      </span>`;
    b.addEventListener('click', () => startSession(g));
    $dl.appendChild(b);
  }

  // ----- 오늘의 도전: 날짜 시드라 전 유저가 같은 문제를 푼다 -----
  const chId = dailyChallengeId(dayKeyOf(), GAMES);
  const chGame = chId && GAMES.find(g => g.id === chId);
  const $ch = $('#btn-challenge');
  if (chGame) {
    const cleared = state.daily && state.daily.challenge === chId;
    $('#challenge-name').textContent = `${chGame.icon} ${chGame.name}`;
    $('#challenge-desc').textContent = cleared
      ? '오늘 도전 완료 · 다시 풀어도 같은 문제예요'
      : '모두가 똑같은 문제를 풉니다';
    $ch.classList.toggle('done', !!cleared);
    $ch.onclick = () => startSession(chGame, false, false, true);
    $ch.classList.remove('hidden');
  } else {
    $ch.classList.add('hidden');
  }

  // 완주했으면 "이어서 하기"로 다음 판을 권한다. 아니면 감춘다.
  const $quick = $('#btn-quick');
  if (doneN >= plan.ids.length) {
    const urgent = GAMES.slice().sort((a, b) =>
      (state.disc[a.id].lastPlayed || 0) - (state.disc[b.id].lastPlayed || 0))[0];
    $('#cta-kicker').textContent = '오늘 몫 완주 · 한 판 더';
    $('#cta-name').textContent = `${urgent.icon}  ${urgent.name}`;
    $quick.onclick = () => startSession(urgent);
    $quick.classList.remove('hidden');
  } else {
    $quick.classList.add('hidden');
  }

  // ----- 목록 -----
  const played = GAMES.filter(g => state.disc[g.id].sessions > 0).length;
  $('#list-count').textContent = played < GAMES.length
    ? `${GAMES.length}개 · ${GAMES.length - played}개 미플레이`
    : `${GAMES.length}개`;

  const $list = $('#list');
  $list.innerHTML = '';
  for (const g of GAMES) {
    const d = state.disc[g.id];
    const t = tierOf(d.rating);
    // 경고는 조합 단위다 — 어느 조합이 녹슬고 있는지까지 말해준다
    const note = decayNote(g, d, now);
    const warn = !!(note && note.urgent);

    // 안 해본 종목만 설명을 보여준다. 해본 뒤엔 군더더기가 된다.
    // 시간 기록이 있는 종목은 최고 기록을 보여준다 (더 자랑스러운 숫자)
    const rec = bestRecordOf(g.id);
    const sub = d.sessions === 0 ? g.desc
      : warn ? note.text
      : rec ? `${d.sessions}판 · ⏱ ${rec}`
      : `${d.sessions}판 · 최고 ${nf(d.best)}`;

    const row = document.createElement('button');
    row.className = 'row';
    row.style.color = t.color;
    row.innerHTML = `
      <span class="row-icon">${g.icon}</span>
      <span class="row-main">
        <span class="row-name" style="color:var(--text)">${g.name}${d.sessions === 0 ? '<i class="row-new">NEW</i>' : ''}</span>
        <span class="row-sub${warn ? ' row-warn' : ''}">${sub}</span>
      </span>
      <span class="row-right">
        <span class="row-tier" style="color:${t.color}">${t.name}</span>
        <span class="row-lp">${nf(d.rating)}</span>
      </span>
      <span class="row-info" data-info="${g.id}" role="button" aria-label="게임 방법">?</span>
    `;
    // 행 아래 1px 선의 길이 = 다음 티어까지의 진행도
    row.style.setProperty('--prog', (tierProgress(d.rating) * 100) + '%');
    row.addEventListener('click', e => {
      // ⓘ는 시작이 아니라 방법 화면으로
      if (e.target.closest('.row-info')) { showRules(g); return; }
      startSession(g);
    });
    $list.appendChild(row);
  }

  // ----- 별관: 스도쿠 (랭크 밖) -----
  const sp = state.sudokuProg;
  const saved = sudokuSaved();
  $('#sudoku-sub').textContent = saved
    ? `이어하기 · ${saved.level} · ${fmtDur(Math.round(saved.elapsed || 0), 'sec')} 경과`
    : sp.plays === 0
      ? '9×9 클래식 · 쉬움부터 하나씩 열어가세요'
      : `${sp.unlocked}/${SUDOKU_LEVELS.length}단계 열림 · ${nf(sp.plays)}판`;

  show('#screen-home');
  // 화면을 띄운 뒤에 재야 한다. display:none 상태에서는 높이가 0이라
  // "넘칠 게 없다"고 잘못 판단해 스크롤 신호가 사라진다.
  requestAnimationFrame(updateScrollHint);
}

// ---------- 오늘의 훈련 ----------
// 매일 3종목을 골라준다. 목록 11개 앞에서 "뭘 하지"를 고민하지 않게 하는 게 목적.
// 고르는 기준: ① 이미 LP가 줄고 있거나 곧 줄 종목 ② 아직 안 해본 종목
// ③ 평균보다 뒤처진 종목. 날짜가 바뀌면 다시 뽑는다.
const DAILY_N = 3;

function dayKeyOf(t = Date.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function pickDaily() {
  const now = Date.now();
  const avg = GAMES.reduce((a, g) => a + state.disc[g.id].rating, 0) / GAMES.length;
  const scored = GAMES.map(g => {
    const d = state.disc[g.id];
    // 급한 정도는 조합 단위로 잰다 (통합만 계속 해도 "우리말만"이 녹슬 수 있다)
    const u = urgentVariant(d, now);
    const ttd = u ? u.ttd : Infinity;
    let s = 0;
    if (ttd <= 0) s += 100;                        // 지금 줄고 있다
    else if (ttd < 12 * 3600 * 1000) s += 60;      // 곧 준다
    if (d.sessions === 0) s += 45;                                  // 아직 안 해봤다
    s += Math.max(0, (avg - d.rating) / 12);                        // 평균보다 뒤처진 만큼
    if (d.lastPlayed) s += Math.min(25, (now - d.lastPlayed) / (12 * 3600 * 1000) * 5);
    return { id: g.id, s };
  }).sort((a, b) => b.s - a.s);
  return scored.slice(0, DAILY_N).map(x => x.id);
}

// 오늘 몫을 읽는다. 날짜가 바뀌었으면 새로 뽑는다.
function todayPlan() {
  const key = dayKeyOf();
  if (!state.daily || state.daily.day !== key) {
    state.daily = { day: key, ids: pickDaily(), done: [] };
    saveState(state);
  }
  // 종목이 사라진 옛 저장본 방어
  state.daily.ids = state.daily.ids.filter(id => GAMES.some(g => g.id === id));
  if (state.daily.ids.length < DAILY_N) {
    state.daily.ids = pickDaily();
    saveState(state);
  }
  return state.daily;
}

// 한 판 끝날 때마다 오늘 몫에 체크
function markDaily(gameId) {
  const plan = todayPlan();
  if (plan.ids.includes(gameId) && !plan.done.includes(gameId)) {
    plan.done.push(gameId);
    return plan.done.length === plan.ids.length;   // 방금 완주했는가
  }
  return false;
}

// ---------- 주간 리그 ----------
// 토스 리더보드에 "평생 누적"을 올리면 상위권이 고착돼 새 유저가 포기한다.
// 그래서 이번 주에 딴 LP만 올린다. 월요일 04시(KST 기준 새벽)에 리셋.
function weekKeyOf(t = Date.now()) {
  const d = new Date(t);
  d.setHours(d.getHours() - 4);              // 새벽 4시를 하루의 시작으로
  const day = (d.getDay() + 6) % 7;          // 월=0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function weeklyBucket() {
  const key = weekKeyOf();
  if (!state.week || state.week.key !== key) state.week = { key, lp: 0, sessions: 0 };
  return state.week;
}

function addWeeklyLp(delta) {
  const w = weeklyBucket();
  w.lp += Math.max(0, delta);   // 잃은 LP까지 빼면 "안 하는 게 이득"이 된다
  w.sessions++;
}

function weeklyScore() { return weeklyBucket().lp; }

// ---------- 스트릭 프리즈 ----------
// 7일 연속마다 보호권 1개(최대 2개). 하루 빠지면 자동으로 하나 쓰고 스트릭을 지킨다.
// storage.recordSession이 스트릭을 올리므로, 여기서는 지급만 판단한다.
function grantFreezeIfDue() {
  if (state.streak > 0 && state.streak % 7 === 0 && state.freezeAt !== state.streak) {
    state.freezeAt = state.streak;
    state.freeze = Math.min(2, (state.freeze || 0) + 1);
    return true;
  }
  return false;
}

// ---------- 세션 ----------
function clearSession() {
  activeTimers.forEach(id => { clearTimeout(id); clearInterval(id); });
  activeTimers = [];
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
  sessionActive = false;
}

function makeCtx(game) {
  // 별관(스도쿠)은 랭크 종목이 아니라 state.disc 항목이 없다
  const d = state.disc[game.id] || null;
  // 난이도는 "이번에 고른 조합"의 실력을 따라간다.
  // 통합만 파고들었다고 "우리말만"까지 어려워지면 안 된다.
  const v = d ? getVariant(d, variantKeyOf(game)) : null;
  const token = ++sessionToken;   // 지난 세션의 콜백이 끼어드는 것 차단
  let finished = false;
  return {
    body: $('#game-body'),
    rating: v ? v.rating : 1000,
    state,
    // 데일리 챌린지면 모두가 같은 판을 받도록 시드 난수를 쓴다.
    // 게임이 ctx.rng()를 쓰면 자동으로 따라온다 (안 쓰면 평소처럼 무작위).
    daily: dailyMode,
    rng: dailyMode ? seededRandom(seedFor(dayKeyOf(), game.id)) : Math.random,
    // 모드가 있는 종목이면 지금 고른 모드 id (없으면 null)
    mode: game.modes ? (state.modes[game.id] || game.modes[0].id) : null,
    setTitle(t) { $('#game-title').textContent = t; },
    setTimerText(s) { $('#game-timer').textContent = s; },
    persist() { saveState(state); },
    // 스도쿠처럼 긴 판은 중단해도 진행이 남아야 한다.
    // 게임이 여기에 함수를 넣으면 ✕(중단) 직전에 호출된다.
    onAbort: null,
    delay(fn, ms) {
      const id = setTimeout(fn, ms);
      activeTimers.push(id);
      return id;
    },
    // 게임이 직접 만든 setInterval을 세션 종료 시 같이 정리하도록 맡긴다
    trackInterval(id) { activeTimers.push(id); return id; },
    // 흐르는 시간(카운트업). 제한시간이 없는 종목용.
    stopwatch(onTick) {
      if (sessionTimer) clearInterval(sessionTimer);
      const t0 = performance.now();
      const render = () => {
        const s = Math.floor((performance.now() - t0) / 1000);
        $('#game-timer').textContent =
          `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        if (onTick) onTick(s);
      };
      render();
      sessionTimer = setInterval(render, 1000);
      return () => Math.floor((performance.now() - t0) / 1000);
    },
    timer(seconds, onEnd) {
      if (sessionTimer) clearInterval(sessionTimer);
      let remain = seconds;
      const $t = $('#game-timer');
      const render = () => {
        $t.textContent = remain + 's';
        $t.classList.toggle('urgent', remain <= 10);
      };
      render();
      sessionTimer = setInterval(() => {
        remain--;
        render();
        if (remain <= 5 && remain > 0) sfx.tick();
        if (remain <= 0) {
          clearInterval(sessionTimer);
          sessionTimer = null;
          onEnd();
        }
      }, 1000);
    },
    finish(result) {
      if (finished || token !== sessionToken) return;
      finished = true;
      clearSession();
      if (result && result.annex) endAnnex(game, result);
      else endSession(game, result);
    },
  };
}

// 카운트다운 후 게임을 띄운다. 랭크 종목과 별관이 함께 쓴다.
function launch(game, quick, prepare) {
  clearSession();
  currentCtx = null;
  sessionActive = true;
  currentGame = game;
  $('#game-timer').textContent = '';
  $('#game-timer').classList.remove('urgent');
  const $body = $('#game-body');
  show('#screen-game');

  // 처음 보는 판은 3초 동안 한 줄 요약을 되새겨주고,
  // "한 판 더"처럼 이미 흐름을 타고 있을 때는 1초만 끊는다 (quick).
  let n = quick ? 1 : 3;
  const rule = RULES[game.id];
  $body.innerHTML = `<div class="countdown">${n}</div>`
    + (!quick && rule ? `<div class="countdown-summary">${rule.summary}</div>` : '');
  sfx.tick();
  const cd = setInterval(() => {
    n--;
    if (n > 0) {
      $body.querySelector('.countdown').textContent = n;
      sfx.tick();
    } else {
      clearInterval(cd);
      sfx.start();
      $body.innerHTML = '';
      currentCtx = makeCtx(game);
      if (prepare) prepare(currentCtx);
      game.run(currentCtx);
    }
  }, quick ? 600 : 800);
  activeTimers.push(cd);
}

// ---------- 게임 방법 ----------
// 방법 화면을 거쳐 시작할 때도 "오늘의 도전"이라는 의도가 유지돼야 한다
let pendingDaily = false;

function showRules(game) {
  const r = RULES[game.id];
  if (!r) { startSession(game, true); return; }
  $('#rules-icon').textContent = game.icon;
  $('#rules-name').textContent = game.name;
  $('#rules-summary').textContent = r.summary;
  $('#rules-steps').innerHTML = r.how.map(s => `<li>${s}</li>`).join('');
  $('#rules-scoring').textContent = r.scoring;
  $('#rules-tip').textContent = r.tip;
  $('#rules-note-sect').classList.toggle('hidden', !r.note);
  if (r.note) $('#rules-note').textContent = r.note;

  // 시간 기록이 있는 종목이면 지금까지의 최단 기록을 함께 보여준다.
  // 별관(스도쿠)은 state.disc 항목이 없어서 자체 기록을 쓴다.
  const spec = game.annex
    ? { unit: 'sec', title: '난이도별 최단 완주', order: SUDOKU_LEVELS.map(l => [l.name, l.name]) }
    : TIME_RECORDS[game.id];
  const recs = game.annex
    ? state.sudokuProg.recs
    : ((state.disc[game.id] && state.disc[game.id].records) || {});
  const rows = spec ? spec.order.filter(([k]) => recs[k] !== undefined) : [];
  $('#rules-rec-sect').classList.toggle('hidden', rows.length === 0);
  if (rows.length) {
    $('#rules-rec-head').textContent = spec.title;
    $('#rules-records').innerHTML = rows
      .map(([k, label, unit]) => `<div class="stat-row"><span>${label}</span><span>${fmtDur(recs[k], unit || spec.unit)}</span></div>`)
      .join('');
  }
  // 시작 영역: 픽커(고를 게 있는 종목) > 모드 버튼 > 그냥 시작하기
  const $modes = $('#rules-modes');
  $modes.innerHTML = '';
  if (game.annex) {
    // 별관은 난이도를 별관 화면에서 고른다
    $('#btn-rules-start').classList.remove('hidden');
    $('#btn-rules-start').textContent = '난이도 고르기';
    $('#btn-rules-start').onclick = renderSudoku;
  } else if (game.picker) {
    // 카운트다운 앞에서 고르게 한다 — 게임 안에서 고르면 긴장이 끊긴다
    $('#btn-rules-start').classList.add('hidden');
    game.picker(state, $modes, () => { saveState(state); startSession(game, true, false, pendingDaily); });
  } else if (game.modes && game.modes.length) {
    $('#btn-rules-start').classList.add('hidden');
    const cur = state.modes[game.id] || game.modes[0].id;
    for (const m of game.modes) {
      const b = document.createElement('button');
      b.className = 'mode-btn' + (m.id === cur ? ' on' : '');
      b.innerHTML = `<span class="mode-name">${m.name}</span><span class="mode-desc">${m.desc}</span>`;
      b.addEventListener('click', () => {
        state.modes[game.id] = m.id;
        saveState(state);
        startSession(game, true, false, pendingDaily);
      });
      $modes.appendChild(b);
    }
  } else {
    $('#btn-rules-start').classList.remove('hidden');
    $('#btn-rules-start').textContent = '시작하기';
    $('#btn-rules-start').onclick = () => startSession(game, true, false, pendingDaily);
  }

  $('#rules-scroll').scrollTop = 0;
  // 방법을 봤다고 기록 — 다음부터는 바로 시작
  if (!state.seenRules[game.id]) {
    state.seenRules[game.id] = 1;
    saveState(state);
  }
  show('#screen-rules');
}
$('#btn-rules-back').addEventListener('click', () => { pendingDaily = false; renderHome(); });

function startSession(game, skipRules = false, quick = false, daily = false) {
  if (sessionActive) return;   // 재진입 방지
  dailyMode = daily;
  // 처음 하는 종목은 방법부터 보여준다.
  // 고를 게 있는 종목(집중력·어휘력)은 매번 방법 화면의 픽커를 거친다.
  if (!skipRules && (!state.seenRules[game.id] || game.picker)) {
    pendingDaily = daily;      // 방법 화면을 거쳐도 도전 의도를 잃지 않게
    showRules(game);
    return;
  }
  pendingDaily = false;
  const modeId = game.modes ? (state.modes[game.id] || game.modes[0].id) : null;
  const modeName = modeId && game.modes.find(m => m.id === modeId);
  $('#game-title').textContent = `${game.icon} ${game.name}`
    + (modeName && modeName.id !== game.modes[0].id ? ` · ${modeName.name}` : '');
  launch(game, quick);
}

// 시간 표시: ms는 그대로, 초는 60초 넘으면 MM:SS
function fmtDur(v, unit) {
  if (unit === 'level') return Math.round(v) + '단계';
  if (unit === 'cells') return Math.round(v) + '칸';
  if (unit === 'count') return Math.round(v) + '연속';
  if (unit === 'pct') return Math.round(v) + '%';
  if (unit === 'ms') return Math.round(v) + 'ms';
  if (v < 10) return v.toFixed(1) + '초';
  // 먼저 초 단위로 반올림해야 "1:60" 같은 표기가 안 나온다
  const s = Math.round(v);
  if (s < 60) return s + '초';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 이 단위는 높을수록 좋은 기록이다 (나머지는 낮을수록)
const HIGHER_BETTER = new Set(['level', 'cells', 'count']);

// ---------- 조합별 기록 ----------
// 고를 게 있는 종목은 조합마다 판이 아예 다르다 (우리말만 vs 통합,
// 24 기본 vs 타임어택). 한 칸에 뭉뚱그리면 최고 점수가 서로 다른 걸 비교하게 된다.
function variantKeyOf(game) {
  if (game.variantKey) return game.variantKey(state);
  if (game.modes) return state.modes[game.id] || game.modes[0].id;
  return null;
}

function variantLabelOf(game, key) {
  if (game.variantLabel) return game.variantLabel(key);
  if (game.modes) {
    const m = game.modes.find(x => x.id === key);
    if (m) return m.name;
  }
  return key;
}

// 가장 급하게 녹슬고 있는 조합. 녹스는 조합이 하나도 없으면 null.
// 부식은 조합 단위로 도는데 경고가 종목 단위면 "어느 걸 눌러야 하나"를 모른다.
function urgentVariant(d, now = Date.now()) {
  let best = null;
  for (const [key, v] of Object.entries(d.variants || {})) {
    const ttd = timeToDecay(v, now);
    if (ttd === Infinity) continue;   // 안 해봤거나 아직 판수가 적은 조합
    if (!best || ttd < best.ttd) best = { key, v, ttd };
  }
  return best;
}

// 홈 목록·오늘의 훈련이 함께 쓰는 경고 문구. 조합 이름을 앞에 붙인다.
function decayNote(game, d, now = Date.now()) {
  const u = urgentVariant(d, now);
  if (!u) return null;
  const name = u.key ? `${variantLabelOf(game, u.key)} · ` : '';
  if (u.ttd <= 0) return { urgent: true, text: `${name}지금 LP가 줄고 있어요` };
  if (u.ttd < 12 * 3600 * 1000) return { urgent: true, text: `${name}${fmtRemain(u.ttd)} 뒤 LP 감소` };
  return { urgent: false, ttd: u.ttd };
}

// 표시 순서: 게임이 정한 순서 우선, 나머지는 판수 많은 순
function variantRows(game, d) {
  const vars = d.variants || {};
  const keys = Object.keys(vars).filter(k => vars[k] && vars[k].sessions > 0);
  if (!keys.length) return [];
  const order = game.variantOrder || (game.modes ? game.modes.map(m => m.id) : []);
  keys.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return vars[b].sessions - vars[a].sessions;
  });
  return keys.map(k => ({ key: k, label: variantLabelOf(game, k), ...vars[k] }));
}

// ---------- 결과 ----------
function endSession(game, result) {
  const d = state.disc[game.id];
  // 레이팅은 이번에 고른 조합의 것이다 (조합마다 독립)
  const vKey = variantKeyOf(game);
  const vLabel = vKey ? variantLabelOf(game, vKey) : null;
  const before = getVariant(d, vKey).rating;
  const beforeTier = tierOf(before);
  const delta = ratingDelta(result.perf);

  // 개인 기록. 게임이 result.time = {key, value, unit, label} 하나 또는
  // result.times = [...] 여러 개를 넘긴다. HIGHER_BETTER 단위만 높을수록 좋다.
  // recordSession이 저장하기 전에 반영해야 함께 저장된다.
  const recLines = [];
  if (!d.records) d.records = {};
  const timeList = (result.times || (result.time ? [result.time] : []))
    .filter(t => t && Number.isFinite(t.value));
  for (const t of timeList) {
    const higherBetter = HIGHER_BETTER.has(t.unit);
    const prev = d.records[t.key];
    const isNew = prev === undefined || (higherBetter ? t.value > prev : t.value < prev);
    if (isNew) d.records[t.key] = t.value;
    const mark = t.unit === 'sec' || t.unit === 'ms' ? '⏱' : '🏅';
    recLines.push(isNew
      ? `<div class="result-newrecord">${mark} ${t.label} 신기록 — ${fmtDur(t.value, t.unit)}${prev !== undefined ? ` (이전 ${fmtDur(prev, t.unit)})` : ''}</div>`
      : `<div class="result-best">${mark} ${t.label} ${fmtDur(t.value, t.unit)} · 기록 ${fmtDur(d.records[t.key], t.unit)}</div>`);
  }

  const { newRecord, variant } = recordSession(state, game.id, vKey,
    { score: result.score, delta, perf: result.perf });

  // 오늘의 훈련 진행 + 주간 획득 LP + 오늘의 도전 완료 표시
  const justFinishedDaily = markDaily(game.id);
  addWeeklyLp(delta);
  const plan = todayPlan();
  const wasChallenge = dailyMode;
  if (wasChallenge) plan.challenge = game.id;
  saveState(state);

  // 토스 안이면 이번 주 점수를 리더보드에 올린다 (실패해도 조용히 넘어간다)
  if (inToss()) submitScore(weeklyScore());
  const after = variant.rating;
  const afterTier = tierOf(after);
  const tierUp = afterTier.idx > beforeTier.idx;
  const tierDown = afterTier.idx < beforeTier.idx;

  if (tierUp) sfx.tierup();
  else sfx.finish();

  // 다음에 뭘 할지 여기서 이어준다 — 결과 화면이 막다른 길이 되지 않게.
  // 오늘 몫에 남은 게 있으면 그걸, 없으면 가장 급한 종목을.
  const remain = plan.ids.filter(id => !plan.done.includes(id) && id !== game.id);
  const nextGame = remain.length
    ? GAMES.find(g => g.id === remain[0])
    : GAMES.slice().filter(g => g.id !== game.id).sort((a, b) =>
      (state.disc[a.id].lastPlayed || 0) - (state.disc[b.id].lastPlayed || 0))[0];
  const nextWhy = remain.length ? '오늘의 훈련' : '가장 오래 쉬었어요';

  const dailyDone = plan.done.length >= plan.ids.length;
  const gotFreeze = grantFreezeIfDue();
  saveState(state);

  const $r = $('#result-body');
  $r.innerHTML = `
    <div class="result-game">${game.name}${vLabel ? ` · ${vLabel}` : ''}</div>
    <div class="result-score">${nf(result.score)}</div>
    <div class="result-detail">${result.detail}</div>
    ${recLines.join('')}
    ${newRecord ? `<div class="result-newrecord">${vLabel ? `🏅 ${vLabel} ` : ''}자기 최고 점수</div>` : ''}
    ${!newRecord && variant.sessions > 1
      ? `<div class="result-best">${vLabel ? vLabel + ' ' : ''}최고 ${nf(variant.best)} · ${nf(variant.sessions)}판</div>` : ''}
    <div class="result-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta)} LP</div>
    <div class="result-tier" style="color:${afterTier.color}">${afterTier.name} · ${nf(after)}</div>
    <div class="result-bar"><i style="width:${tierProgress(after) * 100}%;background:${afterTier.color}"></i></div>
    ${tierUp ? `<div class="result-tierup" style="color:${afterTier.color}">${afterTier.name} 승급</div>` : ''}
    ${tierDown ? `<div class="result-tierup" style="color:var(--bad)">${afterTier.name} 강등</div>` : ''}
    ${wasChallenge ? '<div class="result-daily done">🗓 오늘의 도전 완료</div>' : ''}
    ${justFinishedDaily
      ? '<div class="result-daily done">🎯 오늘의 훈련 완주!</div>'
      : `<div class="result-daily">🎯 오늘의 훈련 ${plan.done.length} / ${plan.ids.length}</div>`}
    ${gotFreeze ? `<div class="result-newrecord">❄ ${state.streak}일 연속 · 스트릭 보호권 +1</div>` : ''}
    <div class="result-buttons">
      ${nextGame && !dailyDone
        ? `<button class="btn-primary" id="btn-next">다음 · ${nextGame.icon} ${nextGame.name}</button>
           <button class="btn-secondary" id="btn-again">한 판 더</button>`
        : `<button class="btn-primary" id="btn-again">한 판 더</button>
           ${nextGame ? `<button class="btn-secondary" id="btn-next">다음 · ${nextGame.icon} ${nextGame.name}</button>` : ''}`}
      <button class="btn-line result-share" id="btn-share">결과 공유</button>
      <button class="btn-secondary" id="btn-home">홈으로</button>
    </div>
    <div class="result-next-why">${nextGame ? nextWhy : ''}</div>
  `;
  // "한 판 더"는 이미 흐름을 타고 있으니 카운트다운을 1초로 줄인다
  $('#btn-again').addEventListener('click', () => startSession(game, !game.picker, true));
  const $next = $('#btn-next');
  if ($next) $next.addEventListener('click', () => startSession(nextGame));
  $('#btn-share').addEventListener('click', () => shareResult(game, result, delta, after));
  $('#btn-home').addEventListener('click', renderHome);
  show('#screen-result');
}

// ---------- 스도쿠 별관 ----------
// 랭크 밖이다. LP·부식·종합 점수·리그·오늘의 훈련 어디에도 끼지 않는다.
// 대신 난이도 해금과 난이도별 최단 기록이 자체 진행감을 만든다.
let pendingLevel = null;   // 진행 중인 판을 버리고 고르려는 난이도

// 받침이 있으면 "을", 없으면 "를". (쉬움을 / 전문가를)
function eul(word) {
  const c = word.charCodeAt(word.length - 1) - 0xAC00;
  const hasBatchim = c >= 0 && c <= 11171 && c % 28 !== 0;
  return word + (hasBatchim ? '을' : '를');
}

function sudokuSaved() {
  const s = state.sudoku;
  return (s && s.grid && !s.done && s.level) ? s : null;
}

function renderSudoku() {
  const p = state.sudokuProg;
  const saved = sudokuSaved();
  pendingLevel = null;

  $('#sd-progress').textContent = p.plays === 0
    ? '난이도를 하나씩 열어가세요'
    : `${nf(p.plays)}판 · ${p.unlocked}/${SUDOKU_LEVELS.length}단계 열림`;

  // 이어하기 — 진행 중인 판이 있으면 가장 위에서 권한다
  const $cont = $('#sd-continue');
  if (saved) {
    const el = Math.round(saved.elapsed || 0);
    $('#sd-continue-desc').textContent =
      `${saved.level} · ${fmtDur(el, 'sec')} 경과 · 실수 ${saved.mistakes || 0}`;
    $cont.classList.remove('hidden');
    $cont.onclick = () => startSudoku(saved.level);
  } else {
    $cont.classList.add('hidden');
  }

  const $list = $('#sd-levels');
  $list.innerHTML = '';
  SUDOKU_LEVELS.forEach((lv, i) => {
    const open = i < p.unlocked;
    const rec = p.recs[lv.name];
    const b = document.createElement('button');
    b.className = 'sd-level' + (open ? '' : ' locked');
    b.innerHTML = `
      <span class="sl-mark">${open ? (rec !== undefined ? '✓' : '') : '🔒'}</span>
      <span class="sl-main">
        <span class="sl-name">${lv.name}</span>
        <span class="sl-sub">${open
          ? (rec !== undefined ? `최단 ${fmtDur(rec, 'sec')}` : `단서 ${lv.clues}개 · 첫 도전`)
          : `${eul(SUDOKU_LEVELS[i - 1].name)} 완성하면 열려요`}</span>
      </span>`;
    if (open) {
      b.addEventListener('click', () => {
        // 진행 중인 판과 다른 난이도를 고르면 그 판이 사라진다 — 먼저 확인받는다
        if (saved && saved.level !== lv.name) { askDiscard(lv.name, saved.level); return; }
        startSudoku(lv.name);
      });
    }
    $list.appendChild(b);
  });

  $('#sd-discard').classList.add('hidden');
  $('#sd-scroll').scrollTop = 0;
  show('#screen-sudoku');
}

function askDiscard(levelName, savedName) {
  pendingLevel = levelName;
  $('#sd-discard-body').textContent =
    `진행 중인 "${savedName}" 판이 사라집니다. ${levelName}으로 새로 시작할까요?`;
  $('#sd-discard').classList.remove('hidden');
}

$('#btn-sd-discard-cancel').addEventListener('click', () => {
  pendingLevel = null;
  $('#sd-discard').classList.add('hidden');
});
$('#btn-sd-discard-ok').addEventListener('click', () => {
  if (!pendingLevel) return;
  const lv = pendingLevel;
  pendingLevel = null;
  state.sudoku = null;
  saveState(state);
  startSudoku(lv);
});

function startSudoku(levelName) {
  if (sessionActive) return;
  dailyMode = false;
  $('#game-title').textContent = `🔢 스도쿠 · ${levelName}`;
  launch(sudokuGame, false, ctx => { ctx.sudokuLevel = levelName; });
}

// 별관 결과 — LP 대신 시간·실수·해금으로 말한다
function endAnnex(game, r) {
  const { isNew, prev, unlockedName } = recordSudoku(state, r.level, r);
  const p = state.sudokuProg;
  const best = p.recs[r.level];
  if (r.solved) sfx.tierup(); else sfx.finish();

  const nextLv = SUDOKU_LEVELS[SUDOKU_LEVELS.findIndex(l => l.name === r.level) + 1];
  const canNext = nextLv && SUDOKU_LEVELS.indexOf(nextLv) < p.unlocked;

  $('#result-body').innerHTML = `
    <div class="result-game">스도쿠 · ${r.level}</div>
    <div class="result-score">${r.solved ? fmtDur(r.sec, 'sec') : '실패'}</div>
    <div class="result-detail">${r.solved
      ? `실수 ${r.mistakes}회 · 기준 ${fmtDur(r.expect, 'sec')}`
      : `실수 3회로 끝났습니다 · ${fmtDur(r.sec, 'sec')} 진행`}</div>
    ${r.solved && isNew
      ? `<div class="result-newrecord">⏱ ${r.level} 최단 기록${prev !== undefined ? ` — 이전 ${fmtDur(prev, 'sec')}` : ''}</div>`
      : (r.solved && best !== undefined ? `<div class="result-best">⏱ ${r.level} 최단 ${fmtDur(best, 'sec')}</div>` : '')}
    ${unlockedName ? `<div class="result-tierup">🔓 ${unlockedName} 단계가 열렸습니다</div>` : ''}
    <div class="result-annex">랭크 밖 종목이라 LP는 변하지 않아요</div>
    <div class="result-buttons">
      ${canNext ? `<button class="btn-primary" id="btn-sd-next">${nextLv.name} 도전</button>` : ''}
      <button class="${canNext ? 'btn-secondary' : 'btn-primary'}" id="btn-sd-again">${r.level} 한 판 더</button>
      <button class="btn-secondary" id="btn-sd-list">난이도 고르기</button>
      <button class="btn-secondary" id="btn-home">홈으로</button>
    </div>
  `;
  const $n = $('#btn-sd-next');
  if ($n) $n.addEventListener('click', () => startSudoku(nextLv.name));
  $('#btn-sd-again').addEventListener('click', () => startSudoku(r.level));
  $('#btn-sd-list').addEventListener('click', renderSudoku);
  $('#btn-home').addEventListener('click', renderHome);
  show('#screen-result');
}

$('#btn-sudoku').addEventListener('click', renderSudoku);
$('#btn-sudoku-back').addEventListener('click', renderHome);
$('#btn-sd-rules').addEventListener('click', () => showRules(sudokuGame));

// ---------- 결과 공유 ----------
// 문제가 전부 절차 생성이라 "같은 문제"를 자랑할 수는 없지만,
// 날짜·종목·점수·티어는 공유할 만하다 (Wordle식 한 덩어리 텍스트).
async function shareResult(game, result, delta, after) {
  const t = tierOf(after);
  const d = new Date();
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  const plan = todayPlan();
  const bar = plan.ids.map(id => plan.done.includes(id) ? '🟩' : '⬜').join('');
  const text = [
    `RANKUP ${date} · ${game.icon} ${game.name}${dailyMode ? ' (오늘의 도전)' : ''}`,
    `${nf(result.score)}점 · ${delta >= 0 ? '+' : '−'}${Math.abs(delta)} LP · ${t.name} ${nf(after)}`,
    `오늘의 훈련 ${bar}${state.streak > 0 ? ` · 🔥${state.streak}일` : ''}`,
  ].join('\n');
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    toast('결과를 복사했어요');
  } catch { toast('공유를 취소했어요'); }
}

// ---------- 중단 ----------
function abortGame() {
  if (currentCtx && currentCtx.onAbort) {
    try { currentCtx.onAbort(); } catch { /* 저장 실패가 중단을 막지 않게 */ }
  }
  currentCtx = null;
  sessionToken++;              // 살아남은 콜백이 finish를 부르지 못하게
  clearSession();
  $('#game-body').innerHTML = '';
  renderHome();
}
$('#btn-abort').addEventListener('click', abortGame);

// ---------- 토스트 ----------
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
}

// ---------- 기록 보기 ----------
let nickname = null;
async function refreshNickname() {
  try { nickname = await getNickname(); } catch { nickname = null; }
}

// ---------- 랭킹 카드 (홈) ----------
// 내 종합 점수는 항상 보여준다. 순위·상위 3명은 SDK가 읽기 API를 줄 때만
// 채워지고, 없으면 "전체 순위" 버튼으로 안내한다 (platform.getLeaderboardInfo 참고).
let lbInfo = null, lbFetchedAt = 0;
const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 이번 주가 끝나기까지 남은 시간
function untilWeekEnd() {
  const d = new Date();
  const shifted = new Date(d.getTime() - 4 * 3600 * 1000);
  const daysLeft = 7 - ((shifted.getDay() + 6) % 7);
  const end = new Date(shifted);
  end.setDate(end.getDate() + daysLeft);
  end.setHours(0, 0, 0, 0);
  return end.getTime() + 4 * 3600 * 1000 - d.getTime();
}

function renderRankCard() {
  const w = weeklyBucket();
  const me = nickname || '나';
  $('#rank-mine').innerHTML = `
    <span class="rm-rank">${escapeHtml(me)}${lbInfo && lbInfo.myRank ? ` · ${nf(lbInfo.myRank)}위` : ''}</span>
    <span class="rm-score">${nf(w.lp)}점</span>`;
  const $top = $('#rank-top');
  const reset = `<div class="rank-note">이번 주 딴 LP로 겨룹니다 · ${fmtRemain(untilWeekEnd())} 뒤 리셋</div>`;
  if (lbInfo && lbInfo.top) {
    const medals = ['🥇', '🥈', '🥉'];
    $top.innerHTML = lbInfo.top.map((e, i) => `
      <div class="rank-row">
        <span class="rr-medal">${medals[(e.rank || i + 1) - 1] || ''}</span>
        <span class="rr-name">${escapeHtml(e.name)}</span>
        ${e.score !== null ? `<span class="rr-score">${nf(Number(e.score) || 0)}점</span>` : ''}
      </div>`).join('') + reset;
  } else if (inToss()) {
    $top.innerHTML = '<div class="rank-note">1·2·3위는 오른쪽 위 "전체 순위"에서 확인하세요</div>' + reset;
  } else {
    $top.innerHTML = '<div class="rank-note">토스 미니앱에서 열면 내 순위와 1·2·3위가 여기에 표시됩니다</div>' + reset;
  }
}

function refreshRankCard() {
  renderRankCard();
  // 토스 안에서만, 1분에 한 번만 다시 물어본다
  if (inToss() && Date.now() - lbFetchedAt > 60000) {
    lbFetchedAt = Date.now();
    getLeaderboardInfo().then(info => {
      if (info) { lbInfo = info; renderRankCard(); }
    });
  }
}

// 최근 7일 하루치 획득 LP 막대. history의 delta를 날짜별로 합친다.
function weekChart() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ key: dayKeyOf(d.getTime()), label: '일월화수목금토'[d.getDay()], lp: 0, n: 0 });
  }
  const byKey = new Map(days.map(d => [d.key, d]));
  for (const h of state.history) {
    const slot = byKey.get(dayKeyOf(h.t));
    if (!slot) continue;
    slot.lp += h.delta;
    slot.n++;
  }
  const max = Math.max(20, ...days.map(d => Math.abs(d.lp)));
  const bars = days.map((d, i) => {
    const h = Math.round(Math.abs(d.lp) / max * 40);
    const up = d.lp >= 0;
    return `<div class="wc-col${i === 6 ? ' today' : ''}">
      <div class="wc-bar-wrap"><i class="wc-bar ${up ? 'up' : 'down'}" style="height:${Math.max(d.n ? 3 : 0, h)}px"></i></div>
      <span class="wc-lp">${d.n ? (up ? '+' : '−') + Math.abs(d.lp) : ''}</span>
      <span class="wc-day">${d.label}</span>
    </div>`;
  }).join('');
  const total = days.reduce((a, d) => a + d.lp, 0);
  const played = days.filter(d => d.n > 0).length;
  return `<div class="weekchart">${bars}</div>
    <div class="wc-sum">최근 7일 ${total >= 0 ? '+' : '−'}${Math.abs(total)} LP · ${played}일 플레이</div>`;
}

function renderRecords() {
  applyDecay(state);
  const $sc = $('#records-scroll');
  const w = weeklyBucket();
  const sects = [];
  sects.push(`<div class="sect">
    <div class="sect-head">최근 7일${nickname ? ` · ${nickname}` : ''}</div>
    ${weekChart()}
    <div class="stat-rows" style="margin-top:14px">
      <div class="stat-row"><span>이번 주 점수${inToss() ? ' (리더보드 제출값)' : ''}</span><span>${nf(w.lp)}</span></div>
      <div class="stat-row"><span>이번 주 판수</span><span>${nf(w.sessions)}판</span></div>
      <div class="stat-row"><span>누적 판수</span><span>${nf(state.totalSessions)}판</span></div>
      <div class="stat-row"><span>연속 기록</span><span>${state.streak > 0 ? state.streak + '일' : '없음'}${state.freeze > 0 ? ` · ❄ 보호권 ${state.freeze}개` : ''}</span></div>
    </div>
  </div>`);
  // 미플레이 종목은 한 줄로 묶는다 ("아직 기록이 없어요"가 열 줄 이어지면 화면이 죽는다)
  const unplayed = GAMES.filter(g => state.disc[g.id].sessions === 0);
  if (unplayed.length) {
    sects.push(`<div class="sect">
      <div class="sect-head">아직 안 해본 종목 ${unplayed.length}개</div>
      <p class="sect-desc" style="margin:0">${unplayed.map(g => `${g.icon} ${g.name}`).join(' · ')}</p>
    </div>`);
  }
  for (const g of GAMES) {
    const d = state.disc[g.id];
    if (d.sessions === 0) continue;
    const t = tierOf(d.rating);
    const recent = state.history.find(h => h.discId === g.id);
    const vrowsAll = variantRows(g, d);
    const lines = [
      `<div class="stat-row"><span>레이팅${vrowsAll.length > 1 ? ' (조합 평균)' : ''}</span><span style="color:${t.color}">${t.name} · ${nf(d.rating)}</span></div>`,
      `<div class="stat-row"><span>최고 점수</span><span>${nf(d.best)}</span></div>`,
    ];
    if (recent) lines.push(`<div class="stat-row"><span>최근 점수</span><span>${nf(recent.score)}</span></div>`);
    const spec = TIME_RECORDS[g.id];
    if (spec) for (const [key, label, unit] of spec.order) {
      if (d.records && d.records[key] !== undefined) {
        lines.push(`<div class="stat-row"><span>${label}</span><span>${fmtDur(d.records[key], unit || spec.unit)}</span></div>`);
      }
    }
    // 고를 게 있는 종목은 조합마다 레이팅부터 따로다 (우리말만 / 영단어만 / 통합 …)
    const vrows = vrowsAll;
    const vHtml = (vrows.length > 1 || (vrows.length === 1 && vrows[0].key)) ? `
      <div class="var-head">선택별 레이팅 · 기록</div>
      <div class="stat-rows">${vrows.map(v => {
        const vt = tierOf(v.rating);
        return `<div class="stat-row var-row">
          <span>${v.label}</span>
          <span style="color:${vt.color}">${vt.name} · ${nf(v.rating)}<i>최고 ${nf(v.best)} · ${nf(v.sessions)}판</i></span>
        </div>`;
      }).join('')}</div>` : '';
    sects.push(`<div class="sect"><div class="sect-head">${g.icon} ${g.name} · ${nf(d.sessions)}판</div>
      <div class="stat-rows">${lines.join('')}</div>${vHtml}</div>`);
  }
  // 별관은 랭크와 섞이지 않게 맨 아래에 따로 둔다
  const sp = state.sudokuProg;
  if (sp.plays > 0) {
    const rows = SUDOKU_LEVELS
      .filter(l => sp.recs[l.name] !== undefined)
      .map(l => `<div class="stat-row"><span>${l.name} 최단</span><span>${fmtDur(sp.recs[l.name], 'sec')}</span></div>`);
    sects.push(`<div class="sect">
      <div class="sect-head">🔢 스도쿠 · ${nf(sp.plays)}판 <span class="sect-tag">랭크 밖</span></div>
      <div class="stat-rows">
        <div class="stat-row"><span>열린 단계</span><span>${sp.unlocked} / ${SUDOKU_LEVELS.length}</span></div>
        ${rows.join('')}
      </div>
    </div>`);
  }
  $sc.innerHTML = sects.join('');
  $sc.scrollTop = 0;
  show('#screen-records');
}
$('#btn-records').addEventListener('click', renderRecords);
$('#btn-records-back').addEventListener('click', renderHome);

// 홈으로 복귀 시 갱신 (탭 복귀 포함)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && $('#screen-home').classList.contains('active')) renderHome();
});

// ---------- 화면 테마 ----------
const THEMES = ['onyx', 'graphite', 'linen'];
// 주소창 색까지 맞춰야 폰에서 앱처럼 보인다
const THEME_BG = { onyx: '#0A0A0C', graphite: '#1D1E21', linen: '#F6F4F0' };

function applyTheme(name) {
  const t = THEMES.includes(name) ? name : 'onyx';
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_BG[t]);
  document.querySelectorAll('.theme').forEach(b =>
    b.classList.toggle('on', b.dataset.theme === t));
}

$('#themes').addEventListener('click', e => {
  const b = e.target.closest('.theme');
  if (!b) return;
  state.theme = b.dataset.theme;
  saveState(state);
  applyTheme(state.theme);
  sfx.tick();
});

// ---------- 설정 ----------
function fmtWhen(ms) {
  if (!ms) return '없음';
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function renderSettings() {
  // 별명: 토스 밖에서만 직접 정할 수 있다
  const $nick = $('#nick-sect');
  if (canEditNickname()) {
    $nick.classList.remove('hidden');
    $('#nick-input').value = nickname || '';
  } else {
    $nick.classList.add('hidden');
  }
  const now = Date.now();
  const played = GAMES.filter(g => state.disc[g.id].sessions > 0).length;
  const lastPlayed = Math.max(0, ...GAMES.map(g => state.disc[g.id].lastPlayed || 0));
  const best = GAMES.slice().sort((a, b) => state.disc[b.id].rating - state.disc[a.id].rating)[0];
  const rows = [
    ['누적 판수', `${nf(state.totalSessions)}판`],
    ['플레이한 종목', `${played} / ${GAMES.length}`],
    ['연속 기록', state.streak > 0 ? `${state.streak}일` : '없음'],
    ['가장 높은 종목', `${best.name} · ${nf(state.disc[best.id].rating)}`],
    ['마지막 플레이', fmtWhen(lastPlayed)],
  ];
  $('#stat-rows').innerHTML = rows
    .map(([k, v]) => `<div class="stat-row"><span>${k}</span><span>${v}</span></div>`).join('');
  hideBackupUI();
  show('#screen-settings');
}

function hideBackupUI() {
  $('#backup-msg').classList.add('hidden');
  $('#import-confirm').classList.add('hidden');
  $('#reset-confirm').classList.add('hidden');
}

function say(text, kind) {
  const el = $('#backup-msg');
  el.textContent = text;
  el.className = 'msg' + (kind ? ' ' + kind : '');
  el.classList.remove('hidden');
}

$('#btn-settings').addEventListener('click', renderSettings);
$('#btn-settings-back').addEventListener('click', renderHome);

$('#btn-export').addEventListener('click', () => {
  try {
    const name = exportState(state);
    say(`${name} 으로 저장했습니다. 이 파일만 있으면 어느 기기에서든 되살릴 수 있어요.`, 'ok');
  } catch (e) {
    say('내보내기에 실패했습니다: ' + e.message, 'err');
  }
});

let pendingImport = null;
$('#btn-import').addEventListener('click', () => $('#file-input').click());

$('#file-input').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';   // 같은 파일을 다시 골라도 change가 뜨도록
  if (!file) return;
  hideBackupUI();
  try {
    const { state: incoming, summary } = await readBackup(file);
    pendingImport = incoming;
    // 덮어쓰기 전에 파일 내용을 먼저 보여준다
    $('#import-summary').innerHTML = [
      `종목 ${summary.종목}개`,
      `누적 ${nf(summary.누적판수)}판`,
      `연속 ${summary.스트릭}일`,
      `마지막 플레이 ${fmtDate(summary.마지막플레이)}`,
      summary.내보낸시각 ? `내보낸 시각 ${fmtDate(summary.내보낸시각)}` : null,
    ].filter(Boolean).join('<br>');
    $('#import-confirm').classList.remove('hidden');
  } catch (err) {
    pendingImport = null;
    say(err.message, 'err');
  }
});

$('#btn-import-cancel').addEventListener('click', () => {
  pendingImport = null;
  $('#import-confirm').classList.add('hidden');
});

$('#btn-import-apply').addEventListener('click', () => {
  if (!pendingImport) return;
  saveState(pendingImport);
  state = loadState();      // 누락 필드를 채워 다시 읽는다
  applyTheme(state.theme);
  pendingImport = null;
  $('#import-confirm').classList.add('hidden');
  renderSettings();
  say('가져왔습니다.', 'ok');
});

$('#btn-reset').addEventListener('click', () => {
  hideBackupUI();
  $('#reset-summary').innerHTML =
    `누적 ${nf(state.totalSessions)}판<br>${GAMES.filter(g => state.disc[g.id].sessions > 0).length}개 종목 기록`;
  $('#reset-confirm').classList.remove('hidden');
});

$('#btn-reset-cancel').addEventListener('click', () => $('#reset-confirm').classList.add('hidden'));

$('#btn-reset-apply').addEventListener('click', () => {
  const keepTheme = state.theme;
  localStorage.removeItem('rankup-state-v1');
  state = loadState();
  state.theme = keepTheme;   // 화면 설정까지 초기화할 이유는 없다
  saveState(state);
  $('#reset-confirm').classList.add('hidden');
  renderSettings();
  say('모든 기록을 지웠습니다.', 'ok');
});

$('#btn-nick-save').addEventListener('click', () => {
  const v = $('#nick-input').value.trim().slice(0, 12);
  setLocalNickname(v);
  nickname = v || null;
  say(v ? `별명을 "${v}"로 저장했습니다.` : '별명을 지웠습니다.', 'ok');
});

// ---------- 플랫폼 (앱인토스) ----------
$('#btn-leaderboard').addEventListener('click', () => openLeaderboard());

let lastBackAt = 0;
function handleBack() {
  const active = document.querySelector('.screen.active');
  const id = active && active.id;
  if (id === 'screen-game') { abortGame(); return true; }      // 게임 중 → 홈
  if (id && id !== 'screen-home') { renderHome(); return true; } // 다른 화면 → 홈
  // 홈: 두 번 눌러 나가기
  const now = Date.now();
  if (now - lastBackAt < 2000) return false;   // 진짜 나간다
  lastBackAt = now;
  toast('한 번 더 누르면 종료됩니다');
  return true;
}

// ---------- 첫 실행 안내 ----------
// 처음 온 사람에게 목록 11개를 던지면 고르다 지친다. 무엇을 하는 앱인지 세 줄로 알리고
// 오늘의 훈련 첫 판으로 바로 태운다.
function showIntro() {
  const plan = todayPlan();
  const first = GAMES.find(g => g.id === plan.ids[0])
    || GAMES.find(g => plan.ids.includes(g.id))
    || GAMES[0];
  $('#btn-intro-start').textContent = `${first.icon} ${first.name} 시작하기`;
  $('#btn-intro-start').onclick = () => {
    state.onboarded = 1;
    saveState(state);
    startSession(first);
  };
  $('#btn-intro-skip').onclick = () => {
    state.onboarded = 1;
    saveState(state);
    renderHome();
  };
  show('#screen-intro');
}

applyTheme(state.theme);
if (!state.onboarded && state.totalSessions === 0) showIntro();
else renderHome();

initPlatform().then(() => {
  onBack(handleBack);
  refreshNickname().then(refreshRankCard);   // 별명·순위가 오면 카드 갱신
  if (hasLeaderboard()) $('#btn-leaderboard').classList.remove('hidden');
});
