// 토스용 index.html을 웹판에서 만들어낸다.
//
// 마크업을 두 벌로 두면 반드시 어긋난다. 화면을 고칠 때 웹판만 고치면 되도록
// 빌드할 때마다 여기서 찍어낸다. 토스판에서 빼는 것은 두 가지뿐이다.
//   - manifest / 아이콘 : 토스가 미니앱 껍데기를 씌워준다
//   - 서비스워커 등록   : 토스 WebView가 자체 캐시를 쓴다
import { readFileSync, writeFileSync } from 'node:fs';

// 저장소가 CRLF로 체크아웃되므로 먼저 정규화한다. 안 그러면 정규식이 조용히 빗나간다.
const src = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .split('\r\n').join('\n');

const out = src
  // 자원 경로가 toss/ 기준으로 한 칸 올라간다
  .replace('href="css/style.css"', 'href="../css/style.css"')
  // 본체 대신 SDK를 먼저 꽂는 진입점을 태운다
  .replace('<script type="module" src="js/main.js"></script>',
    '<script type="module" src="./entry.js"></script>')
  // PWA 껍데기는 토스가 씌운다
  .replace(/^.*<link rel="(manifest|icon|apple-touch-icon)".*\n/gm, '')
  // 서비스워커 등록 블록 제거
  .replace(/<script>\nif \('serviceWorker' in navigator[\s\S]*?<\/script>\n/, '');

// 하나라도 남으면 토스에서 조용히 깨지므로 여기서 잡는다
for (const [what, re] of [
  ['서비스워커 등록', /serviceWorker/],
  ['웹판 main.js 참조', /src="js\/main\.js"/],
  ['manifest 링크', /rel="manifest"/],
]) {
  if (re.test(out)) throw new Error(`토스용 HTML에 ${what}가 남아 있습니다`);
}
if (!out.includes('./entry.js')) throw new Error('진입점이 안 붙었습니다');

writeFileSync(new URL('../toss/index.html', import.meta.url), out);
console.log('toss/index.html 생성 완료');
