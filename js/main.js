import { loadState, saveState, applyDecay, recordSession } from './storage.js';
import { tierOf, tierProgress, ratingDelta, timeToDecay, TIERS } from './rating.js';
import { sfx } from './audio.js';
import { exportState, readBackup, fmtDate } from './backup.js';
import { RULES } from './rules.js';
import {
  initPlatform, inToss, getNickname, setLocalNickname, canEditNickname,
  compositeScore, submitScore, openLeaderboard, hasLeaderboard, onBack,
} from './platform.js';
import { mathGame } from './games/math.js';
import { vocabGame } from './games/vocab.js';
import { memoryGame } from './games/memory.js';
import { focusGame } from './games/focus.js';
import { unpredictGame } from './games/unpredict.js';
import { chronoGame } from './games/chrono.js';
import { compassGame } from './games/compass.js';
import { eyeballGame } from './games/eyeball.js';
import { sudokuGame } from './games/sudoku.js';
import { chainGame } from './games/chain.js';
import { t24Game } from './games/t24.js';
import { korvocabGame } from './games/korvocab.js';

const GAMES = [
  sudokuGame, chainGame,
  korvocabGame, vocabGame, mathGame, memoryGame, focusGame,
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
  sudoku:  { unit: 'sec', title: '난이도별 최단 완주', order: ['쉬움', '보통', '어려움', '전문가', '마스터', '극한'].map(n => ['time_' + n, n]) },
  chain:   { unit: 'sec', title: '내 기록', order: [['time_full', '4판 돌파 최단'], ['chain_level', '타임어택 최고', 'level']] },
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

  // ----- 부식 알림: 붉은 상자 대신 조용한 한 줄 -----
  const $notice = $('#notice');
  if (decayed.length > 0) {
    const names = decayed.map(d => `${GAMES.find(g => g.id === d.id).name} −${d.loss}`).join(', ');
    $notice.textContent = `쉬는 동안 LP가 줄었어요 · ${names}`;
    $notice.classList.remove('hidden');
  } else {
    $notice.classList.add('hidden');
  }

  // ----- 이어서 하기: 가장 오래 쉰 종목 -----
  const urgent = GAMES.slice().sort((a, b) =>
    (state.disc[a.id].lastPlayed || 0) - (state.disc[b.id].lastPlayed || 0))[0];
  const ud = state.disc[urgent.id];
  $('#cta-kicker').textContent = ud.sessions === 0 ? '아직 안 해본 종목' : '가장 오래 쉬었어요';
  $('#cta-name').textContent = `${urgent.icon}  ${urgent.name}`;
  $('#btn-quick').onclick = () => startSession(urgent);

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
    const ttd = timeToDecay(d, now);
    const decaying = d.lastPlayed && ttd <= 0;
    const decaySoon = d.lastPlayed && ttd > 0 && ttd < 12 * 3600 * 1000;

    // 안 해본 종목만 설명을 보여준다. 해본 뒤엔 군더더기가 된다.
    // 시간 기록이 있는 종목은 최고 기록을 보여준다 (더 자랑스러운 숫자)
    const rec = bestRecordOf(g.id);
    const sub = d.sessions === 0 ? g.desc
      : decaying ? '지금 LP가 줄고 있어요'
      : decaySoon ? `${fmtRemain(ttd)} 뒤 LP 감소`
      : rec ? `${d.sessions}판 · ⏱ ${rec}`
      : `${d.sessions}판 · 최고 ${nf(d.best)}`;

    const row = document.createElement('button');
    row.className = 'row';
    row.style.color = t.color;
    row.innerHTML = `
      <span class="row-icon">${g.icon}</span>
      <span class="row-main">
        <span class="row-name" style="color:var(--text)">${g.name}${d.sessions === 0 ? '<i class="row-new">NEW</i>' : ''}</span>
        <span class="row-sub${decaying || decaySoon ? ' row-warn' : ''}">${sub}</span>
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

  show('#screen-home');
  // 화면을 띄운 뒤에 재야 한다. display:none 상태에서는 높이가 0이라
  // "넘칠 게 없다"고 잘못 판단해 스크롤 신호가 사라진다.
  requestAnimationFrame(updateScrollHint);
}

// ---------- 세션 ----------
function clearSession() {
  activeTimers.forEach(id => { clearTimeout(id); clearInterval(id); });
  activeTimers = [];
  if (sessionTimer) { clearInterval(sessionTimer); sessionTimer = null; }
  sessionActive = false;
}

function makeCtx(game) {
  const d = state.disc[game.id];
  const token = ++sessionToken;   // 지난 세션의 콜백이 끼어드는 것 차단
  let finished = false;
  return {
    body: $('#game-body'),
    rating: d.rating,
    state,
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
      endSession(game, result);
    },
  };
}

// ---------- 게임 방법 ----------
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

  // 시간 기록이 있는 종목이면 지금까지의 최단 기록을 함께 보여준다
  const spec = TIME_RECORDS[game.id];
  const recs = state.disc[game.id].records || {};
  const rows = spec ? spec.order.filter(([k]) => recs[k] !== undefined) : [];
  $('#rules-rec-sect').classList.toggle('hidden', rows.length === 0);
  if (rows.length) {
    $('#rules-rec-head').textContent = spec.title;
    $('#rules-records').innerHTML = rows
      .map(([k, label, unit]) => `<div class="stat-row"><span>${label}</span><span>${fmtDur(recs[k], unit || spec.unit)}</span></div>`)
      .join('');
  }
  // 모드가 있는 종목은 시작 버튼을 모드별로 나눠 보여준다
  const $modes = $('#rules-modes');
  $modes.innerHTML = '';
  if (game.modes && game.modes.length) {
    $('#btn-rules-start').classList.add('hidden');
    const cur = state.modes[game.id] || game.modes[0].id;
    for (const m of game.modes) {
      const b = document.createElement('button');
      b.className = 'mode-btn' + (m.id === cur ? ' on' : '');
      b.innerHTML = `<span class="mode-name">${m.name}</span><span class="mode-desc">${m.desc}</span>`;
      b.addEventListener('click', () => {
        state.modes[game.id] = m.id;
        saveState(state);
        startSession(game, true);
      });
      $modes.appendChild(b);
    }
  } else {
    $('#btn-rules-start').classList.remove('hidden');
    $('#btn-rules-start').onclick = () => startSession(game, true);
  }

  $('#rules-scroll').scrollTop = 0;
  // 방법을 봤다고 기록 — 다음부터는 바로 시작
  if (!state.seenRules[game.id]) {
    state.seenRules[game.id] = 1;
    saveState(state);
  }
  show('#screen-rules');
}
$('#btn-rules-back').addEventListener('click', () => renderHome());

function startSession(game, skipRules = false) {
  if (sessionActive) return;   // 재진입 방지
  // 처음 하는 종목은 방법부터 보여준다
  if (!skipRules && !state.seenRules[game.id]) { showRules(game); return; }
  clearSession();
  currentCtx = null;
  sessionActive = true;
  currentGame = game;
  const modeId = game.modes ? (state.modes[game.id] || game.modes[0].id) : null;
  const modeName = modeId && game.modes.find(m => m.id === modeId);
  $('#game-title').textContent = `${game.icon} ${game.name}`
    + (modeName && modeName.id !== game.modes[0].id ? ` · ${modeName.name}` : '');
  $('#game-timer').textContent = '';
  $('#game-timer').classList.remove('urgent');
  const $body = $('#game-body');
  show('#screen-game');

  // 3초 카운트다운 — 그 사이에 한 줄 요약을 되새겨준다
  let n = 3;
  const rule = RULES[game.id];
  $body.innerHTML = `<div class="countdown">${n}</div>`
    + (rule ? `<div class="countdown-summary">${rule.summary}</div>` : '');
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
      game.run(currentCtx);
    }
  }, 800);
  activeTimers.push(cd);
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

// ---------- 결과 ----------
function endSession(game, result) {
  const d = state.disc[game.id];
  const before = d.rating;
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

  const { newRecord } = recordSession(state, game.id, { score: result.score, delta, perf: result.perf });

  // 토스 안이면 종합 점수를 리더보드에 올린다 (실패해도 조용히 넘어간다)
  if (inToss()) submitScore(compositeScore(state, GAMES.map(g => g.id)));
  const after = d.rating;
  const afterTier = tierOf(after);
  const tierUp = afterTier.idx > beforeTier.idx;
  const tierDown = afterTier.idx < beforeTier.idx;

  if (tierUp) sfx.tierup();
  else sfx.finish();

  const $r = $('#result-body');
  $r.innerHTML = `
    <div class="result-game">${game.name}</div>
    <div class="result-score">${nf(result.score)}</div>
    <div class="result-detail">${result.detail}</div>
    ${recLines.join('')}
    ${newRecord ? '<div class="result-newrecord">자기 최고 점수</div>' : ''}
    <div class="result-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta)} LP</div>
    <div class="result-tier" style="color:${afterTier.color}">${afterTier.name} · ${nf(after)}</div>
    <div class="result-bar"><i style="width:${tierProgress(after) * 100}%;background:${afterTier.color}"></i></div>
    ${tierUp ? `<div class="result-tierup" style="color:${afterTier.color}">${afterTier.name} 승급</div>` : ''}
    ${tierDown ? `<div class="result-tierup" style="color:var(--bad)">${afterTier.name} 강등</div>` : ''}
    <div class="result-buttons">
      <button class="btn-primary" id="btn-again">한 판 더</button>
      <button class="btn-secondary" id="btn-home">홈으로</button>
    </div>
  `;
  $('#btn-again').addEventListener('click', () => startSession(game));
  $('#btn-home').addEventListener('click', renderHome);
  show('#screen-result');
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

function renderRecords() {
  applyDecay(state);
  const $sc = $('#records-scroll');
  const comp = compositeScore(state, GAMES.map(g => g.id));
  const sects = [];
  sects.push(`<div class="sect">
    <div class="sect-head">종합${nickname ? ` · ${nickname}` : ''}</div>
    <div class="stat-rows">
      <div class="stat-row"><span>종합 점수${inToss() ? ' (리더보드 제출값)' : ''}</span><span>${nf(comp)}</span></div>
      <div class="stat-row"><span>누적 판수</span><span>${nf(state.totalSessions)}판</span></div>
      <div class="stat-row"><span>연속 기록</span><span>${state.streak > 0 ? state.streak + '일' : '없음'}</span></div>
    </div>
  </div>`);
  for (const g of GAMES) {
    const d = state.disc[g.id];
    if (d.sessions === 0) {
      sects.push(`<div class="sect"><div class="sect-head">${g.icon} ${g.name}</div>
        <p class="sect-desc" style="margin:0">아직 기록이 없어요</p></div>`);
      continue;
    }
    const t = tierOf(d.rating);
    const recent = state.history.find(h => h.discId === g.id);
    const lines = [
      `<div class="stat-row"><span>레이팅</span><span style="color:${t.color}">${t.name} · ${nf(d.rating)}</span></div>`,
      `<div class="stat-row"><span>최고 점수</span><span>${nf(d.best)}</span></div>`,
    ];
    if (recent) lines.push(`<div class="stat-row"><span>최근 점수</span><span>${nf(recent.score)}</span></div>`);
    const spec = TIME_RECORDS[g.id];
    if (spec) for (const [key, label, unit] of spec.order) {
      if (d.records && d.records[key] !== undefined) {
        lines.push(`<div class="stat-row"><span>${label}</span><span>${fmtDur(d.records[key], unit || spec.unit)}</span></div>`);
      }
    }
    sects.push(`<div class="sect"><div class="sect-head">${g.icon} ${g.name} · ${nf(d.sessions)}판</div>
      <div class="stat-rows">${lines.join('')}</div></div>`);
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

applyTheme(state.theme);
renderHome();

initPlatform().then(() => {
  onBack(handleBack);
  refreshNickname();
  if (hasLeaderboard()) $('#btn-leaderboard').classList.remove('hidden');
});
