// npm test — 브라우저 없이 돌릴 수 있는 검사를 전부 돌린다.
//
// 문제를 고치거나 종목을 추가한 뒤에 돌린다. 화면 흐름(버튼을 누르면 결과까지 가는가)은
// 여기서 못 본다 — 그건 브라우저에서 직접 한 판 해봐야 한다.
const SUITES = ['static', 'generators', 'storage', 'balance'];

let failed = 0;
for (const s of SUITES) {
  const t0 = Date.now();
  let name = s;
  try {
    const mod = await import(`./${s}.test.mjs`);
    name = mod.name || s;
    const c = await mod.run();
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    if (c.failed) {
      failed++;
      console.log(`✗ ${name} (${sec}초)\n${c.report()}`);
    } else {
      console.log(`✓ ${name} (${sec}초)`);
    }
  } catch (e) {
    failed++;
    console.log(`✗ ${name} — 검사 자체가 죽음\n    ${e.stack || e}`);
  }
}

console.log(failed ? `\n${failed}개 묶음 실패` : '\n전부 통과');
process.exit(failed ? 1 : 0);
