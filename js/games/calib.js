// 확신도 — 캘리브레이션 훈련
// 답만 맞히는 게임이 아니다. "내가 얼마나 확신하는지"를 함께 찍고 브라이어 점수로 채점한다.
// 90% 확신하고 틀리면 크게 깎이고, 60% 확신하고 틀리면 거의 안 깎인다.
// 훈련되는 건 지식이 아니라 자기 실력을 아는 능력.
import { VOCAB } from '../data/vocab.js';
import { sfx } from '../audio.js';

const ROUNDS = 10;
const LEVELS = [50, 60, 70, 80, 90, 100];

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; } return x; };

// 참/거짓 문제를 절차적으로 생성 — 난이도가 레이팅을 따라간다
function makeQuestion(L) {
  const kind = ri(0, 3);
  if (kind === 0) {
    // 암산 참/거짓
    const a = ri(12, 20 + Math.floor(L * 12)), b = ri(11, 15 + Math.floor(L * 8));
    const real = a * b;
    const off = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1) * ri(1, Math.max(2, Math.round(real * 0.04)));
    const shown = real + off;
    return { q: `${a} × ${b} = ${shown}`, truth: off === 0 };
  }
  if (kind === 1) {
    // 어휘 참/거짓
    const tier = Math.max(0, Math.min(3, Math.floor(L * 1.2)));
    const pool = VOCAB.filter(v => Math.abs(v.t - tier) <= 1);
    const w = pool[ri(0, pool.length - 1)];
    const same = Math.random() < 0.5;
    const other = pool[ri(0, pool.length - 1)];
    const meaning = same ? w.m : (other.m === w.m ? pool[ri(0, pool.length - 1)].m : other.m);
    return { q: `${w.w} = ${meaning}`, truth: meaning === w.m };
  }
  if (kind === 2) {
    // 크기 비교
    const a = ri(2, 9 + Math.floor(L * 4)), b = ri(2, 9 + Math.floor(L * 4));
    const c = ri(2, 9 + Math.floor(L * 4)), d = ri(2, 9 + Math.floor(L * 4));
    return { q: `${a}×${b} 가 ${c}×${d} 보다 크다`, truth: a * b > c * d };
  }
  // 제곱/거듭제곱 감각
  const a = ri(11, 20 + Math.floor(L * 15));
  const real = a * a;
  const off = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1) * ri(1, Math.max(3, Math.round(real * 0.03)));
  return { q: `${a}² = ${real + off}`, truth: off === 0 };
}

export const calibGame = {
  id: 'calib',
  name: '확신도',
  icon: '🎯',
  desc: '답 + 얼마나 확신하는지',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 800) / 400);
    let round = 0, correct = 0;
    let brierSum = 0;
    const buckets = {};   // 확신도별 실제 적중률
    let cur = null, myAnswer = null;

    ctx.body.innerHTML = `
      <div class="cb-round" id="cb-round"></div>
      <div class="cb-q" id="cb-q"></div>
      <div class="cb-step" id="cb-step1">
        <div class="cb-label">맞습니까?</div>
        <div class="cb-tf">
          <button class="cb-btn yes" data-a="1">맞다</button>
          <button class="cb-btn no" data-a="0">아니다</button>
        </div>
      </div>
      <div class="cb-step hidden" id="cb-step2">
        <div class="cb-label">얼마나 확신하나요?</div>
        <div class="cb-conf" id="cb-conf"></div>
      </div>
      <div class="cb-feedback" id="cb-fb"></div>
    `;
    const $round = ctx.body.querySelector('#cb-round');
    const $q = ctx.body.querySelector('#cb-q');
    const $s1 = ctx.body.querySelector('#cb-step1');
    const $s2 = ctx.body.querySelector('#cb-step2');
    const $conf = ctx.body.querySelector('#cb-conf');
    const $fb = ctx.body.querySelector('#cb-fb');

    for (const p of LEVELS) {
      const b = document.createElement('button');
      b.className = 'cb-conf-btn';
      b.dataset.p = p;
      b.textContent = p + '%';
      $conf.appendChild(b);
    }

    function next() {
      round++;
      if (round > ROUNDS) return end();
      cur = makeQuestion(L);
      myAnswer = null;
      $round.textContent = `${round} / ${ROUNDS}라운드`;
      $q.textContent = cur.q;
      $s1.classList.remove('hidden');
      $s2.classList.add('hidden');
      $fb.textContent = '';
      $fb.className = 'cb-feedback';
    }

    $s1.addEventListener('pointerdown', e => {
      const b = e.target.closest('.cb-btn');
      if (!b || myAnswer !== null) return;
      e.preventDefault();
      myAnswer = b.dataset.a === '1';
      $s1.classList.add('hidden');
      $s2.classList.remove('hidden');
    });

    $conf.addEventListener('pointerdown', e => {
      const b = e.target.closest('.cb-conf-btn');
      if (!b || myAnswer === null) return;
      e.preventDefault();
      const p = Number(b.dataset.p) / 100;
      const ok = myAnswer === cur.truth;
      if (ok) correct++;
      // 브라이어 점수: (확신도 - 실제결과)². 0이 완벽.
      const brier = Math.pow(p - (ok ? 1 : 0), 2);
      brierSum += brier;
      const key = b.dataset.p;
      if (!buckets[key]) buckets[key] = { n: 0, hit: 0 };
      buckets[key].n++; if (ok) buckets[key].hit++;

      $s2.classList.add('hidden');
      if (ok) { sfx.good(); } else { sfx.bad(); }
      const penalty = Math.round(brier * 100);
      $fb.className = 'cb-feedback ' + (brier < 0.1 ? 'good' : brier > 0.45 ? 'bad' : 'ok');
      $fb.innerHTML = ok
        ? `정답 · ${b.textContent} 확신 → 손실 ${penalty}`
        : `<b>오답</b> (${cur.truth ? '맞다' : '아니다'}) · ${b.textContent} 확신 → 손실 ${penalty}`;
      myAnswer = null;
      ctx.delay(next, 1100);
    });

    function end() {
      const avgBrier = brierSum / ROUNDS;
      // 0.25 = 전부 50%로 찍은 것과 동일(무정보). 그보다 낮아야 실력.
      const score = Math.max(0, Math.round((0.25 - avgBrier) * 400));
      // 과신 여부: 평균 확신도 vs 실제 적중률
      let confSum = 0, nTot = 0;
      for (const [p, b] of Object.entries(buckets)) { confSum += Number(p) / 100 * b.n; nTot += b.n; }
      const avgConf = nTot ? confSum / nTot : 0;
      const acc = correct / ROUNDS;
      const gap = Math.round((avgConf - acc) * 100);
      const judge = Math.abs(gap) <= 5 ? '균형' : gap > 0 ? `과신 +${gap}%p` : `과소평가 ${gap}%p`;
      ctx.finish({
        score,
        perf: score / 55,
        detail: `정답 ${correct}/${ROUNDS} · 평균확신 ${Math.round(avgConf * 100)}% · ${judge}`,
      });
    }

    next();
  },
};
