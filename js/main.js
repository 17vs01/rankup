import { loadState, saveState, applyDecay, recordSession } from './storage.js';
import { tierOf, tierProgress, ratingDelta, timeToDecay, TIERS } from './rating.js';
import { sfx } from './audio.js';
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
import { calibGame } from './games/calib.js';
import { metamemGame } from './games/metamem.js';
import { t24Game } from './games/t24.js';

const GAMES = [
  sudokuGame, chainGame,
  mathGame, vocabGame, memoryGame, focusGame,
  unpredictGame, chronoGame, compassGame, eyeballGame,
  calibGame, metamemGame, t24Game,
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

// 목록 아래에 더 있는지 표시. 끝까지 내리면 신호를 감춘다.
function updateScrollHint() {
  const el = $('#discipline-cards');
  const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
  const noOverflow = el.scrollHeight <= el.clientHeight + 4;
  const hide = atBottom || noOverflow;
  $('#cards-fade').classList.toggle('hidden-fade', hide);
  $('#cards-more').classList.toggle('hidden-fade', hide);
}
$('#discipline-cards').addEventListener('scroll', updateScrollHint, { passive: true });
window.addEventListener('resize', updateScrollHint);

function renderHome() {
  // 부식 적용
  const decayed = applyDecay(state);
  const $warn = $('#decay-warning');
  if (decayed.length > 0) {
    const names = decayed.map(d => {
      const g = GAMES.find(g => g.id === d.id);
      return `${g.name} -${d.loss}`;
    }).join(', ');
    $warn.textContent = `⚠️ 방치로 레이팅 부식: ${names}`;
    $warn.classList.remove('hidden');
  } else {
    $warn.classList.add('hidden');
  }

  // 스트릭
  $('#streak-badge').textContent = state.streak > 0 ? `🔥 ${state.streak}일` : '';

  // 카드
  const $cards = $('#discipline-cards');
  $cards.innerHTML = '';
  const now = Date.now();
  for (const g of GAMES) {
    const d = state.disc[g.id];
    const t = tierOf(d.rating);
    const prog = tierProgress(d.rating);
    const ttd = timeToDecay(d, now);
    const decaySoon = d.lastPlayed && ttd < 12 * 3600 * 1000;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-icon">${g.icon}</div>
      <div class="card-info">
        <div class="card-name">${g.name}</div>
        <div class="card-sub">${g.desc}</div>
        <div class="tier-bar"><div class="tier-bar-fill" style="width:${prog * 100}%;background:${t.color}"></div></div>
      </div>
      <div class="card-rank">
        <div class="card-tier" style="color:${t.color}">${t.name}</div>
        <div class="card-rating">${d.rating} LP</div>
        ${decaySoon ? `<div class="card-decay">${ttd === 0 ? '부식 중!' : fmtRemain(ttd) + ' 후 부식'}</div>` : ''}
      </div>
    `;
    card.addEventListener('click', () => startSession(g));
    $cards.appendChild(card);
  }

  // 목록이 잘려 보이지 않게: 총 개수를 적고, 스크롤 여지가 있으면 알려준다
  $('#cards-count').textContent = `종목 ${GAMES.length}`;
  const played = GAMES.filter(g => state.disc[g.id].sessions > 0).length;
  $('#cards-hint').textContent = played < GAMES.length
    ? `${GAMES.length - played}개 아직 안 해봄` : '전 종목 플레이';

  // 빠른 시작: 부식 임박/가장 오래 안 한 종목
  const urgent = GAMES.slice().sort((a, b) => {
    return (state.disc[a.id].lastPlayed || 0) - (state.disc[b.id].lastPlayed || 0);
  })[0];
  $('#quick-sub').textContent = `${urgent.icon} ${urgent.name} — 가장 오래 쉬었어요`;
  $('#btn-quick').onclick = () => startSession(urgent);

  $('#total-sessions').textContent = state.totalSessions > 0
    ? `누적 ${state.totalSessions}판` : '첫 판을 시작해보세요';

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

function startSession(game) {
  if (sessionActive) return;   // 재진입 방지
  clearSession();
  currentCtx = null;
  sessionActive = true;
  currentGame = game;
  $('#game-title').textContent = `${game.icon} ${game.name}`;
  $('#game-timer').textContent = '';
  $('#game-timer').classList.remove('urgent');
  const $body = $('#game-body');
  show('#screen-game');

  // 3초 카운트다운
  let n = 3;
  $body.innerHTML = `<div class="countdown">${n}</div>`;
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

// ---------- 결과 ----------
function endSession(game, result) {
  const d = state.disc[game.id];
  const before = d.rating;
  const beforeTier = tierOf(before);
  const delta = ratingDelta(result.perf);
  const { newRecord } = recordSession(state, game.id, { score: result.score, delta, perf: result.perf });
  const after = d.rating;
  const afterTier = tierOf(after);
  const tierUp = afterTier.idx > beforeTier.idx;
  const tierDown = afterTier.idx < beforeTier.idx;

  if (tierUp) sfx.tierup();
  else sfx.finish();

  const $r = $('#result-body');
  $r.innerHTML = `
    <div class="result-game">${game.icon} ${game.name}</div>
    <div class="result-score">${result.score}</div>
    <div class="result-detail">${result.detail}</div>
    ${newRecord ? '<div class="result-newrecord">🏆 자기 최고 기록!</div>' : ''}
    <div class="result-delta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta} LP</div>
    <div class="result-tier" style="color:${afterTier.color}">${afterTier.name} · ${after} LP</div>
    <div class="tier-bar" style="width:200px"><div class="tier-bar-fill" style="width:${tierProgress(after) * 100}%;background:${afterTier.color}"></div></div>
    ${tierUp ? `<div class="result-tierup">🎉 ${afterTier.name} 승급!</div>` : ''}
    ${tierDown ? `<div class="result-tierup" style="color:var(--bad)">📉 ${afterTier.name} 강등…</div>` : ''}
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

renderHome();
