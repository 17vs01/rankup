# 앱인토스(Apps in Toss) 출시 계획

토스 미니앱으로 올리기 위해 조사한 결과와 남은 작업. 다음 작업자가 문서를 다시 뒤지지 않도록 정리해 둔다.

## 결론부터

- **WebView 미니앱으로 간다.** 앱인토스는 HTML5 게임을 지원하고, WebView 환경은 프로젝트에 설정한 웹 라우터 규칙을 그대로 따른다. 지금의 순수 ES 모듈 구조가 그대로 맞다. React Native로 가려면 전면 재작성이라 선택하지 않는다.
- **리더보드는 미니앱당 딱 1개다.** 종목별로 나눌 수 없다. 그래서 **이번 주에 딴 LP** 하나만 올리고, 종목별 기록은 앱 안에서 보여준다.
- **순위를 읽는 API는 없다.** 제출(`setLeaderboardScore`)과 화면 열기(`openLeaderboard`)뿐이라, 앱 안에 1·2·3위를 그릴 수 없다. 홈은 내 주간 점수 한 줄 + "순위 보기" 버튼으로 끝낸다.
- SDK 호출은 전부 `js/platform.js` 한 곳에 모아 두었다. 실제 SDK를 꽂는 곳은 `toss/entry.js` 하나뿐이다.

## 확인한 SDK (import: `@apps-in-toss/web-framework`)

| 기능 | API | 비고 |
|---|---|---|
| 프로필·별명 | `Game.getUserProfile()` | `{ statusCode, nickname, profileImageUri }`. 토스앱 5.221.0+ |
| 점수 제출 | `Game.setLeaderboardScore({ score })` | score는 **문자열**. `statusCode`: SUCCESS / LEADERBOARD_NOT_FOUND / PROFILE_NOT_FOUND / UNPARSABLE_SCORE |
| 순위 화면 | `Game.openLeaderboard()` | 토스가 리더보드 웹뷰를 띄워준다 |
| 사용자 식별 | `getUserKeyForGame()` | 게임 카테고리 전용. 미니앱별 고유 hash. 비게임은 `getAnonymousKey` |
| 저장소 | `Storage.getItem/setItem/removeItem/clearItems` | **기기를 바꿔도 유지된다.** 비동기 |
| 뒤로가기 | `graniteEvent.addEventListener('backEvent', …)` | v3에서 확인한 실제 이름. `useBackEvent`가 아니다 |
| Safe Area | `getSafeAreaInsets()` | 웹에서는 이미 `env(safe-area-inset-*)`로 대응 중이라 안 쓴다 |
| 진동 | `generateHapticFeedback({ type })` | iOS WebView는 `navigator.vibrate`가 안 먹는다 |
| 서버 시간 | 네트워크 API | 치팅 방지용. 시간 기록 검증에 쓸 수 있다 |

문서: https://developers-apps-in-toss.toss.im/documentation
예제: https://github.com/toss/apps-in-toss-examples

## 리더보드에 올리는 값 = 이번 주에 딴 LP

**평생 누적이 아니라 주간 점수를 올린다.** `js/main.js`의 `weeklyScore()` 참고.

- 한 판 끝날 때마다 그 판에서 오른 LP를 이번 주 몫에 더한다 (잃은 LP는 빼지 않는다 —
  빼면 "안 하는 게 이득"이 되어 버린다)
- 월요일 새벽 4시에 리셋 (`weekKeyOf()`)
- 홈의 "🏆 이번 주" 한 줄에 내 주간 점수가 뜨고, 토스 밖에서는 리셋까지 남은 시간이 함께 나온다

이유: 리더보드가 하나뿐인데 평생 누적을 올리면 상위권이 고착돼 새로 온 사람이 첫날 포기한다.
주간 리셋은 매주 모두를 같은 출발선에 세운다 (Duolingo 리그와 같은 이유).

전 종목 평균을 올리던 `compositeScore()`는 이 방식으로 바꾸면서 지웠다.
되돌리려면 `endSession`의 `submitScore(weeklyScore())`를 바꾸면 된다.

## 남은 작업

사용자가 요청했고 아직 안 한 것들. 순서는 의존성 기준.

### 1. 기반 — 완료 (2026-07)
- [x] `platform.js`를 실제로 화면에 연결 (별명 표시·편집은 설정, 주간 점수는 세션 종료마다 제출, 순위 보기는 홈의 "이번 주" 한 줄)
- [x] 뒤로가기: 게임 중 → 홈, 다른 화면 → 홈, 홈에서 → 두 번 눌러 나가기 (`onBack` + 토스트)
- [x] 기록 보기 화면: 홈 상단 "기록" 버튼. 종목별 레이팅/최고점/최근 점수/최단 시간/최고 레벨 + 종합 점수

### 2. 게임별 — 완료 (2026-07)
- [x] **집중력**: 3종목 중 골라서 하기 (1개=5판, 2개=각 3판, 3개=각 1판).
      3개 모두에서 기준 충족 시 레벨업, 상한 없음 (`focus_level` 기록)
- [x] **기억력**: 스톱워치 표시 + 최고 칸수 기록(`memory_cells`). 다음 판은 기록-1칸에서 시작,
      격자는 4×4~9×9까지 커진다
