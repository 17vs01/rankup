// 어휘력 — 우리말 + 영단어 통합 스피드 퀴즈 (60초)
// 시작할 때 우리말만 / 영단어만 / 통합(둘 다)을 고른다.
// 통합이면 문제가 두 갈래에서 랜덤으로 섞여 나온다.
// 라이트너 복습 상태는 기존 어휘(state.vocab)·우리말(state.korvocab)을 그대로 쓴다.
import { VOCAB } from '../data/vocab.js';
import { KOR_VOCAB, KOR_CATS } from '../data/korvocab.js';
import { sfx } from '../audio.js';

const DURATION = 60;
const EXPECTED = 12;

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

const SOURCES = [
  { id: 'kor', name: '우리말', desc: '순우리말·한자어·헷갈리는 말·관용구 — 예문으로 익힘' },
  { id: 'eng', name: '영단어', desc: '기초 → 수능 → 토익 고득점 → GRE급' },
];

function readSel(state) {
  const s = Array.isArray(state.lexiSel)
    ? state.lexiSel.filter(x => SOURCES.some(y => y.id === x)) : [];
  return s.length ? s : ['kor', 'eng'];
}

export const lexiGame = {
  id: 'lexi',
  name: '어휘력',
  icon: '📚',
  desc: '우리말·영단어 골라서 또는 섞어서',

  // 방법 화면에서 카운트다운 전에 고르게 한다 (focus.js와 같은 규약)
  picker(state, host, onStart) {
    let sel = readSel(state);
    host.innerHTML = `
      <div class="fp-wrap">
        <div class="fp-title">어떤 어휘를 단련할까요?</div>
        ${SOURCES.map(s => `
          <button class="fp-item${sel.includes(s.id) ? ' on' : ''}" data-id="${s.id}">
            <span class="fp-check">✓</span>
            <span><span class="fp-name">${s.name}</span><div class="fp-desc">${s.desc}</div></span>
          </button>`).join('')}
        <div class="fp-goal" id="lx-goal"></div>
        <button class="btn-primary" id="lx-start">시작</button>
      </div>
    `;
    const $goal = host.querySelector('#lx-goal');
    const update = () => {
      $goal.textContent = sel.length === 2
        ? '통합 — 우리말과 영단어가 랜덤으로 섞여 나옵니다'
        : sel[0] === 'kor' ? '우리말만 60초' : '영단어만 60초';
    };
    update();
    host.querySelectorAll('.fp-item').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        if (sel.includes(id)) {
          if (sel.length === 1) return;   // 최소 1개
          sel = sel.filter(s => s !== id);
          b.classList.remove('on');
        } else {
          sel = SOURCES.map(s => s.id).filter(s => sel.includes(s) || s === id);
          b.classList.add('on');
        }
        sfx.tick();
        update();
      });
    });
    host.querySelector('#lx-start').addEventListener('click', () => {
      state.lexiSel = sel.slice();
      onStart();
    });
  },

  run(ctx) {
    const tier = mainTier(ctx.rating);
    const engStore = ctx.state.vocab || (ctx.state.vocab = {});
    const korStore = ctx.state.korvocab || (ctx.state.korvocab = {});
    const now = Date.now();
    const sel = readSel(ctx.state);

    // ---------- 출제 큐 ----------
    // 복습 예정 단어 우선, 그다음 주력 난이도 (양쪽 다 같은 방식)
    function buildQueue(list, store) {
      const due = [], pool = [];
      list.forEach((v, i) => {
        const st = store[i];
        if (st && st.due <= now && st.box < 3) due.push(i);
        const dt = v.t - tier;
        if (dt === 0 || (dt === -1 && Math.random() < 0.3) || (dt === 1 && Math.random() < 0.2)) pool.push(i);
      });
      return shuffle(due).concat(shuffle(pool.length ? pool : list.map((_, i) => i)));
    }

    function updateLeitner(store, idx, ok) {
      const st = store[idx] || { box: 1, due: 0 };
      if (ok) { st.box = Math.min(5, st.box + 1); st.due = now + st.box * 24 * 3600 * 1000; }
      else { st.box = 0; st.due = now; }
      store[idx] = st;
    }

    // 영단어 오답 3개 — 뜻 텍스트가 정답·서로와 겹치지 않게
    function engDistractors(word) {
      const seen = new Set([word.m]);
      const out = [];
      for (const v of shuffle(VOCAB.filter(v => Math.abs(v.t - word.t) <= 1))) {
        if (seen.has(v.m)) continue;
        seen.add(v.m);
        out.push(v.m);
        if (out.length === 3) break;
      }
      return out;
    }

    // ---------- 본 게임 ----------
    (function begin() {
      const korQueue = buildQueue(KOR_VOCAB, korStore);
      const engQueue = buildQueue(VOCAB, engStore);
      let qKor = 0, qEng = 0;
      let correct = 0, wrong = 0, streak = 0, cur = null, locked = false;
      const wrongList = [];

      ctx.body.innerHTML = `
        <div class="score-line" id="lx-score">정답 <b>0</b> · 오답 0</div>
        <div class="kv-cat" id="lx-cat"></div>
        <div class="kv-word" id="lx-word"></div>
        <div class="choices" id="lx-choices"></div>
        <div class="kv-ex" id="lx-ex"></div>
      `;
      const $cat = ctx.body.querySelector('#lx-cat');
      const $w = ctx.body.querySelector('#lx-word');
      const $c = ctx.body.querySelector('#lx-choices');
      const $s = ctx.body.querySelector('#lx-score');
      const $ex = ctx.body.querySelector('#lx-ex');

      function next() {
        // 통합이면 갈래를 랜덤으로, 아니면 고른 갈래만
        const src = sel.length === 2 ? (Math.random() < 0.5 ? 'kor' : 'eng') : sel[0];
        locked = false;
        $ex.textContent = '';
        $ex.className = 'kv-ex';
        $c.innerHTML = '';

        if (src === 'kor') {
          if (qKor >= korQueue.length) qKor = 0;
          const idx = korQueue[qKor++];
          const v = KOR_VOCAB[idx];
          cur = { src, idx, answer: v.m, ex: v.ex, word: v.w };
          $cat.textContent = KOR_CATS[v.k] || '우리말';
          $w.textContent = v.w;
          for (const m of shuffle([v.m, ...v.d])) addChoice(m);
        } else {
          if (qEng >= engQueue.length) qEng = 0;
          const idx = engQueue[qEng++];
          const v = VOCAB[idx];
          cur = { src, idx, answer: v.m, ex: null, word: v.w };
          $cat.textContent = '영단어';
          $w.textContent = v.w;
          for (const m of shuffle([v.m, ...engDistractors(v)])) addChoice(m);
        }
      }

      function addChoice(m) {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = m;
        b.addEventListener('pointerdown', e => { e.preventDefault(); answer(b, m); }, { once: true });
        $c.appendChild(b);
      }

      function answer(btn, m) {
        if (locked) return;
        locked = true;
        const ok = m === cur.answer;
        updateLeitner(cur.src === 'kor' ? korStore : engStore, cur.idx, ok);
        if (ok) {
          correct++; streak++; sfx.combo(streak);
          btn.classList.add('correct');
        } else {
          wrong++; streak = 0; sfx.bad();
          btn.classList.add('wrong');
          for (const c of $c.children) if (c.textContent === cur.answer) c.classList.add('correct');
          wrongList.push(cur.word);
        }
        $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`
          + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
        // 우리말은 틀렸을 때 예문을 보여줘 뜻이 몸에 남게 한다
        if (!ok && cur.ex) {
          $ex.textContent = `예: ${cur.ex}`;
          $ex.className = 'kv-ex show';
        }
        ctx.delay(next, ok ? 200 : (cur.ex ? 1500 : 900));
      }

      next();
      ctx.timer(DURATION, () => {
        const perf = (correct - wrong * 0.5) / EXPECTED;
        const srcName = sel.length === 2 ? '통합' : sel[0] === 'kor' ? '우리말' : '영단어';
        const missed = wrongList.length
          ? ` · 틀린 말 ${wrongList.slice(0, 4).join(', ')}${wrongList.length > 4 ? ' 외' : ''}`
          : '';
        ctx.finish({
          score: correct,
          perf,
          detail: `${srcName} · 정답 ${correct} · 오답 ${wrong}${missed}`,
        });
      });
    })();
  },
};
