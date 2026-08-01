// 규칙 찾기 — 수열의 숨은 규칙을 추론한다 (60초)
// 수 몇 개가 어떤 규칙을 따라 늘어서 있다. 규칙을 알아내서 다음 수를 고른다.
// 틀리면 규칙을 보여준다 — "아하"가 다음 판의 무기가 되는, 순수 귀납 추론 종목.
import { sfx } from '../audio.js';

const DURATION = 60;
const EXPECTED = 7;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[ri(0, arr.length - 1)];
const shuffle = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

// ---------- 규칙 가족 ----------
// 각각 { seq, ans, rule } 반환. L이 오르면 숫자가 커지고 가족이 늘어난다.

function genArith(L) {          // 등차: +d
  const d = ri(2, 4 + Math.round(L * 3));
  const a = ri(1, 10 + Math.round(L * 10));
  return { seq: [a, a + d, a + 2 * d, a + 3 * d], ans: a + 4 * d, rule: `+${d}` };
}

function genGeo(L) {            // 등비: ×r
  const r = L < 2 ? 2 : pick([2, 2, 3]);
  const a = ri(1, 4 + Math.round(L));
  const seq = [a, a * r, a * r * r, a * r * r * r];
  return { seq, ans: seq[3] * r, rule: `× ${r}` };
}

function genAlt(L) {            // 번갈아 더하기: +a, +b
  const a = ri(2, 5 + Math.round(L * 2));
  let b = ri(2, 5 + Math.round(L * 2));
  if (b === a) b += 1;
  const s = ri(1, 12);
  const seq = [s, s + a, s + a + b, s + 2 * a + b];
  return { seq, ans: s + 2 * a + 2 * b, rule: `+${a}, +${b} 번갈아` };
}

function genAccel(L) {          // 계차 등차: 더하는 수가 커진다
  const d = ri(1, 3 + Math.round(L));
  const s = ri(1, 2 + Math.round(L / 2));
  const a = ri(1, 10);
  const seq = [a, a + d, a + 2 * d + s, a + 3 * d + 3 * s];
  return { seq, ans: a + 4 * d + 6 * s, rule: `+${d}, +${d + s}, +${d + 2 * s}… (커지는 덧셈)` };
}

function genFib() {             // 앞 두 수의 합
  const a = ri(1, 5), b = ri(2, 7);
  const c = a + b, d = b + c;
  return { seq: [a, b, c, d], ans: c + d, rule: '앞 두 수의 합' };
}

function genSquare(L) {         // 제곱수 (+c)
  const c = L < 3 ? 0 : ri(0, 3);
  const n = ri(1, 3);
  const seq = [0, 1, 2, 3].map(i => (n + i) * (n + i) + c);
  return { seq, ans: (n + 4) * (n + 4) + c, rule: `제곱수${c ? ` + ${c}` : ''} (${n}², ${n + 1}²…)` };
}

function genMulAdd(L) {         // ×k + c
  const k = 2, c = ri(1, 4);
  const a = ri(1, 5 + Math.round(L));
  const seq = [a];
  for (let i = 0; i < 3; i++) seq.push(seq[seq.length - 1] * k + c);
  return { seq, ans: seq[3] * k + c, rule: `× ${k} + ${c}` };
}

function genInterleave(L) {     // 두 수열이 번갈아
  const da = ri(2, 4 + Math.round(L)), db = ri(2, 4 + Math.round(L));
  const a = ri(1, 12), b = ri(1, 12);
  const seq = [a, b, a + da, b + db, a + 2 * da];
  return { seq, ans: b + 2 * db, rule: `두 수열이 번갈아 (+${da} / +${db})` };
}

function genPuzzle(L) {
  const pool = [genArith, genGeo, genAlt];
  if (L >= 1) pool.push(genAccel, genFib);
  if (L >= 2) pool.push(genSquare);
  if (L >= 3) pool.push(genMulAdd, genInterleave);
  for (let t = 0; t < 20; t++) {
    const p = pick(pool)(L);
    if (p.ans <= 999 && p.seq.every(v => v >= 0 && v <= 999)) return p;
  }
  return genArith(0);
}

