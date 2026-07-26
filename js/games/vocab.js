// 어휘 스피드 퀴즈 (60초, 4지선다)
// 레이팅에 따라 단어 티어 상승. 틀린 단어는 라이트너 박스로 재등장.
import { VOCAB } from '../data/vocab.js';
import { sfx } from '../audio.js';

const DURATION = 60;
const EXPECTED = 13;

const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 레이팅 → 주력 티어 (0~3)
function mainTier(rating) {
  return Math.max(0, Math.min(3, Math.floor((rating - 800) / 400)));
}

export const vocabGame = {
  id: 'vocab',
  name: '어휘',
  icon: '📖',
  desc: '60초 영단어 스피드 퀴즈',
  run(ctx) {
    const tier = mainTier(ctx.rating);
    const vocabState = ctx.state.vocab; // wordIdx -> {box, due}
    let correct = 0, wrong = 0, cur = null, locked = false;

    // 출제 풀: 복습 예정 단어 우선 + 주력 티어 (아래위 티어 소량 혼합)
    const now = Date.now();
    const dueIdx = [];
    const poolIdx = [];
    VOCAB.forEach((v, i) => {
      const st = vocabState[i];
      if (st && st.due <= now && st.box < 3) dueIdx.push(i);
      const dt = v.t - tier;
      if (dt === 0 || (dt === -1 && Math.random() < 0.25) || (dt === 1 && Math.random() < 0.15)) {
        poolIdx.push(i);
      }
    });
    const queue = shuffle(dueIdx).concat(shuffle(poolIdx));
    let qi = 0;

    ctx.body.innerHTML = `
      <div class="score-line" id="v-score">정답 <b>0</b> · 오답 0</div>
      <div class="problem word" id="v-word"></div>
      <div class="choices" id="v-choices"></div>
    `;
    const $w = ctx.body.querySelector('#v-word');
    const $c = ctx.body.querySelector('#v-choices');
    const $s = ctx.body.querySelector('#v-score');

    function distractors(word) {
      // 같은 티어 위주로 오답 3개
      const sameTier = VOCAB.filter(v => v !== word && Math.abs(v.t - word.t) <= 1);
      return shuffle(sameTier).slice(0, 3).map(v => v.m);
    }

    function updateLeitner(idx, ok) {
      const st = vocabState[idx] || { box: 1, due: 0 };
      if (ok) {
        st.box = Math.min(5, st.box + 1);
        st.due = now + st.box * 24 * 3600 * 1000;
      } else {
        st.box = 0;
        st.due = now; // 다음 세션에 바로 재등장
      }
      vocabState[idx] = st;
    }

    function next() {
      if (qi >= queue.length) qi = 0;
      const idx = queue[qi++];
      cur = { idx, word: VOCAB[idx] };
      locked = false;
      $w.textContent = cur.word.w;
      const opts = shuffle([cur.word.m, ...distractors(cur.word)]);
      $c.innerHTML = '';
      for (const m of opts) {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = m;
        b.addEventListener('pointerdown', () => answer(b, m), { once: true });
        $c.appendChild(b);
      }
    }

    function answer(btn, m) {
      if (locked) return;
      locked = true;
      const ok = m === cur.word.m;
      updateLeitner(cur.idx, ok);
      if (ok) {
        correct++; sfx.good();
        btn.classList.add('correct');
        $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`;
        ctx.delay(next, 180);
      } else {
        wrong++; sfx.bad();
        btn.classList.add('wrong');
        // 정답 표시
        for (const c of $c.children) {
          if (c.textContent === cur.word.m) c.classList.add('correct');
        }
        $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`;
        ctx.delay(next, 900);
      }
    }

    next();
    ctx.timer(DURATION, () => {
      const perf = (correct - wrong * 0.5) / EXPECTED;
      ctx.finish({
        score: correct,
        perf,
        detail: `정답 ${correct} · 오답 ${wrong}`,
      });
    });
  },
};
