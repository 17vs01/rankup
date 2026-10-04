// 검사용 로더
//
// 게임 모듈은 문제 생성 함수를 밖으로 내보내지 않고, audio·feedback(브라우저 전용)을
// import한다. 그래서 원본에서 import 줄을 떼고 필요한 내부 함수를 내보내는 사본을
// 임시 폴더에 만들어 불러온다. 원본 파일은 건드리지 않는다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rankup-test-'));
let seq = 0;

export function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/**
 * rel 파일의 내부 이름들을 꺼내 온다.
 * prelude: import를 뗀 자리에 넣을 대역(브라우저 전용 의존성의 가짜 등)
 */
export async function expose(rel, names, prelude = '') {
  let s = read(rel).replace(/^import .*?;\r?\n/gm, '');
  s = s.replace(/^export (const|function|async function|let|class) /gm, '$1 ');
  s = `${prelude}\n${s}\nexport { ${names.join(', ')} };\n`;
  const f = path.join(TMP, `m${seq++}_${path.basename(rel)}.mjs`);
  fs.writeFileSync(f, s);
  return import(pathToFileURL(f).href);
}

// ---------- 실패 모으기 ----------
// 같은 종류의 실패는 한 줄로 묶고 예시 하나만 남긴다 (수천 번 도는 검사라서)
export function collector() {
  const items = new Map();
  return {
    note(msg, example) {
      const hit = items.get(msg);
      if (hit) hit.n++; else items.set(msg, { n: 1, example });
    },
    get failed() { return items.size > 0; },
    report() {
      return [...items.entries()].sort((a, b) => b[1].n - a[1].n)
        .map(([msg, v]) => `    ${String(v.n).padStart(6)}건  ${msg}\n            예: ${typeof v.example === 'string' ? v.example : JSON.stringify(v.example)}`)
        .join('\n');
    },
  };
}