- [x] **나침반**: 1단계(지시 3개)는 "확인" 버튼으로 직접 넘김, 2단계부터 자동
- [x] **목표 수 만들기**: 타임어택 모드 (이전 커밋에서 완료)
- [x] **예측 불가**: 기록 항목 추가 (최저 AI 적중률, 최다 연속 회피)

### 3. 출시 준비 (코드 밖 작업 — 콘솔 가입 등은 직접 해야 함)
- [ ] 앱인토스 콘솔 가입, 미니앱 등록, 리더보드 생성
- [x] `@apps-in-toss/web-framework` 설치 + 번들러(Vite) — 아래 '빌드' 참고
- [x] SDK 연결 — `toss/entry.js`가 전역에 꽂고 `platform.js`가 그걸 읽는다
- [x] localStorage → 토스 Storage 이관 (아래 '저장소' 참고 — 코드는 끝, SDK만 붙이면 된다)
- [ ] 게임 출시 가이드 / 서비스별 주의사항 확인
- [ ] 사업자 등록: 인앱광고·인앱결제·토스페이를 쓸 때만 필요

## 빌드 — 웹은 그대로, 토스만 번들링

**웹판(GitHub Pages)은 빌드가 없다.** `index.html`이 `js/`를 그대로 불러 쓰는 순수 ES 모듈
구조를 지켰다. 번들러는 오직 토스판을 위해서만 돈다 — 이유는 하나뿐이다. SDK가
`@apps-in-toss/web-framework`라는 bare import라 브라우저가 못 풀기 때문이다.

```
toss/entry.js   ← 이 파일만 SDK를 안다. window.__APPS_IN_TOSS__에 꽂고 본체를 띄운다
js/platform.js  ← 그 전역만 본다. 본체 코드는 한 줄도 토스를 모른다
```

| 명령 | 하는 일 |
|---|---|
| `npm run build:toss` | `toss/index.html` 생성 → Vite로 `dist/`에 번들 |
| `npm run ait:build` | 위 + `ait build` → 배포용 `rankup.ait` |
| `npm run ait:deploy` | 앱인토스에 업로드 (토큰 필요: `npx ait token add`) |
| `npm run dev:toss` | 토스판 개발 서버 |

`toss/index.html`은 **웹판에서 찍어낸다** (`scripts/make-toss-html.js`). 마크업을 두 벌로
두면 반드시 어긋나므로, 화면은 웹판만 고치면 된다. 토스판에서 빼는 건 두 가지뿐이다 —
manifest/아이콘(토스가 껍데기를 씌운다)과 서비스워커 등록(토스가 자체 캐시를 쓴다).
빠졌는지는 스크립트가 매번 검사하고, 남아 있으면 빌드를 세운다.

`dist/`, `toss/index.html`, `*.ait`는 생성물이라 커밋하지 않는다.

### 확인한 실제 API (v3.0.5)

문서만 보고 짐작했던 것 중 하나가 틀려서 바로잡았다.

| 쓰는 것 | 실제 이름 |
|---|---|
| 리더보드 | `Game.openLeaderboard` · `Game.setLeaderboardScore` · `Game.getUserProfile` |
| 저장소 | `Storage.getItem / setItem / removeItem / clearItems` |
| 뒤로가기 | `graniteEvent.addEventListener('backEvent', { onEvent })` — `useBackEvent`가 아니다 |
| 진동 | `generateHapticFeedback({ type })` — iOS WebView는 `navigator.vibrate`가 안 먹는다 |

## 저장소 — 메모리 우선, 뒤로 미뤄 쓰기

토스 Storage는 기기를 바꿔도 유지되지만 **비동기**다. `saveState`를 부르는 스무 곳을
전부 await로 바꾸면 게임 코드까지 async로 물든다. 그래서 이렇게 짰다 (`js/storage.js`).

| | 방식 |
|---|---|
| 읽기 | 시작할 때 `initStorage()` 한 번. 그 뒤로는 메모리에서 판다 |
| 쓰기 | `saveState`는 메모리만 갱신하고 즉시 반환. 400ms 모아서 흘려보낸다 |
| 강제 저장 | 화면이 가려지거나(`visibilitychange`) 닫힐 때(`pagehide`) 즉시 밀어낸다 |
| 이중 기록 | 토스에 써도 기기 저장소에 한 벌 더 남긴다. SDK가 흔들려도 마지막 판이 안 날아간다 |

부팅 순서가 정해져 있다 — **플랫폼(SDK 확인) → 저장소 읽기 → 상태 복원 → 화면**.
저장소를 읽는 동안은 `html.booting`으로 화면을 가린다 (밝은 테마 사용자에게
어두운 기본 화면이 번쩍이지 않게). 어디서 실패해도 기본 상태로 앱은 뜬다.

## 주의

- `Game.setLeaderboardScore`는 게임 카테고리 미니앱에서만 동작한다. 다른 카테고리면 `INVALID_CATEGORY`.
- 반환되는 hash는 서버 API 호출용 토큰이 아니다. 사용자 구분용일 뿐.
- 샌드박스에서는 가짜 데이터가 올 수 있다.
