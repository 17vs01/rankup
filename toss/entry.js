// 토스 미니앱 진입점 — 이 파일만 번들러를 탄다
//
// 앱 본체(js/)는 빌드 없이도 도는 순수 ES 모듈이라 GitHub Pages에 그대로 올라간다.
// 그 구조를 깨지 않으려고, SDK를 여기서 한 번만 불러와 전역에 꽂아준다.
// js/platform.js는 그 전역만 보므로 본체 코드는 한 줄도 토스를 모른다.
import {
  Game, Storage, Screen, graniteEvent, getUserKeyForGame, generateHapticFeedback,
} from '@apps-in-toss/web-framework';

window.__APPS_IN_TOSS__ = {
  Game,                    // openLeaderboard · setLeaderboardScore · getUserProfile
  Storage,                 // getItem · setItem · removeItem · clearItems (비동기)
  Screen,                  // setOrientation · setIosSwipeBack
  graniteEvent,            // 시스템 뒤로가기 구독
  getUserKeyForGame,
  generateHapticFeedback,  // iOS WebView는 navigator.vibrate가 안 먹는다
};

// 전역을 꽂은 뒤에 본체를 띄운다. 순서가 뒤집히면 inToss()가 false로 시작한다.
// 최상위 await는 쓰지 않는다 — WebView 하한을 낮게 잡으려고.
import('../js/main.js').catch(e => {
  console.error('[rankup] 본체를 띄우지 못했습니다', e);
  document.documentElement.classList.remove('booting');
});
