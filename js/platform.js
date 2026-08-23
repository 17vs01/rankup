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

// ---------- 점수 제출 ----------
// 토스 리더보드는 미니앱당 하나뿐이다. 처음엔 전 종목 평균(종합 점수)을 올렸는데,
// 평생 누적이라 상위권이 고착돼 새 유저가 포기한다. 지금은 "이번 주에 딴 LP"를
// 올린다 (main.js의 weeklyScore). 월요일 새벽 4시에 리셋된다.

/** 점수를 토스 리더보드에 올린다. 토스 밖에서는 아무것도 안 한다. */
export async function submitScore(value) {
  if (!sdk?.Game?.setLeaderboardScore) return { ok: false, reason: 'NOT_IN_TOSS' };
  try {
    const r = await sdk.Game.setLeaderboardScore({ score: String(value) });
    return { ok: r?.statusCode === 'SUCCESS', reason: r?.statusCode || 'NO_RESPONSE' };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

// 순위를 "읽는" API는 앱인토스에 없다 (제출과 화면 열기뿐).
// 그래서 앱 안에 1·2·3위를 그리려던 시도는 접고 openLeaderboard에 맡긴다.
// 나중에 읽기 API가 생기면 여기에 추가하면 된다.

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
// 토스 밖에서는 localStorage로 떨어진다. 어느 쪽이든 storage.js가 이 어댑터만 쓴다.
//
// 토스 쪽이 실패하면 localStorage로 물러난다 — 기록이 사라지는 것보다는 낫다.
export const storage = {
  async get(key) {
    if (sdk?.Storage?.getItem) {
      try {
        const v = await sdk.Storage.getItem(key);
        if (v != null) return v;
      } catch { /* 아래로 */ }
    }
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    let saved = false;
    if (sdk?.Storage?.setItem) {
      try { await sdk.Storage.setItem(key, value); saved = true; } catch { /* 아래로 */ }
    }
    // 토스에 썼더라도 기기에도 남겨 둔다. SDK가 흔들려도 마지막 판이 안 날아간다.
    try { localStorage.setItem(key, value); } catch { if (!saved) throw new Error('저장 실패'); }
  },
  async remove(key) {
    if (sdk?.Storage?.removeItem) {
      try { await sdk.Storage.removeItem(key); } catch { /* 아래로 */ }
    }
    try { localStorage.removeItem(key); } catch { /* 무시 */ }
  },
};
