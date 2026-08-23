// 앱인토스 배포 설정 — `npx ait build`가 읽는다.
// webBundleDir(dist)는 "있는 그대로" 압축되므로 먼저 npm run build:toss를 돌려야 한다.
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'rankup',
  brand: {
    primaryColor: '#D8B978',   // css/style.css의 --accent (오닉스 테마 금색)
  },
  permissions: [],             // 카메라·위치·연락처 어느 것도 안 쓴다
  webView: {
    bounces: false,            // 게임 화면이 위아래로 딸려 움직이면 조작이 샌다
    pullToRefreshEnabled: false,   // 판 도중 당겨서 새로고침되면 기록이 날아간다
    overScrollMode: 'never',
  },
  webBundleDir: 'dist',
});
