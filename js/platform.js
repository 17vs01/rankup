// 앱인토스 어댑터
//
// 토스 미니앱 안에서는 토스 SDK를, 밖(브라우저·PWA)에서는 로컬 대체 구현을 쓴다.
// 화면 코드는 이 파일만 부르면 되고, 어디서 도는지 몰라도 된다.
//
// 토스에 올릴 때 고칠 곳은 loadSdk() 하나뿐이다:
//   import { Game, getUserKeyForGame, Storage } from '@apps-in-toss/web-framework';
// 지금은 빌드 도구가 없어서 전역에 SDK가 실려 있는지만 확인한다.
//
// 자세한 배경은 TOSS.md 참고.

let sdk = null;
let ready = false;

async function loadSdk() {
  // 토스 WebView가 주입하거나, 나중에 번들러로 import한 SDK를 여기서 잡는다.
  const g = typeof window !== 'undefined' ? window : {};
  if (g.__APPS_IN_TOSS__) return g.__APPS_IN_TOSS__;
  return null;
}

export async function initPlatform() {
  if (ready) return;
  try { sdk = await loadSdk(); } catch { sdk = null; }
  ready = true;
}

/** 토스 안에서 돌고 있는가 */
export function inToss() { return sdk !== null; }

// ---------- 별명 ----------
// 토스에서는 게임센터 프로필의 별명을 그대로 쓴다.
// 밖에서는 사용자가 직접 정한 별명(로컬)을 쓴다.
const LOCAL_NAME_KEY = 'rankup-nickname';

export async function getNickname() {
  if (sdk?.Game?.getUserProfile) {
    try {
      const p = await sdk.Game.getUserProfile();
      if (p?.statusCode === 'SUCCESS' && p.nickname) return p.nickname;
    } catch { /* 아래 로컬 별명으로 떨어진다 */ }
  }
  try { return localStorage.getItem(LOCAL_NAME_KEY) || null; } catch { return null; }
}

export function setLocalNickname(name) {
  try { localStorage.setItem(LOCAL_NAME_KEY, name); } catch { /* 저장 실패는 무시 */ }
}

/** 토스에서는 별명을 토스가 정하므로 앱에서 못 바꾼다 */
export function canEditNickname() { return !sdk?.Game?.getUserProfile; }

// ---------- 사용자 식별 ----------
export async function getUserKey() {
  if (sdk?.getUserKeyForGame) {
    try {
      const r = await sdk.getUserKeyForGame();
      if (r?.hash) return r.hash;
      if (typeof r === 'string') return r;
    } catch { /* 아래로 */ }
  }
  return null;
}

// ---------- 종합 점수 ----------
// 토스 리더보드는 미니앱당 하나뿐이라, 12종목을 한 숫자로 합쳐 올린다.
//
// 안 해본 종목은 평균에서 뺀다. 그러면 한 종목만 파고 1위 하는 게 가능해지므로,
// 플레이한 종목 수에 따라 최대 절반까지 깎는다.
export function compositeScore(state, gameIds) {
  const played = gameIds.filter(id => state.disc[id] && state.disc[id].sessions > 0);
  if (!played.length) return 0;
  const avg = played.reduce((a, id) => a + state.disc[id].rating, 0) / played.length;
  const breadth = 0.5 + 0.5 * (played.length / gameIds.length);
  return Math.round(avg * breadth);
}

/** 종합 점수를 토스 리더보드에 올린다. 토스 밖에서는 아무것도 안 한다. */
export async function submitScore(value) {
  if (!sdk?.Game?.setLeaderboardScore) return { ok: false, reason: 'NOT_IN_TOSS' };
  try {
    const r = await sdk.Game.setLeaderboardScore({ score: String(value) });
    return { ok: r?.statusCode === 'SUCCESS', reason: r?.statusCode || 'NO_RESPONSE' };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

/** 토스 리더보드 화면을 띄운다 */
export async function openLeaderboard() {
  if (!sdk?.Game?.openLeaderboard) return false;
  try { await sdk.Game.openLeaderboard(); return true; } catch { return false; }
}

export function hasLeaderboard() { return !!sdk?.Game?.openLeaderboard; }

// ---------- 뒤로가기 ----------
// 토스에서는 SDK가 뒤로가기 이벤트를 주고, 밖에서는 history를 쓴다.
// 어느 쪽이든 handler가 true를 돌려주면 "내가 처리했으니 나가지 마라"는 뜻이다.
let backHandler = null;

export function onBack(handler) {
  backHandler = handler;

  if (sdk?.useBackEvent) {
    // 토스 안: SDK 이벤트에 연결한다 (번들러 도입 후 실제 훅으로 교체)
    try {
      const ctl = sdk.useBackEvent();
      ctl.addEventListener(() => { backHandler && backHandler(); });
      return;
    } catch { /* 아래 웹 방식으로 */ }
  }

  // 토스 밖: history에 상태를 하나 쌓아두고, popstate를 뒤로가기로 본다.
  // 처리했으면 다시 쌓아서 브라우저가 실제로 나가지 않게 막는다.
  try {
    history.pushState({ rankup: 1 }, '');
    window.addEventListener('popstate', () => {
      const handled = backHandler && backHandler();
      if (handled) history.pushState({ rankup: 1 }, '');
    });
  } catch { /* history를 못 쓰는 환경이면 뒤로가기는 기본 동작 */ }
}

// ---------- 저장소 ----------
// 토스 Storage는 기기를 바꿔도 데이터가 유지되지만 비동기다.
// 지금 앱은 localStorage(동기)를 쓰고 있어서, 이관은 storage.js를 함께 손봐야 한다.
// 우선 인터페이스만 맞춰 둔다. (TOSS.md의 '출시 준비' 참고)
export const storage = {
  async get(key) {
    if (sdk?.Storage?.getItem) {
      try { return await sdk.Storage.getItem(key); } catch { /* 아래로 */ }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    if (sdk?.Storage?.setItem) {
      try { await sdk.Storage.setItem(key, value); return; } catch { /* 아래로 */ }
    }
    try { localStorage.setItem(key, value); } catch { /* 저장 실패는 무시 */ }
  },
};
