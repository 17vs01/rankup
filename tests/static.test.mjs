// 정적 검사 — 실행하지 않고도 잡히는 연결 오류.
// 없는 id를 찾는 코드, 오프라인 캐시 목록에서 빠진 파일, 내보내지 않은 이름을 import하는 코드,
// 그리고 데이터(어휘)의 모양.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, read, collector } from './_load.mjs';

export const name = '연결·데이터';

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []);
}

export async function run() {
  const c = collector();
  const html = read('index.html');
  const files = walk('js');
  const src = Object.fromEntries(files.map(f => [f, read(f)]));
  const all = Object.values(src).join('\n');

  // ---------- 없는 id ----------
  const have = new Set([...html.matchAll(/id="([^"$]+)"/g), ...all.matchAll(/id="([^"$]+)"/g)].map(m => m[1]));
  const want = new Set([...all.matchAll(/\$\('#([\w-]+)'\)/g), ...all.matchAll(/querySelector\('#([\w-]+)'\)/g)].map(m => m[1]));
  for (const id of want) if (!have.has(id)) c.note('코드가 찾는 id가 화면에 없음', `#${id}`);

  // ---------- 서비스워커 캐시 목록 ----------
  const sw = read('sw.js');
  const assets = new Set([...sw.matchAll(/'([^']+\.(?:js|css|html|png|svg|webmanifest))'/g)].map(m => m[1]));
  for (const f of [...files, 'css/style.css', 'index.html']) {
    if (!assets.has(f)) c.note('오프라인 캐시 목록(sw.js ASSETS)에 빠진 파일 — 오프라인에서 앱이 깨진다', f);
  }
  for (const a of assets) if (!fs.existsSync(path.join(ROOT, a))) c.note('캐시 목록에는 있는데 실제로 없는 파일', a);

  // ---------- import한 이름이 실제로 export되는가 ----------
  for (const [f, s] of Object.entries(src)) {
    for (const m of s.matchAll(/^import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/gm)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[2]));
      if (!src[target]) { c.note('import하는 파일이 없음', `${f} → ${m[2]}`); continue; }
      const ex = new Set([...src[target].matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g)].map(x => x[1]));
      for (const n of m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        if (!ex.has(n)) c.note('내보내지 않은 이름을 import함 — 앱이 통째로 안 뜬다', `${f}: ${n} from ${m[2]}`);
      }
    }
  }

  // ---------- 색을 코드에 박지 않는다 ----------
  // 테마와 무관한 색은 밝은 테마에서 배경에 묻힌다 (스트룹의 노랑 글자가 1.4:1이었다)
  for (const f of files.filter(x => x.startsWith('js/games/') || x === 'js/rating.js')) {
    for (const m of src[f].matchAll(/^(?!\s*\/\/).*#[0-9a-fA-F]{6}\b.*$/gm)) {
      c.note('게임 코드에 색이 직접 박혀 있음 (테마 변수 --c-*, --tier-*를 쓸 것)', `${f}: ${m[0].trim().slice(0, 70)}`);
    }
  }

  // ---------- 어휘 데이터 ----------
  const { KOR_VOCAB } = await import(pathToFileURL(path.join(ROOT, 'js/data/korvocab.js')).href);
  const { VOCAB } = await import(pathToFileURL(path.join(ROOT, 'js/data/vocab.js')).href);
  const seenKor = new Set(), seenEng = new Set();
  for (const v of KOR_VOCAB) {
    if (seenKor.has(v.w)) c.note('우리말 단어 중복 — 복습 기록이 단어로 저장되어 서로 덮어쓴다', v.w);
    seenKor.add(v.w);
    if (!Array.isArray(v.d) || v.d.length !== 3 || new Set(v.d).size !== 3) c.note('우리말 오답이 서로 다른 3개가 아님', v.w);
    else if (v.d.includes(v.m)) c.note('우리말 오답에 정답과 같은 뜻이 있음', v.w);
    if (!(v.t >= 0 && v.t <= 3) || !v.m || !v.ex) c.note('우리말 항목에 빠진 값', v.w);
    if (/^\d+$/.test(v.w)) c.note('숫자로만 된 단어 — 옛 복습 기록(번호 키)과 구분할 수 없다', v.w);
  }
  for (const v of VOCAB) {
    if (seenEng.has(v.w)) c.note('영단어 중복', v.w);
    seenEng.add(v.w);
    if (!(v.t >= 0 && v.t <= 3) || !v.m) c.note('영단어 항목에 빠진 값', v.w);
  }
  // 아나그램이 쓸 수 있는 단어(3~5글자 한글, 음절이 전부 같지는 않음)가 티어마다 충분한가
  const usable = KOR_VOCAB.filter(v => /^[가-힣]+$/.test(v.w) && v.w.length >= 3 && v.w.length <= 5 && new Set(v.w).size > 1);
  for (const t of [0, 1, 2, 3]) {
    const n = usable.filter(v => v.t === t).length;
    if (n < 60) c.note('아나그램에 쓸 단어가 모자람 (한 판에 같은 단어가 되풀이된다)', `티어 ${t}: ${n}개`);
  }

  return c;
}
