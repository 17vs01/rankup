// 메타기억 — 내가 뭘 아는지 아는 능력
// 단어를 보고 "안다/모른다"를 먼저 예측한 뒤, 바로 시험을 본다.
// 점수는 정답률이 아니라 예측 적중률. 아는 걸 안다고, 모르는 걸 모른다고 해야 오른다.
// 어휘 플레이 기록이 쌓이면 "지난번에 내가 맞혔을까?" 문제가 섞여 나온다.
import { VOCAB } from '../data/vocab.js';
import { sfx } from '../audio.js';

const ROUNDS = 10;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; } return x; };

export const metamemGame = {
  id: 'metamem',
  name: '메타기억',
  icon: '🪞',
  desc: '아는지 모르는지 먼저 맞히기',
  run(ctx) {
    const tier = Math.max(0, Math.min(3, Math.floor((ctx.rating - 800) / 400)));
    const vocabState = ctx.state.vocab || {};
    const history = Object.keys(vocabState).map(Number);

    // 출제 풀: 주력 티어 ± 1
    const pool = [];
    VOCAB.forEach((v, i) => { if (Math.abs(v.t - tier) <= 1) pool.push(i); });
    const queue = shuffle(pool).slice(0, ROUNDS * 2);
    // 기록이 충분하면 "지난번에 맞혔을까" 문제를 섞는다
    const recallable = shuffle(history).slice(0, 4);

    let round = 0, predictHits = 0, testCorrect = 0;
    let phase = 'predict', cur = null, prediction = null, qi = 0;
    let recallUsed = 0;

    ctx.body.innerHTML = `
      <div class="mm-round" id="mm-round"></div>
      <div class="mm-kind" id="mm-kind"></div>
      <div class="mm-word" id="mm-word"></div>
      <div class="mm-predict" id="mm-predict">
        <button class="mm-btn know" data-p="1">안다</button>
        <button class="mm-btn dunno" data-p="0">모른다</button>
      </div>
      <div class="mm-choices hidden" id="mm-choices"></div>
      <div class="mm-feedback" id="mm-fb"></div>
      <div class="mm-score" id="mm-score">예측 적중 <b>0</b> / 0</div>
    `;
    const $round = ctx.body.querySelector('#mm-round');
    const $kind = ctx.body.querySelector('#mm-kind');
    const $word = ctx.body.querySelector('#mm-word');
    const $predict = ctx.body.querySelector('#mm-predict');
    const $choices = ctx.body.querySelector('#mm-choices');
    const $fb = ctx.body.querySelector('#mm-fb');
    const $score = ctx.body.querySelector('#mm-score');

    function next() {
      round++;
      if (round > ROUNDS) return end();
      $round.textContent = `${round} / ${ROUNDS}라운드`;
      $fb.textContent = '';
      $fb.className = 'mm-feedback';
      $choices.classList.add('hidden');
      $predict.classList.remove('hidden');
      prediction = null;
      phase = 'predict';

      // 3라운드마다 한 번은 과거 기록 문제 (기록이 있을 때만)
      const useRecall = recallUsed < recallable.length && round % 3 === 0;
      if (useRecall) {
        const idx = recallable[recallUsed++];
        cur = { idx, word: VOCAB[idx], mode: 'recall', pastOk: (vocabState[idx].box || 0) >= 1 };
        $kind.textContent = '지난번에 내가 이 단어를 맞혔을까?';
        $predict.children[0].textContent = '맞혔다';
        $predict.children[1].textContent = '틀렸다';
      } else {
        const idx = queue[qi++ % queue.length];
        cur = { idx, word: VOCAB[idx], mode: 'know' };
        $kind.textContent = '이 단어, 뜻을 아는가?';
        $predict.children[0].textContent = '안다';
        $predict.children[1].textContent = '모른다';
      }
      $word.textContent = cur.word.w;
    }

    $predict.addEventListener('pointerdown', e => {
      const b = e.target.closest('.mm-btn');
      if (!b || phase !== 'predict') return;
      e.preventDefault();
      prediction = b.dataset.p === '1';
      $predict.classList.add('hidden');

      if (cur.mode === 'recall') {
        // 기록과 대조해서 즉시 판정
        const ok = prediction === cur.pastOk;
        if (ok) { predictHits++; sfx.good(); } else sfx.bad();
        $fb.className = 'mm-feedback ' + (ok ? 'good' : 'bad');
        $fb.innerHTML = ok
          ? `자기 기록을 정확히 기억했습니다 (${cur.word.w} = ${cur.word.m})`
          : `실제로는 <b>${cur.pastOk ? '맞혔' : '틀렸'}습니다</b> · ${cur.word.w} = ${cur.word.m}`;
        $score.innerHTML = `예측 적중 <b>${predictHits}</b> / ${round}`;
        phase = 'done';
        ctx.delay(next, 1500);
        return;
      }

      // 예측했으니 바로 시험
      phase = 'test';
      $choices.classList.remove('hidden');
      $choices.innerHTML = '';
      const others = shuffle(VOCAB.filter(v => v !== cur.word && Math.abs(v.t - cur.word.t) <= 1)).slice(0, 3);
      for (const m of shuffle([cur.word.m, ...others.map(v => v.m)])) {
        const b2 = document.createElement('button');
        b2.className = 'choice';
        b2.textContent = m;
        b2.addEventListener('pointerdown', ev => {
          ev.preventDefault();
          if (phase !== 'test') return;
          phase = 'done';
          const right = m === cur.word.m;
          if (right) testCorrect++;
          const ok = prediction === right;   // 예측이 맞았나
          if (ok) { predictHits++; sfx.good(); } else sfx.bad();
          for (const c of $choices.children) {
            if (c.textContent === cur.word.m) c.classList.add('correct');
            else if (c === b2) c.classList.add('wrong');
          }
          $fb.className = 'mm-feedback ' + (ok ? 'good' : 'bad');
          $fb.textContent = ok
            ? (right ? '안다고 하고 맞혔다' : '모른다고 하고 틀렸다 — 정확한 자기평가')
            : (right ? '모른다고 했는데 맞혔다 — 과소평가' : '안다고 했는데 틀렸다 — 과신');
          $score.innerHTML = `예측 적중 <b>${predictHits}</b> / ${round}`;
          ctx.delay(next, 1600);
        }, { once: true });
        $choices.appendChild(b2);
      }
    });

    function end() {
      ctx.finish({
        score: predictHits,
        perf: predictHits / 6.5,   // 10판 중 6.5 적중이 기대치
        detail: `예측 적중 ${predictHits}/${ROUNDS} · 실제 정답 ${testCorrect}`,
      });
    }

    next();
  },
};
