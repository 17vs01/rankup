// 수 비교 — 어림셈으로 대소만 가른다
// "47 × 3" 과 "150" 중 뭐가 큰가. 정확히 계산할 시간은 없고, 자릿수와 어림으로 찍어야 한다.
// 암산이 "정확히 얼마인가"라면 이건 "대충 어느 쪽인가" — 장보기에서 실제로 쓰는 쪽이다.
import { sfx } from '../audio.js';
import { comboTick } from '../feedback.js';

// 오늘의 도전이면 ctx.rng(날짜 시드 난수)가 들어온다. 문제를 만들 때는 반드시 R()을 쓴다 —
// Math.random을 섞으면 같은 날 같은 종목이어도 사람마다 판이 갈린다.
let R = Math.random;

const DURATION = 60;
// 오답 벌점이 1이라(아래 perf 참고) 예전(0.5)보다 순점수가 조금 낮게 나온다. 기대치도 그만큼 내린다.
const EXPECTED = 13;

const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = arr => arr[ri(0, arr.length - 1)];

// 레벨에 따라 문제가 커지고, 두 값의 차이(여유)가 좁아진다
function genPair(L) {
  // margin: 두 값이 이 비율만큼만 차이난다. 좁을수록 어렵다.
  const margin = Math.max(0.04, 0.30 - L * 0.03);
  const make = () => {
    if (L < 1) {
      const a = ri(3, 9), b = ri(3, 9);
      return { text: `${a} × ${b}`, v: a * b };
    }
    if (L < 2.5) {
      return pick([
        () => { const a = ri(11, 29), b = ri(3, 9); return { text: `${a} × ${b}`, v: a * b }; },
        () => { const a = ri(120, 480), b = ri(80, 260); return { text: `${a} + ${b}`, v: a + b }; },
      ])();
    }
    if (L < 4) {
      return pick([
        () => { const a = ri(23, 79), b = ri(4, 19); return { text: `${a} × ${b}`, v: a * b }; },
        () => { const a = ri(12, 28); return { text: `${a}²`, v: a * a }; },
        () => { const a = pick([15, 25, 35, 45]), b = ri(4, 40) * 10; return { text: `${b}의 ${a}%`, v: b * a / 100 }; },
      ])();
    }
    return pick([
      () => { const a = ri(31, 99), b = ri(21, 79); return { text: `${a} × ${b}`, v: a * b }; },
      () => { const a = ri(24, 49); return { text: `${a}²`, v: a * a }; },
      () => { const b = ri(6, 19), c = ri(12, 49); return { text: `${b * c} ÷ ${b}`, v: c }; },
      () => { const a = pick([12.5, 37.5, 62.5, 87.5]), b = ri(4, 24) * 40; return { text: `${b}의 ${a}%`, v: b * a / 100 }; },
    ])();
  };

  const left = make();
  // 오른쪽은 왼쪽 값 근처의 "그냥 숫자" — 계산 대 어림의 대결이 되게
  const bigger = R() < 0.5;
  const ratio = 1 + margin * (0.6 + R() * 0.8);
  let rv = Math.round(bigger ? left.v / ratio : left.v * ratio);
  if (rv === left.v) rv += bigger ? -1 : 1;   // 같은 값은 안 낸다
  return { left, right: { text: String(rv), v: rv } };
}

