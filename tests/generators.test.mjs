// 문제 생성기 검사 — 종목마다 수천 번 돌려 "정답이 하나이고 입력할 수 있는가"를 본다.
// 이 검사에서 실제로 잡힌 것들: 함정 퀴즈 해설이 정답과 모순(함정 답 = 정답),
// 규칙 찾기 정답이 둘(2·3·5·8), 수 비교 두 값이 같음.
import { expose, collector } from './_load.mjs';

export const name = '문제 생성기';

export async function run() {
  const c = collector();

  // ---------- 암산: 키패드로 넣을 수 있는 답인가 ----------
  {
    const m = await expose('js/games/math.js', ['genProblem']);
    for (let lv = -1; lv <= 14; lv += 0.5) {
      for (let i = 0; i < 2000; i++) {
        const p = m.genProblem(lv);
        if (!Number.isInteger(p.a)) c.note('암산: 답이 정수가 아님 (키패드에 소수점이 없다)', `${p.q} = ${p.a}`);
        else if (p.a <= 0) c.note('암산: 답이 0 이하 (키패드에 −가 없다)', `${p.q} = ${p.a}`);
        if (String(p.a).length > 7) c.note('암산: 답이 7자리 초과 (입력 한도)', `${p.q} = ${p.a}`);
        if (/NaN|undefined/.test(p.q)) c.note('암산: 문제 글자 오류', p.q);
      }
    }
  }

  // ---------- 수 비교: 정답이 있고 한쪽으로 쏠리지 않는가 ----------
  {
    const m = await expose('js/games/compare.js', ['genPair']);
    for (let L = 0; L <= 12; L += 0.5) {
      let leftBig = 0;
      const N = 3000;
      for (let i = 0; i < N; i++) {
        const p = m.genPair(L);
        if (p.left.v === p.right.v) c.note('수 비교: 두 값이 같음 (정답 없음)', `${p.left.text} vs ${p.right.text}`);
        if (!(p.right.v > 0) || !Number.isFinite(p.left.v)) c.note('수 비교: 값 이상', JSON.stringify(p));
        if (p.left.v > p.right.v) leftBig++;
      }
      const r = leftBig / N;
      // 한쪽이 자주 크면 문제를 안 읽고 그쪽만 눌러도 된다
      if (r < 0.44 || r > 0.56) c.note(`수 비교: 왼쪽이 큰 비율이 치우침`, `L=${L} → ${r.toFixed(2)}`);
    }
  }

  // ---------- 규칙 찾기: 정답이 하나뿐인가 ----------
  {
    const m = await expose('js/games/pattern.js', ['genPuzzle', 'distractors', 'otherReadings']);
    for (let L = 0; L <= 8; L += 0.5) {
      for (let i = 0; i < 3000; i++) {
        const p = m.genPuzzle(L);
        const ds = m.distractors(p);
        const all = [p.ans, ...ds];
        if (ds.length !== 3 || new Set(all).size !== 4) c.note('규칙 찾기: 보기가 4개(중복 없이)가 아님', JSON.stringify(all));
        if (all.some(v => !Number.isInteger(v) || v <= 0)) c.note('규칙 찾기: 보기가 양의 정수가 아님', JSON.stringify(all));
        const alt = m.otherReadings(p.seq);
        alt.delete(p.ans);
        if (alt.size) c.note('규칙 찾기: 수열이 다른 규칙으로도 읽힘 (정답이 둘)', `${p.seq.join(',')} → ${p.ans}(${p.rule}) / 다른 답 ${[...alt]}`);
      }
    }
  }

  // ---------- 목표 수 만들기: 실제로 풀리는가 ----------
  {
    const m = await expose('js/games/t24.js', ['makePuzzle', 'solve24', 'solveInt']);
    for (let L = 0; L <= 8; L++) {
      for (let i = 0; i < 300; i++) {
        const p = m.makePuzzle(L);
        if (!p.sol || !m.solve24(p.nums, p.target)) c.note('목표 수: 못 푸는 문제', JSON.stringify(p));
        if (!p.frac && !m.solveInt(p.nums, p.target)) c.note('목표 수: 정수 풀이가 없는데 정수 문제로 표시', JSON.stringify(p));
        if (p.nums.length !== 4 || p.nums.some(n => n < 1)) c.note('목표 수: 숫자 4개가 아님', JSON.stringify(p));
      }
    }
  }

  // ---------- 함정 퀴즈: 보기 넷, 정답 포함, 함정이 정답과 다름 ----------
  {
    const m = await expose('js/games/trap.js', ['FAMILIES', 'choicesFor']);
    for (const [fam, , gen] of m.FAMILIES) {
      for (let i = 0; i < 1500; i++) {
        // 게임과 같은 규칙: 함정 답이 정답과 같으면 다시 뽑는다 (trap.js next())
        let p = gen();
        for (let t = 0; t < 30 && Math.round(p.trap) === p.ans; t++) p = gen();
        if (Math.round(p.trap) === p.ans) c.note(`함정 퀴즈(${fam}): 다시 뽑아도 함정 답이 정답과 같음 — 해설이 모순된다`, p.q.replace(/<[^>]+>/g, '').slice(0, 70));
        if (!Number.isInteger(p.ans) || p.ans <= 0) c.note(`함정 퀴즈(${fam}): 정답이 양의 정수가 아님`, p.ans);
        if (/undefined|NaN|Infinity/.test(p.q + p.why)) c.note(`함정 퀴즈(${fam}): 문제·해설 글자 오류`, (p.q + p.why).replace(/<[^>]+>/g, '').slice(0, 90));
        const ch = m.choicesFor(p);
        if (ch.length !== 4 || new Set(ch).size !== 4 || !ch.includes(p.ans)) c.note(`함정 퀴즈(${fam}): 보기 오류`, JSON.stringify(ch));
      }
    }
  }

  return c;
}
