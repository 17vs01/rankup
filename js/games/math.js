// 암산 스프린트 (60초)
// 난이도는 레이팅을 따라 상승. 기대 정답수는 레이팅 무관 ~11개로 자기평형.
import { sfx } from '../audio.js';
import { comboTick } from '../feedback.js';

const DURATION = 60;
const EXPECTED = 11;
// 최상위 문제(레벨 7.5+)부터는 문제가 더 어려워지지 않는다. 기대치까지 멈추면
// 천장에 닿은 사람은 판마다 LP가 오르기만 한다. 그 뒤로는 기대 정답 수를 올린다.
const TOP_LEVEL = 7.5;
const expectedFor = level => EXPECTED * (1 + 0.08 * Math.max(0, level - TOP_LEVEL));

// 데일리 챌린지면 ctx.rng(시드 난수)가 들어온다. 평소엔 Math.random.
let rnd = Math.random;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = arr => arr[ri(0, arr.length - 1)];

// 레벨별 문제 생성기. 레벨 = (rating-800)/150
function genProblem(level) {
  // 현재 레벨 ±1 범위에서 문제 유형 선택 (약간의 변주)
  const L = Math.max(0, level + (rnd() - 0.5) * 1.6);
  if (L < 1) {
    if (rnd() < 0.5) { const a = ri(3, 9), b = ri(3, 9); return { q: `${a} + ${b}`, a: a + b }; }
    const a = ri(5, 18), b = ri(2, Math.min(9, a - 1)); return { q: `${a} − ${b}`, a: a - b };
  }
  if (L < 2) {
    return pick([
      () => { const a = ri(12, 89), b = ri(3, 9); return { q: `${a} + ${b}`, a: a + b }; },
      () => { const a = ri(12, 89), b = ri(3, 9); return { q: `${a} − ${b}`, a: a - b }; },
      () => { const a = ri(3, 9), b = ri(3, 9); return { q: `${a} × ${b}`, a: a * b }; },
    ])();
  }
  if (L < 3) {
    return pick([
      () => { const a = ri(23, 98), b = ri(12, 89); return { q: `${a} + ${b}`, a: a + b }; },
      () => { const a = ri(41, 99), b = ri(12, a - 10); return { q: `${a} − ${b}`, a: a - b }; },
      () => { const a = ri(12, 29), b = ri(3, 9); return { q: `${a} × ${b}`, a: a * b }; },
      () => { const b = ri(3, 9), c = ri(4, 12); return { q: `${b * c} ÷ ${b}`, a: c }; },
    ])();
  }
  if (L < 4) {
    return pick([
      () => { const a = ri(123, 899), b = ri(45, 99); return { q: `${a} + ${b}`, a: a + b }; },
      () => { const a = ri(200, 999), b = ri(45, 178); return { q: `${a} − ${b}`, a: a - b }; },
      () => { const a = ri(13, 49), b = ri(4, 9); return { q: `${a} × ${b}`, a: a * b }; },
      () => { const b = ri(4, 12), c = ri(6, 19); return { q: `${b * c} ÷ ${b}`, a: c }; },
      // 답이 정수가 되도록: 25%는 20의 배수에만 건다 (키패드에 소수점이 없다)
      () => { const a = pick([10, 20, 25, 50]), b = a === 25 ? ri(1, 8) * 20 : ri(2, 16) * 10; return { q: `${b}의 ${a}%`, a: b * a / 100 }; },
    ])();
  }
  if (L < 5.5) {
    return pick([
      () => { const a = ri(234, 899), b = ri(123, 789); return { q: `${a} + ${b}`, a: a + b }; },
      () => { const a = ri(400, 999), b = ri(123, a - 100); return { q: `${a} − ${b}`, a: a - b }; },
      () => { const a = ri(12, 24), b = ri(11, 19); return { q: `${a} × ${b}`, a: a * b }; },
      () => { const a = ri(13, 25); return { q: `${a}²`, a: a * a }; },
      () => { const a = pick([5, 15, 30, 40, 60, 75]), b = (a % 10 === 5) ? ri(1, 10) * 20 : ri(2, 20) * 10; return { q: `${b}의 ${a}%`, a: b * a / 100 }; },
      () => { const b = ri(12, 19), c = ri(6, 15); return { q: `${b * c} ÷ ${b}`, a: c }; },
    ])();
  }
  if (L < TOP_LEVEL) {
    return pick([
      () => { const a = ri(1234, 8999), b = ri(234, 999); return { q: `${a} + ${b}`, a: a + b }; },
      () => { const a = ri(23, 59), b = ri(21, 49); return { q: `${a} × ${b}`, a: a * b }; },
      () => { const a = ri(24, 39); return { q: `${a}²`, a: a * a }; },
      () => { const a = ri(3, 9), b = ri(3, 9), c = ri(3, 9); return { q: `${a} × ${b} + ${c}²`, a: a * b + c * c }; },
      () => { const a = pick([12.5, 35, 45, 65, 85]), b = a === 12.5 ? ri(2, 12) * 40 : ri(4, 24) * 20; return { q: `${b}의 ${a}%`, a: b * a / 100 }; },
    ])();
  }
  // L 7.5+ : 최상위 (여기서부터는 expectedFor가 기준을 올린다)
  return pick([
    () => { const a = ri(34, 99), b = ri(34, 99); return { q: `${a} × ${b}`, a: a * b }; },
    () => { const a = ri(4567, 9899), b = ri(1234, 4321); return { q: `${a} − ${b}`, a: a - b }; },
    () => { const a = ri(31, 49); return { q: `${a}²`, a: a * a }; },
    () => { const a = ri(11, 19), b = ri(11, 19), c = ri(11, 29); return { q: `${a} × ${b} − ${c}`, a: a * b - c }; },
    () => { const a = ri(6, 12); return { q: `${a}³`, a: a * a * a }; },
  ])();
}