export const compareGame = {
  id: 'compare',
  name: '수 비교',
  icon: '⚖️',
  desc: '어느 쪽이 큰지 순간 판단',
  run(ctx) {
    R = ctx.rng || Math.random;
    // 시작 레이팅(1000)이 레벨 0이 되게 잡는다. 800 기준으로 재면 첫 판부터
    // 두 자리 곱셈이 나와서 "순간 판단"이 아니라 그냥 어려운 암산이 된다.
    const L = Math.max(0, (ctx.rating - 1000) / 200);
    // 한 문제에 주어지는 시간. 레벨이 오르면 짧아진다.
    const limitMs = Math.max(1500, 4000 - L * 200);

    let correct = 0, wrong = 0, timeout = 0, streak = 0, bestStreak = 0;
    let cur = null, locked = true, bar = null, shownAt = 0;

    ctx.body.innerHTML = `
      <div class="score-line" id="cm-score">정답 <b>0</b> · 오답 0</div>
      <div class="cm-bar"><i id="cm-bar"></i></div>
      <div class="cm-pair">
        <button class="cm-side" id="cm-left"><span id="cm-lt"></span></button>
        <div class="cm-vs">vs</div>
        <button class="cm-side" id="cm-right"><span id="cm-rt"></span></button>
      </div>
      <div class="cm-hint" id="cm-hint">큰 쪽을 탭하세요</div>
    `;
    const $score = ctx.body.querySelector('#cm-score');
    const $bar = ctx.body.querySelector('#cm-bar');
    const $lt = ctx.body.querySelector('#cm-lt');
    const $rt = ctx.body.querySelector('#cm-rt');
    const $left = ctx.body.querySelector('#cm-left');
    const $right = ctx.body.querySelector('#cm-right');
    const $hint = ctx.body.querySelector('#cm-hint');

    function renderScore() {
      $score.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong + timeout}`
        + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
    }

    function next() {
      cur = genPair(L);
      $lt.textContent = cur.left.text;
      $rt.textContent = cur.right.text;
      $left.className = 'cm-side';
      $right.className = 'cm-side';
      $hint.textContent = '';
      locked = false;
      shownAt = ctx.now();

      // 남은 시간 막대. 다 차면 시간 초과.
      if (bar) { bar.stop(); bar = null; }
      $bar.style.width = '100%';
      bar = ctx.interval(() => {
        const left = 1 - (ctx.now() - shownAt) / limitMs;
        if (left <= 0) {
          bar.stop(); bar = null;
          if (!locked) judgeAnswer(null);
          return;
        }
        $bar.style.width = (left * 100) + '%';
      }, 50);
    }

    function judgeAnswer(sideEl) {
      if (locked) return;
      locked = true;
      if (bar) { bar.stop(); bar = null; }
      const leftBigger = cur.left.v > cur.right.v;
      const rightEl = leftBigger ? $left : $right;

      if (sideEl === null) {
        timeout++; streak = 0; sfx.bad();
        $hint.textContent = `시간 초과 · ${cur.left.text} = ${cur.left.v}`;
        rightEl.classList.add('correct');
      } else if ((sideEl === $left) === leftBigger) {
        correct++; streak++; bestStreak = Math.max(bestStreak, streak);
        sfx.combo(streak);
        comboTick(ctx.body, streak);
        sideEl.classList.add('correct');
        $hint.textContent = '';
      } else {
        wrong++; streak = 0; sfx.bad();
        sideEl.classList.add('wrong');
        rightEl.classList.add('correct');
        $hint.textContent = `${cur.left.text} = ${cur.left.v}`;
      }
      renderScore();
      ctx.delay(next, sideEl && (sideEl === $left) === leftBigger ? 220 : 900);
    }

    $left.addEventListener('pointerdown', e => { e.preventDefault(); judgeAnswer($left); });
    $right.addEventListener('pointerdown', e => { e.preventDefault(); judgeAnswer($right); });

    next();
    ctx.timer(DURATION, () => {
      if (bar) { bar.stop(); bar = null; }
      locked = true;
      // 보기가 둘이라 찍어도 절반은 맞는다. 오답 벌점이 0.5면 찍기의 기대값이 +0.25라서,
      // 문제를 안 읽고 한쪽만 연타해도 LP가 올랐다 (정답 42 · 오답 54로 +2 LP).
      // 오답은 정답 하나를 그대로 깎아 찍기의 기대값을 0으로 만든다. 시간 초과는 찍은 게 아니니 0.5.
      const perf = (correct - wrong - timeout * 0.5) / EXPECTED;
      ctx.finish({
        score: correct,
        perf,
        detail: `정답 ${correct} · 오답 ${wrong} · 시간 초과 ${timeout} · 최고 ${bestStreak}연속`,
        time: bestStreak > 0
          ? { key: 'cm_streak', value: bestStreak, unit: 'count', label: '최다 연속' } : null,
      });
    });
  },
};
