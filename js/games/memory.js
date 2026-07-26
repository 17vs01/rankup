// 순간 기억 (패턴 그리드, 6라운드 적응형)
// 셀 패턴이 잠깐 켜졌다 꺼지면 위치를 재현. 성공 시 +1칸, 실패 시 -1칸.
import { sfx } from '../audio.js';

const ROUNDS = 6;

export const memoryGame = {
  id: 'memory',
  name: '기억력',
  icon: '🧠',
  desc: '순간 패턴 기억 6라운드',
  run(ctx) {
    // 레이팅 기준 시작 칸수
    const k0 = Math.max(3, Math.round(4 + (ctx.rating - 800) / 150));
    let k = k0;
    let round = 0;
    const successKs = [];
    let maxSuccess = 0;

    ctx.body.innerHTML = `
      <div class="mem-round" id="mem-round"></div>
      <div class="mem-status" id="mem-status"></div>
      <div class="mem-grid" id="mem-grid"></div>
    `;
    const $round = ctx.body.querySelector('#mem-round');
    const $status = ctx.body.querySelector('#mem-status');
    const $grid = ctx.body.querySelector('#mem-grid');

    function gridSizeFor(cells) {
      if (cells <= 5) return 4;
      if (cells <= 8) return 5;
      if (cells <= 12) return 6;
      return 7;
    }

    function startRound() {
      round++;
      if (round > ROUNDS) return end();
      const n = gridSizeFor(k);
      $round.textContent = `라운드 ${round}/${ROUNDS} · ${k}칸`;
      $status.textContent = '패턴을 기억하세요';
      $grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      $grid.innerHTML = '';
      const total = n * n;
      const cells = [];
      for (let i = 0; i < total; i++) {
        const c = document.createElement('div');
        c.className = 'mem-cell';
        c.dataset.i = i;
        $grid.appendChild(c);
        cells.push(c);
      }
      // 패턴 선정
      const lit = new Set();
      while (lit.size < k) lit.add(Math.floor(Math.random() * total));

      // 표시
      for (const i of lit) cells[i].classList.add('lit');
      const showMs = 500 + k * 90;

      ctx.delay(() => {
        for (const i of lit) cells[i].classList.remove('lit');
        $status.textContent = `${k}칸을 탭하세요`;
        let picks = 0, hits = 0, missed = false;

        const onTap = e => {
          const t = e.target;
          if (!t.dataset || t.dataset.i === undefined || t.dataset.done) return;
          t.dataset.done = '1';
          picks++;
          const i = Number(t.dataset.i);
          if (lit.has(i)) {
            hits++;
            t.classList.add('hit');
            sfx.tick();
          } else {
            missed = true;
            t.classList.add('miss');
            sfx.bad();
          }
          if (picks >= k) {
            $grid.removeEventListener('pointerdown', onTap);
            const ok = hits === k && !missed;
            // 정답 위치 공개
            for (const li of lit) if (!cells[li].classList.contains('hit')) cells[li].classList.add('lit');
            if (ok) {
              sfx.good();
              successKs.push(k);
              maxSuccess = Math.max(maxSuccess, k);
              $status.textContent = '성공! +1칸';
              k++;
            } else {
              $status.textContent = `실패 (${hits}/${k})`;
              k = Math.max(3, k - 1);
            }
            ctx.delay(startRound, 850);
          }
        };
        $grid.addEventListener('pointerdown', onTap);
      }, showMs);
    }

    function end() {
      const ability = maxSuccess > 0 ? maxSuccess : k0 - 1.5;
      const perf = ability / k0;
      ctx.finish({
        score: maxSuccess,
        perf,
        detail: `최고 ${maxSuccess}칸 · 성공 ${successKs.length}/${ROUNDS}라운드`,
      });
    }

    startRound();
  },
};
