// 사이먼 — 순서 기억
// 불빛이 순서대로 켜지면 그대로 따라 누른다. 성공할 때마다 한 칸씩 길어진다.
// 기억력(위치 기억)과 달리 "순서"를 붙드는 능력이라 따로 잰다.
import { sfx } from '../audio.js';
import { judge } from '../feedback.js';

const PADS = [
  { css: '#5b8cff', tone: 392 },   // 파랑
  { css: '#34d27b', tone: 523 },   // 초록
  { css: '#ffc94d', tone: 659 },   // 노랑
  { css: '#ff5d6c', tone: 784 },   // 빨강
];
const LIVES = 3;

export const simonGame = {
  id: 'simon',
  name: '사이먼',
  icon: '🎹',
  desc: '불빛 순서를 그대로 따라가기',
  run(ctx) {
    // 레벨이 오르면 시작 길이가 늘고 보여주는 속도가 빨라진다
    const L = Math.max(0, (ctx.rating - 800) / 200);
    const startLen = Math.min(6, 3 + Math.floor(L / 2));
    const baseMs = Math.max(260, 520 - L * 22);

    const seq = [];
    let inputIdx = 0;
    let lives = LIVES;
    let best = 0;          // 성공한 최고 길이
    let phase = 'show';    // show | input | over

    ctx.body.innerHTML = `
      <div class="sm-head">
        <span>길이 <b id="sm-len">0</b></span>
        <span id="sm-state">잘 보세요</span>
        <span>남은 기회 <b id="sm-life">${LIVES}</b></span>
      </div>
      <div class="sm-pads" id="sm-pads">
        ${PADS.map((p, i) => `<button class="sm-pad" data-i="${i}" style="--pad:${p.css}"></button>`).join('')}
      </div>
      <div class="sm-dots" id="sm-dots"></div>
    `;
    const $len = ctx.body.querySelector('#sm-len');
    const $state = ctx.body.querySelector('#sm-state');
    const $life = ctx.body.querySelector('#sm-life');
    const $pads = ctx.body.querySelector('#sm-pads');
    const $dots = ctx.body.querySelector('#sm-dots');
    const padEls = [...$pads.querySelectorAll('.sm-pad')];

    // 입력 진행도 — 몇 개째 누르고 있는지 눈으로 보이게
    function renderDots() {
      $dots.innerHTML = seq.map((_, i) =>
        `<span class="sm-dot${i < inputIdx ? ' on' : ''}"></span>`).join('');
    }

    function flash(i, ms) {
      const el = padEls[i];
      el.classList.add('lit');
      sfx.tone(PADS[i].tone);
      ctx.delay(() => el.classList.remove('lit'), ms);
    }

    function showSeq() {
      phase = 'show';
      $state.textContent = '잘 보세요';
      $len.textContent = seq.length;
      inputIdx = 0;
      renderDots();
      const gap = baseMs;
      seq.forEach((v, i) => {
        ctx.delay(() => flash(v, gap * 0.6), 400 + i * gap);
      });
      ctx.delay(() => {
        phase = 'input';
        $state.textContent = '따라 누르세요';
      }, 400 + seq.length * gap);
    }

    function nextRound() {
      // 처음엔 startLen만큼 한꺼번에, 그 뒤로는 한 칸씩
      const add = seq.length === 0 ? startLen : 1;
      for (let i = 0; i < add; i++) seq.push(Math.floor(Math.random() * 4));
      showSeq();
    }

    $pads.addEventListener('pointerdown', e => {
      const b = e.target.closest('.sm-pad');
      if (!b || phase !== 'input') return;
      e.preventDefault();
      const i = Number(b.dataset.i);
      flash(i, 180);

      if (i === seq[inputIdx]) {
        inputIdx++;
        renderDots();
        if (inputIdx >= seq.length) {
          // 한 바퀴 성공
          best = Math.max(best, seq.length);
          phase = 'show';
          sfx.good();
          judge(ctx.body, true, `${seq.length}개 성공`);
          ctx.delay(nextRound, 900);
        }
        return;
      }

      // 틀림
      lives--;
      $life.textContent = lives;
      sfx.bad();
      phase = 'show';
      if (lives <= 0) {
        judge(ctx.body, false, `${seq.length}개에서 끝`);
        ctx.delay(end, 900);
        return;
      }
      judge(ctx.body, false, '다시 보여줄게요');
      ctx.delay(showSeq, 1000);   // 같은 순서를 한 번 더 보여준다
    });

    function end() {
      if (phase === 'over') return;
      phase = 'over';
      // 기대 길이는 레이팅을 따라 오른다 — 실력이 늘면 기준도 오른다
      const expect = startLen + 2;
      ctx.finish({
        score: best,
        perf: best / expect,
        detail: `최고 ${best}개 · 시작 ${startLen}개`,
        time: best > 0
          ? { key: 'simon_len', value: best, unit: 'len', label: '최고 길이' } : null,
      });
    }

    nextRound();
  },
};
