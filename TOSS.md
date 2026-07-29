# 앱인토스(Apps in Toss) 출시 계획

토스 미니앱으로 올리기 위해 조사한 결과와 남은 작업. 다음 작업자가 문서를 다시 뒤지지 않도록 정리해 둔다.

## 결론부터

- **WebView 미니앱으로 간다.** 앱인토스는 HTML5 게임을 지원하고, WebView 환경은 프로젝트에 설정한 웹 라우터 규칙을 그대로 따른다. 지금의 순수 ES 모듈 구조가 그대로 맞다. React Native로 가려면 전면 재작성이라 선택하지 않는다.
- **리더보드는 미니앱당 딱 1개다.** 종목별로 나눌 수 없다. 그래서 **종합 점수 하나**만 토스 리더보드에 올리고, 종목별 기록은 앱 안에서 보여준다.
- SDK 호출은 전부 `js/platform.js` 한 곳에 모아 두었다. 토스에 올릴 때 그 파일만 고치면 된다.

## 확인한 SDK (import: `@apps-in-toss/web-framework`)

| 기능 | API | 비고 |
|---|---|---|
| 프로필·별명 | `Game.getUserProfile()` | `{ statusCode, nickname, profileImageUri }`. 토스앱 5.221.0+ |
| 점수 제출 | `Game.setLeaderboardScore({ score })` | score는 **문자열**. `statusCode`: SUCCESS / LEADERBOARD_NOT_FOUND / PROFILE_NOT_FOUND / UNPARSABLE_SCORE |
| 순위 화면 | `Game.openLeaderboard()` | 토스가 리더보드 웹뷰를 띄워준다 |
| 사용자 식별 | `getUserKeyForGame()` | 게임 카테고리 전용. 미니앱별 고유 hash. 비게임은 `getAnonymousKey` |
| 저장소 | `Storage.getItem/setItem/removeItem/clearItems` | **기기를 바꿔도 유지된다.** 비동기 |
| 뒤로가기 | `useBackEvent` (RN) / 화면 이벤트 | 뒤로가기 동작을 직접 정할 수 있다 |
| Safe Area | `useSafeAreaInsets` (RN) | 웹에서는 이미 `env(safe-area-inset-*)`로 대응 중 |
| 서버 시간 | 네트워크 API | 치팅 방지용. 시간 기록 검증에 쓸 수 있다 |

문서: https://developers-apps-in-toss.toss.im/documentation
예제: https://github.com/toss/apps-in-toss-examples

## 종합 점수 (토스 리더보드에 올릴 값)

12종목 레이팅을 하나로 합친 값. `js/platform.js`의 `compositeScore()` 참고.

- 전 종목 평균 LP를 쓰되, **한 번도 안 한 종목은 빼고** 평균낸다 (안 한 종목이 발목을 잡지 않게)
- 다만 플레이한 종목이 적으면 그만큼 깎는다 (한 종목만 파서 1위 하는 걸 막는다)
- `평균LP × min(1, 플레이종목수 / 12 × 0.5 + 0.5)`

이유: 토스 리더보드가 하나뿐이라 "이 앱을 얼마나 두루 잘하는가"를 한 숫자로 나타내야 한다.

## 남은 작업

사용자가 요청했고 아직 안 한 것들. 순서는 의존성 기준.

### 1. 기반
- [ ] `platform.js`를 실제로 화면에 연결 (별명 표시, 종합 점수 제출, 순위 보기 버튼)
- [ ] 뒤로가기: 게임 중 → 홈, 홈에서 → 두 번 눌러 나가기 (지금은 없음)
- [ ] 기록 보기 화면: 종목별 내 최고점 / 최근 점수 / 최단 시간 / 최고 레벨

### 2. 게임별
- [ ] **집중력**: 3종목(반응속도·스트룹·고노고) 중 골라서 하기
      - 1개 고르면 5판, 2개면 각 3판, 3개면 지금처럼 각 1판
      - 3개 모두 하기에서 각 기준을 충족하면 레벨업. 상한 없음
- [ ] **기억력**: 시간 측정 + 레벨 도입. 레벨이 오르면 칸 수와 격자 크기 증가
      (지금은 격자 4×4~7×7, `gridSizeFor()` 참고)
- [ ] **나침반**: 1단계는 지시를 하나씩 보여주고 "확인"을 눌러야 다음으로.
      2단계부터는 지금처럼 자동으로 넘어간다
- [ ] **24 만들기**: 1분 안에 몇 문제 푸는지 재는 모드 추가 (기존 모드는 유지)
- [ ] **예측 불가**: 기록 항목 추가

### 3. 출시 준비
- [ ] 앱인토스 콘솔 가입, 미니앱 등록, 리더보드 생성
- [ ] `@apps-in-toss/web-framework` 설치 → 번들러 도입 필요 (지금은 빌드 없음)
- [ ] `platform.js`의 `loadSdk()`를 실제 import로 교체
- [ ] localStorage → 토스 Storage 이관 (비동기라 `storage.js` 손봐야 함)
- [ ] 게임 출시 가이드 / 서비스별 주의사항 확인
- [ ] 사업자 등록: 인앱광고·인앱결제·토스페이를 쓸 때만 필요

## 주의

- `Game.setLeaderboardScore`는 게임 카테고리 미니앱에서만 동작한다. 다른 카테고리면 `INVALID_CATEGORY`.
- 반환되는 hash는 서버 API 호출용 토큰이 아니다. 사용자 구분용일 뿐.
- 샌드박스에서는 가짜 데이터가 올 수 있다.
