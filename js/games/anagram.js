// 우리말 아나그램 — 뜻을 보고 흩어진 음절을 제자리에 맞춘다
// 어휘력이 "이 단어의 뜻은?"이라면 이건 반대다 — 뜻에서 단어를 끌어내는 인출 훈련이라
// 아는 단어를 "쓸 수 있는 단어"로 바꾸는 데 더 가깝다.
import { KOR_VOCAB, KOR_CATS } from '../data/korvocab.js';
import { sfx } from '../audio.js';
import { judge } from '../feedback.js';

// 오늘의 도전이면 ctx.rng(날짜 시드 난수)가 들어온다. 문제를 만들 때는 반드시 R()을 쓴다 —
// Math.random을 섞으면 같은 날 같은 종목이어도 사람마다 판이 갈린다.
let R = Math.random;

const DURATION = 60;
// 뜻을 읽고 단어를 "떠올린 뒤" 음절을 조립해야 해서 어휘력보다 한 문제가 길다
// 2글자 단어를 뺀 뒤로 한 문제가 조금 더 걸린다. 기대치를 6 → 5로 맞춘다.
const EXPECTED = 5;

const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const shuffle = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

// 한글 음절만, 2~5글자. 띄어쓰기가 있는 관용구는 뺀다 (타일이 너무 많아진다).
const HANGUL = /^[가-힣]+$/;
// 3~5글자만. 2글자는 타일이 둘뿐이라 섞인 순서를 뒤집기만 하면 된다 — 뜻을 안 읽어도
// 풀리는 문제가 전체의 31~44%였다. 음절이 전부 같은 말("남남")도 섞을 수가 없어 뺀다.
function usable(v) {
  return HANGUL.test(v.w) && v.w.length >= 3 && v.w.length <= 5 && new Set(v.w).size > 1;
}

function mainTier(rating) {
  return Math.max(0, Math.min(3, Math.floor((rating - 800) / 400)));
}

export const anagramGame = {
  id: 'anagram',
  ceiling: 2000,   // 단어 수준(티어 3)이 끝나는 곳 (main.js ceilingAdjust)
  name: '아나그램',
  icon: '🔤',
  desc: '뜻을 보고 음절 맞추기',
  run(ctx) {
    R = ctx.rng || Math.random;
    const tier = mainTier(ctx.rating);
    // 레벨이 오르면 긴 단어 위주로
    const minLen = 3;

    const pool = [];
    KOR_VOCAB.forEach((v, i) => {
      if (!usable(v) || v.w.length < minLen) return;
      const dt = v.t - tier;
      if (dt === 0 || (dt === -1 && R() < 0.3) || (dt === 1 && R() < 0.25)) pool.push(i);
    });
    const queue = shuffle(pool.length ? pool : KOR_VOCAB.map((_, i) => i).filter(i => usable(KOR_VOCAB[i])));
    let qi = 0;

    let solved = 0, passed = 0, streak = 0, bestStreak = 0;
    let cur = null, picked = [], locked = false;

    ctx.body.innerHTML = `
      <div class="score-line" id="ag-score">맞힘 <b>0</b></div>
      <div class="ag-cat" id="ag-cat"></div>
      <div class="ag-mean" id="ag-mean"></div>
      <div class="ag-slots" id="ag-slots"></div>
      <div class="ag-tiles" id="ag-tiles"></div>
      <div class="ag-actions">
        <button class="btn-secondary" id="ag-undo">↺ 되돌리기</button>
        <button class="btn-secondary" id="ag-pass">모르겠어요</button>
      </div>
      <div class="ag-fb" id="ag-fb"></div>
    `;
    const $score = ctx.body.querySelector('#ag-score');
    const $cat = ctx.body.querySelector('#ag-cat');
    const $mean = ctx.body.querySelector('#ag-mean');
    const $slots = ctx.body.querySelector('#ag-slots');
    const $tiles = ctx.body.querySelector('#ag-tiles');
    const $fb = ctx.body.querySelector('#ag-fb');

    function renderScore() {
      $score.innerHTML = `맞힘 <b>${solved}</b>`
        + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
    }

    function next() {
      if (qi >= queue.length) qi = 0;
      const v = KOR_VOCAB[queue[qi++]];
      const chars = v.w.split('');
      // 원래 순서 그대로 나오면 문제가 안 된다 — 다르게 섞일 때까지 다시 섞는다
      let mixed = shuffle(chars);
      for (let t = 0; t < 8 && mixed.join('') === v.w; t++) mixed = shuffle(chars);
      cur = { v, chars, mixed };
      picked = [];
      locked = false;
      $cat.textContent = KOR_CATS[v.k] || '우리말';
      $mean.textContent = v.m;
      $fb.textContent = '';
      $fb.className = 'ag-fb';
      renderSlots();
      renderTiles();
    }

    function renderSlots() {
      $slots.innerHTML = cur.chars.map((_, i) =>
        `<span class="ag-slot${picked[i] !== undefined ? ' filled' : ''}">${
          picked[i] !== undefined ? cur.mixed[picked[i]] : ''}</span>`).join('');
    }

    function renderTiles() {
      $tiles.innerHTML = cur.mixed.map((c, i) =>
        `<button class="ag-tile${picked.includes(i) ? ' used' : ''}" data-i="${i}">${c}</button>`).join('');
    }

    $tiles.addEventListener('pointerdown', e => {
      const b = e.target.closest('.ag-tile');
      if (!b || locked || b.classList.contains('used')) return;
      e.preventDefault();
      picked.push(Number(b.dataset.i));
      sfx.tick();
      renderSlots();
      renderTiles();
      if (picked.length === cur.chars.length) check();
    });

    function check() {
      const made = picked.map(i => cur.mixed[i]).join('');
      if (made === cur.v.w) {
        locked = true;
        solved++; streak++; bestStreak = Math.max(bestStreak, streak);
        sfx.combo(streak);
        judge(ctx.body, true, cur.v.w);
        renderScore();
        ctx.delay(next, 550);
      } else {
        // 틀렸으면 되돌리기만 하면 되니 판정을 크게 띄우지 않는다
        sfx.bad();
        $fb.textContent = `${made} … 아니에요. 되돌려 보세요`;
        $fb.className = 'ag-fb bad';
      }
    }

    ctx.body.querySelector('#ag-undo').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (locked || !picked.length) return;
      picked.pop();
      $fb.textContent = '';
      $fb.className = 'ag-fb';
      renderSlots();
      renderTiles();
    });

    ctx.body.querySelector('#ag-pass').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (locked) return;
      locked = true;
      passed++; streak = 0;
      sfx.bad();
      renderScore();
      $fb.textContent = `정답: ${cur.v.w}`;
      $fb.className = 'ag-fb';
      ctx.delay(next, 1300);
    });

    next();
    ctx.timer(DURATION, () => {
      ctx.finish({
        score: solved,
        perf: solved / EXPECTED,
        detail: `${solved}개 맞힘 · 넘김 ${passed} · 최고 ${bestStreak}연속`,
        time: bestStreak > 0
          ? { key: 'ag_streak', value: bestStreak, unit: 'count', label: '최다 연속' } : null,
      });
    });
  },
};
