import { loadState, saveState, applyDecay, recordSession } from './storage.js';
import { tierOf, tierProgress, ratingDelta, timeToDecay, TIERS } from './rating.js';
import { sfx } from './audio.js';
import { exportState, readBackup, fmtDate } from './backup.js';
import { RULES } from './rules.js';
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
  chain:   { unit: 'sec', title: '최단 기록', order: [['time_full', '4판 돌파']] },
  t24:     { unit: 'sec', title: '최단 기록', order: [['time_one', '한 문제']] },
  focus:   { unit: 'ms',  title: '최고 기록', order: [['time_reaction', '반응속도']] },
};

// 홈 목록 한 줄에 넣을 대표 기록 (가장 어려운 난이도 우선)
function bestRecordOf(gameId) {
  const spec = TIME_RECORDS[gameId];
  if (!spec) return null;
  const recs = state.disc[gameId].records || {};
  for (let i = spec.order.length - 1; i >= 0; i--) {
    const [key, label] = spec.order[i];
    if (recs[key] !== undefined) return `${label} ${fmtDur(recs[key], spec.unit)}`;
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

  // ----- 종합: 13종목 평균을 한 줄로 -----
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
      .map(([k, label]) => `<div class="stat-row"><span>${label}</span><span>${fmtDur(recs[k], spec.unit)}</span></div>`)
      .join('');
  }
  $('#rules-scroll').scrollTop = 0;
  // 방법을 봤다고 기록 — 다음부터는 바로 시작
  if (!state.seenRules[game.id]) {
    state.seenRules[game.id] = 1;
    saveState(state);
  }
  $('#btn-rules-start').onclick = () => startSession(game, true);
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
  $('#game-title').textContent = `${game.icon} ${game.name}`;
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
  if (unit === 'ms') return Math.round(v) + 'ms';
  if (v < 60) return (v < 10 ? v.toFixed(1) : Math.round(v)) + '초';
  return `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`;
}

// ---------- 결과 ----------
function endSession(game, result) {
  const d = state.disc[game.id];
  const before = d.rating;
  const beforeTier = tierOf(before);
  const delta = ratingDelta(result.perf);

  // 시간 기록 (낮을수록 좋음). 게임이 result.time = {key, value, unit, label}로 넘긴다.
  // recordSession이 저장하기 전에 반영해야 함께 저장된다.
  let timeNew = false, timePrev;
  if (result.time && Number.isFinite(result.time.value)) {
    if (!d.records) d.records = {};
    timePrev = d.records[result.time.key];
    if (timePrev === undefined || result.time.value < timePrev) {
      d.records[result.time.key] = result.time.value;
      timeNew = true;
    }
  }

  const { newRecord } = recordSession(state, game.id, { score: result.score, delta, perf: result.perf });
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
    ${result.time ? (timeNew
      ? `<div class="result-newrecord">⏱ ${result.time.label} 신기록 — ${fmtDur(result.time.value, result.time.unit)}${timePrev !== undefined ? ` (이전 ${fmtDur(timePrev, result.time.unit)})` : ''}</div>`
      : `<div class="result-best">⏱ ${result.time.label} ${fmtDur(result.time.value, result.time.unit)} · 기록 ${fmtDur(d.records[result.time.key], result.time.unit)}</div>`) : ''}
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
$('#btn-abort').addEventListener('click', () => {
  if (currentCtx && currentCtx.onAbort) {
    try { currentCtx.onAbort(); } catch { /* 저장 실패가 중단을 막지 않게 */ }
  }
  currentCtx = null;
  clearSession();
  renderHome();
});

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

applyTheme(state.theme);
renderHome();
