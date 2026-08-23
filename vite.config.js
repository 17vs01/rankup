// 토스 미니앱 번들 설정
//
// 웹판(GitHub Pages)은 빌드가 없다 — index.html이 js/를 그대로 불러 쓴다.
// 번들러는 오직 토스판을 위해서만 돈다. 이유는 하나뿐이다:
// SDK(@apps-in-toss/web-framework)가 브라우저가 못 푸는 bare import라서.
//
// 그래서 toss/entry.js 한 파일만 SDK를 알고, 앱 본체는 전역만 본다.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'toss',
  base: './',              // 토스는 어느 경로에 얹힐지 모른다. 상대 경로로 뽑는다.
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',      // 토스 WebView 하한을 넉넉히 잡는다
  },
});