export const mathGame = {
  id: 'math',
  name: '암산',
  icon: '🧮',
  desc: '60초 연산 스프린트',
  run(ctx) {
    rnd = ctx.rng || Math.random;
    const level = (ctx.rating - 800) / 150;
    let correct = 0, wrong = 0, streak = 0, input = '', cur = null;

    ctx.body.innerHTML = `
      <div class="score-line" id="m-score">정답 <b>0</b> · 오답 0</div>
      <div class="problem" id="m-problem"></div>
      <div class="answer-display" id="m-answer">&nbsp;</div>
      <div class="keypad" id="m-pad"></div>
    `;
    const $p = ctx.body.querySelector('#m-problem');
    const $a = ctx.body.querySelector('#m-answer');
    const $s = ctx.body.querySelector('#m-score');
    const $pad = ctx.body.querySelector('#m-pad');

    const keys = ['7','8','9','4','5','6','1','2','3','⌫','0','OK'];
    for (const k of keys) {
      const b = document.createElement('button');
      b.className = 'key' + (k === '⌫' ? ' key-action' : '') + (k === 'OK' ? ' key-ok' : '');
      b.textContent = k;
      b.dataset.k = k;
      $pad.appendChild(b);
    }

    function next() {
      cur = genProblem(level);
      cur.missed = false;
      input = '';
      $p.textContent = `${cur.q} = ?`;
      $a.innerHTML = '&nbsp;';
    }

    function updateScore() {
      $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`
        + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
    }

    function tryAutoSubmit(forceJudge) {
      // 정답과 일치하면 즉시 통과 (제출 버튼 없이 속도감).
      // 답과 자릿수가 같아졌는데 틀렸거나 OK를 눌렀으면 오답이다.
      // 예전에는 자릿수를 "넘겨야" 오답이라, 두 자리 답을 ⌫로 지워 가며 벌점 없이
      // 찍어볼 수 있었다. 지금은 한 번 틀리면 오답 1개를 세고 한 번 더 기회를 준다
      // (오타 구제). 두 번째도 틀리면 정답을 보여주고 넘어간다.
      if (input === '') return;
      const val = parseFloat(input);
      const full = input.length >= String(cur.a).length;
      if (!forceJudge && val !== cur.a && !full) return;
      if (val !== cur.a && !cur.missed) {
        cur.missed = true;
        wrong++; streak = 0; sfx.bad();
        ctx.body.classList.remove('flash-good', 'flash-bad'); void ctx.body.offsetWidth;
        ctx.body.classList.add('flash-bad');
        updateScore();
        input = '';
        $a.textContent = '한 번 더';
        return;
      }
      if (val === cur.a) {
        correct++; streak++; sfx.combo(streak);
        comboTick(ctx.body, streak);
        // 같은 클래스가 남아 있으면 애니메이션이 다시 안 돈다 — 둘 다 뗀 뒤 리플로
        ctx.body.classList.remove('flash-bad', 'flash-good'); void ctx.body.offsetWidth;
        ctx.body.classList.add('flash-good');
        updateScore(); next();
      } else {
        streak = 0; sfx.bad();   // 오답은 첫 번째 틀렸을 때 이미 셌다
        ctx.body.classList.remove('flash-good', 'flash-bad'); void ctx.body.offsetWidth;
        ctx.body.classList.add('flash-bad');
        $p.textContent = `${cur.q} = ${cur.a}`;
        updateScore();
        // 정답이 공개된 700ms 동안 입력을 잠근다 (cur가 없으면 키패드가 무시된다)
        cur = null;
        input = '';
        $a.innerHTML = '&nbsp;';
        ctx.delay(() => next(), 700);
      }
    }

    $pad.addEventListener('pointerdown', e => {
      const k = e.target.dataset && e.target.dataset.k;
      if (!k || !cur) return;
      e.preventDefault();
      if (k === '⌫') { input = input.slice(0, -1); $a.textContent = input || ' '; return; }
      else if (k === 'OK') { tryAutoSubmit(true); return; }
      else if (input.length < 7) input += k;
      $a.textContent = input || ' ';
      tryAutoSubmit(false);
    });

    next();
    ctx.timer(DURATION, () => {
      const score = correct;
      const perf = (correct - wrong * 0.5) / expectedFor(level);
      ctx.finish({
        score,
        perf,
        detail: `정답 ${correct} · 오답 ${wrong}`,
      });
    });
  },
};
