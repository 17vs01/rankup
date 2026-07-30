// 한국어 어휘 — 글쓰기용
// 순우리말·한자어·헷갈리는 말·글쓰기 표현·관용구를 60초 동안 푼다.
// 영어 어휘와 달리 오답을 즉석에서 뽑지 않고 항목마다 전용 오답을 들고 있다.
// 한국어는 유의어가 촘촘해서 아무 뜻이나 붙이면 "이것도 맞는데?"가 되기 때문.
import { KOR_VOCAB, KOR_CATS } from '../data/korvocab.js';
import { sfx } from '../audio.js';

const DURATION = 60;
const EXPECTED = 11;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

// 레이팅 → 주력 난이도 (0~3)
function mainTier(rating) {
  return Math.max(0, Math.min(3, Math.floor((rating - 800) / 400)));
}

export const korvocabGame = {
  id: 'korvocab',
  name: '우리말',
  icon: '📝',
  desc: '글쓰기가 느는 한국어 어휘',
  run(ctx) {
    const tier = mainTier(ctx.rating);
    const store = ctx.state.korvocab || (ctx.state.korvocab = {});
    const now = Date.now();

    let correct = 0, wrong = 0, streak = 0, cur = null, locked = false;
    const wrongList = [];   // 이번 판에 틀린 것 — 결과에 보여준다

    // 복습 예정 단어 우선, 그다음 주력 난이도
    const dueIdx = [], poolIdx = [];
    KOR_VOCAB.forEach((v, i) => {
      const st = store[i];
      if (st && st.due <= now && st.box < 3) dueIdx.push(i);
      const dt = v.t - tier;
      if (dt === 0 || (dt === -1 && Math.random() < 0.3) || (dt === 1 && Math.random() < 0.2)) poolIdx.push(i);
    });
    const queue = shuffle(dueIdx).concat(shuffle(poolIdx.length ? poolIdx : KOR_VOCAB.map((_, i) => i)));
    let qi = 0;

    ctx.body.innerHTML = `
      <div class="score-line" id="kv-score">정답 <b>0</b> · 오답 0</div>
      <div class="kv-cat" id="kv-cat"></div>
      <div class="kv-word" id="kv-word"></div>
      <div class="choices" id="kv-choices"></div>
      <div class="kv-ex" id="kv-ex"></div>
    `;
    const $cat = ctx.body.querySelector('#kv-cat');
    const $w = ctx.body.querySelector('#kv-word');
    const $c = ctx.body.querySelector('#kv-choices');
    const $s = ctx.body.querySelector('#kv-score');
    const $ex = ctx.body.querySelector('#kv-ex');

    function updateLeitner(idx, ok) {
      const st = store[idx] || { box: 1, due: 0 };
      if (ok) { st.box = Math.min(5, st.box + 1); st.due = now + st.box * 24 * 3600 * 1000; }
      else { st.box = 0; st.due = now; }
      store[idx] = st;
    }

    function next() {
      if (qi >= queue.length) qi = 0;
      const idx = queue[qi++];
      cur = { idx, v: KOR_VOCAB[idx] };
      locked = false;
      $cat.textContent = KOR_CATS[cur.v.k] || '';
      $w.textContent = cur.v.w;
      $ex.textContent = '';
      $ex.className = 'kv-ex';
      $c.innerHTML = '';
      for (const m of shuffle([cur.v.m, ...cur.v.d])) {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = m;
        b.addEventListener('pointerdown', e => { e.preventDefault(); answer(b, m); }, { once: true });
        $c.appendChild(b);
      }
    }

    function answer(btn, m) {
      if (locked) return;
      locked = true;
      const ok = m === cur.v.m;
      updateLeitner(cur.idx, ok);
      if (ok) {
        correct++; streak++; sfx.combo(streak);
        btn.classList.add('correct');
      } else {
        wrong++; streak = 0; sfx.bad();
        btn.classList.add('wrong');
        for (const c of $c.children) if (c.textContent === cur.v.m) c.classList.add('correct');
        wrongList.push(cur.v.w);
      }
      $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`
        + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
      // 틀렸을 땐 예문을 보여줘 뜻이 몸에 남게 한다
      if (!ok && cur.v.ex) {
        $ex.textContent = `예: ${cur.v.ex}`;
        $ex.className = 'kv-ex show';
      }
      ctx.delay(next, ok ? 200 : 1500);
    }

    next();
    ctx.timer(DURATION, () => {
      const perf = (correct - wrong * 0.5) / EXPECTED;
      const missed = wrongList.length
        ? ` · 틀린 말 ${wrongList.slice(0, 4).join(', ')}${wrongList.length > 4 ? ' 외' : ''}`
        : '';
      ctx.finish({
        score: correct,
        perf,
        detail: `정답 ${correct} · 오답 ${wrong}${missed}`,
      });
    });
  },
};