// 그럴듯한 오답 3개 — "마지막 차이를 반복" 같은 흔한 착각을 일부러 넣는다
function distractors(p) {
  const last = p.seq[p.seq.length - 1];
  const lastDiff = last - p.seq[p.seq.length - 2];
  const cands = [
    last + lastDiff,                 // 차이가 계속 같다고 착각
    p.ans + ri(1, 3),
    p.ans - ri(1, 3),
    p.ans + lastDiff,
    last * 2,
  ];
  const out = [];
  for (const c of cands) {
    if (c !== p.ans && c > 0 && !out.includes(c)) out.push(c);
    if (out.length === 3) break;
  }
  while (out.length < 3) {
    const c = p.ans + ri(4, 9) * (Math.random() < 0.5 ? 1 : -1);
    if (c !== p.ans && c > 0 && !out.includes(c)) out.push(c);
  }
  return out;
}

export const patternGame = {
  id: 'pattern',
  name: '규칙 찾기',
  icon: '🕵️',
  desc: '수열의 숨은 규칙 추론',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 1000) / 200);

    let correct = 0, wrong = 0, streak = 0, bestStreak = 0;
    let cur = null, locked = false;

    ctx.body.innerHTML = `
      <div class="score-line" id="pt-score">정답 <b>0</b> · 오답 0</div>
      <div class="pt-seq" id="pt-seq"></div>
      <div class="choices-grid" id="pt-choices"></div>
      <div class="pt-fb" id="pt-fb">규칙을 찾아 다음 수를 고르세요</div>
    `;
    const $score = ctx.body.querySelector('#pt-score');
    const $seq = ctx.body.querySelector('#pt-seq');
    const $c = ctx.body.querySelector('#pt-choices');
    const $fb = ctx.body.querySelector('#pt-fb');

    function renderScore() {
      $score.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`
        + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
    }

    function next() {
      cur = genPuzzle(L);
      locked = false;
      $seq.innerHTML = cur.seq.map(v => `<span>${v}</span>`).join('<i>·</i>')
        + '<i>·</i><span class="pt-q">?</span>';
      $fb.textContent = '';
      $fb.className = 'pt-fb';
      $c.innerHTML = '';
      for (const v of shuffle([cur.ans, ...distractors(cur)])) {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = v;
        b.addEventListener('pointerdown', e => { e.preventDefault(); answer(b, v); }, { once: true });
        $c.appendChild(b);
      }
    }

    function answer(btn, v) {
      if (locked) return;
      locked = true;
      const ok = v === cur.ans;
      if (ok) {
        correct++; streak++; bestStreak = Math.max(bestStreak, streak);
        sfx.combo(streak);
        btn.classList.add('correct');
        // 맞혔어도 규칙을 잠깐 보여준다 — 찍어서 맞힌 것도 배움이 되게
        $fb.textContent = `규칙: ${cur.rule}`;
        $fb.className = 'pt-fb good';
        renderScore();
        ctx.delay(next, 450);
      } else {
        wrong++; streak = 0;
        sfx.bad();
        btn.classList.add('wrong');
        for (const c of $c.children) if (Number(c.textContent) === cur.ans) c.classList.add('correct');
        $fb.textContent = `규칙: ${cur.rule} → 정답 ${cur.ans}`;
        $fb.className = 'pt-fb bad';
        renderScore();
        ctx.delay(next, 1600);
      }
    }

    next();
    ctx.timer(DURATION, () => {
      ctx.finish({
        score: correct,
        perf: (correct - wrong * 0.5) / EXPECTED,
        detail: `정답 ${correct} · 오답 ${wrong} · 최고 ${bestStreak}연속`,
        time: bestStreak > 0
          ? { key: 'pt_streak', value: bestStreak, unit: 'count', label: '최다 연속' } : null,
      });
    });
  },
};
