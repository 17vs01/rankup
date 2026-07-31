// 순간 기억 (패턴 그리드, 6라운드 적응형)
// 셀 패턴이 잠깐 켜졌다 꺼지면 위치를 재현. 성공 시 +1칸, 실패 시 -1칸.
// 최고 칸수가 레벨처럼 기록에 남고, 다음 판은 그 근처에서 시작한다.
import { sfx } from '../audio.js';
import { judge } from '../feedback.js';

const ROUNDS = 6;

export const memoryGame = {
  id: 'memory',
  name: '기억력',
  icon: '🧠',
  desc: '순간 패턴 기억 6라운드',
  run(ctx) {
    // 시작 칸수: 기록이 있으면 최고 기록 바로 아래에서, 없으면 레이팅 기준
    const d = ctx.state.disc.memory;
    const bestCells = d.records && d.records.memory_cells;
    const k0 = bestCells
      ? Math.max(3, bestCells - 1)
      : Math.max(3, Math.round(4 + (ctx.rating - 800) / 150));
    let k = k0;
    let round = 0;
    const successKs = [];
    let maxSuccess = 0;

    const elapsed = ctx.stopwatch();   // 흐른 시간 표시 (상단 타이머)

    ctx.body.innerHTML = `
      <div class="mem-round" id="mem-round"></div>
      <div class="mem-status" id="mem-status"></div>
      <div class="mem-grid" id="mem-grid"></div>
    `;
    const $round = ctx.body.querySelector('#mem-round');
    const $status = ctx.body.querySelector('#mem-status');
    const $grid = ctx.body.querySelector('#mem-grid');

    // 칸수가 늘면 격자도 커진다. 상한 없이 계속 자란다.
    function gridSizeFor(cells) {
      if (cells <= 5) return 4;
      if (cells <= 8) return 5;
      if (cells <= 12) return 6;
      if (cells <= 17) return 7;
      if (cells <= 23) return 8;
      return 9;
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
      const R = ctx.rng || Math.random;
      while (lit.size < k) lit.add(Math.floor(R() * total));

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
              judge(ctx.body, true, `${k}칸 성공 · +1칸`);
              $status.textContent = '성공! +1칸';
              k++;
            } else {
              judge(ctx.body, false, `${hits}/${k}칸`);
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
      const secs = elapsed();
      const ability = maxSuccess > 0 ? maxSuccess : k0 - 1.5;
      const perf = ability / Math.max(k0, 4);
      ctx.finish({
        score: maxSuccess,
        perf,
        detail: `최고 ${maxSuccess}칸 · 성공 ${successKs.length}/${ROUNDS}라운드 · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`,
        times: maxSuccess > 0
          ? [{ key: 'memory_cells', value: maxSuccess, unit: 'cells', label: '최고 칸수' }] : [],
      });
    }

    startRound();
  },
};
