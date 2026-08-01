// 치즈 도둑 — 예측 불가의 AI를 게임판 위로 옮긴 것
// 쥐가 되어 치즈를 모은다. 고양이는 내가 움직이기 "전에" 다음 칸을 예측해
// 발톱을 둔다 (예측 불가와 같은 마르코프 예측기 + 욕심 모델).
//
// 핵심 긴장: 치즈로 가는 최단길은 뻔한 길이다. 빨리 먹으려 할수록 읽힌다.
// 무작위로만 움직이면 안 잡히지만 치즈를 못 먹는다 — 욕심과 종잡을 수 없음
// 사이에서 균형을 잡아야 한다.
import { sfx } from '../audio.js';

const N = 4;
const DURATION = 60;
const EXPECTED = 8;

// 방향: 0 위, 1 아래, 2 왼쪽, 3 오른쪽
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// 고양이 = 방향 버릇을 읽는 다중 차수 마르코프 + "사람은 치즈 쪽으로 간다" 편향
function makeCat(maxOrder) {
  const table = new Map();
  const hist = [];   // 내가 지금까지 움직인 방향들

  function keysFor(i) {
    const out = [];
    for (let o = 1; o <= maxOrder; o++) {
      if (i < o) break;
      out.push({ k: o + '|' + hist.slice(i - o, i).join(''), w: Math.pow(1.8, o) });
    }
    return out;
  }

  return {
    // valid: 지금 갈 수 있는 방향들, greedy: 치즈에 가까워지는 방향들
    predict(valid, greedy, greedW) {
      const s = [0, 0, 0, 0];
      for (const { k, w } of keysFor(hist.length)) {
        const c = table.get(k);
        if (!c) continue;
        const n = c[0] + c[1] + c[2] + c[3];
        if (!n) continue;
        const conf = n / (n + 1.5);
        for (let d = 0; d < 4; d++) s[d] += w * conf * (c[d] / n);
      }
      for (const d of greedy) s[d] += greedW;
      let best = valid[0], bv = -Infinity;
      for (const d of valid) {
        const v = s[d] + Math.random() * 1e-6;   // 동점이면 무작위
        if (v > bv) { bv = v; best = d; }
      }
      return best;
    },
    record(d) {
      for (const { k } of keysFor(hist.length)) {
        let c = table.get(k);
        if (!c) { c = [0, 0, 0, 0]; table.set(k, c); }
        c[d]++;
      }
      hist.push(d);
    },
  };
}

export const chaseGame = {
  id: 'chase',
  name: '치즈 도둑',
  icon: '🧀',
  desc: '고양이 몰래 치즈 모으기',
  run(ctx) {
    // 랭크가 오르면 고양이가 더 긴 버릇을 기억하고, 욕심도 더 정확히 읽는다
    const L = Math.max(0, (ctx.rating - 1000) / 200);
    const maxOrder = Math.min(6, 2 + Math.floor(L));
    const greedW = Math.min(1.4, 0.6 + L * 0.12);
    const cat = makeCat(maxOrder);

    let px = 1, py = 2;              // 쥐 위치 (구석 출발은 불리해서 안쪽에서)
    let cx = 0, cy = 0;              // 치즈 위치
    let got = 0, caught = 0, streak = 0, bestStreak = 0;
    let trapDir = null, locked = false;

    ctx.body.innerHTML = `
      <div class="score-line" id="cz-score">치즈 <b>0</b> · 잡힘 0</div>
      <div class="cz-grid" id="cz-grid"></div>
      <div class="cz-hint" id="cz-hint">옆 칸을 탭해서 움직이세요 — 고양이가 다음 칸을 예측합니다</div>
    `;
    const $score = ctx.body.querySelector('#cz-score');
    const $grid = ctx.body.querySelector('#cz-grid');
    const $hint = ctx.body.querySelector('#cz-hint');

    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const c = document.createElement('div');
      c.className = 'cz-cell';
      c.dataset.x = x; c.dataset.y = y;
      $grid.appendChild(c);
      cells.push(c);
    }
    const at = (x, y) => cells[y * N + x];

    function validDirs(x = px, y = py) {
      const out = [];
      for (let d = 0; d < 4; d++) {
        const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
        if (nx >= 0 && nx < N && ny >= 0 && ny < N) out.push(d);
      }
      return out;
    }

    function greedyDirs() {
      const out = [];
      for (const d of validDirs()) {
        const nx = px + DIRS[d][0], ny = py + DIRS[d][1];
        if (Math.abs(nx - cx) + Math.abs(ny - cy) < Math.abs(px - cx) + Math.abs(py - cy)) out.push(d);
      }
      return out;
    }

    function spawnCheese() {
      for (;;) {
        const x = ri(0, N - 1), y = ri(0, N - 1);
        if (Math.abs(x - px) + Math.abs(y - py) >= 2) { cx = x; cy = y; return; }
      }
    }

    function render() {
      const valid = new Set(validDirs().map(d => (py + DIRS[d][1]) * N + (px + DIRS[d][0])));
      cells.forEach((c, i) => {
        c.classList.toggle('can', valid.has(i) && !locked);
        const x = i % N, y = (i / N) | 0;
        c.textContent = (x === px && y === py) ? '🐭' : (x === cx && y === cy) ? '🧀' : '';
      });
      $score.innerHTML = `치즈 <b>${got}</b> · 잡힘 ${caught}`
        + (streak >= 5 ? `<span class="combo">🔥 ${streak}연속 회피</span>` : '');
    }

    // 고양이가 다음 수를 미리 정해둔다 (내가 움직이기 전에)
    function arm() { trapDir = cat.predict(validDirs(), greedyDirs(), greedW); }

    function pawFlash(x, y, hit) {
      const c = at(x, y);
      const paw = document.createElement('span');
      paw.className = 'cz-paw' + (hit ? ' hit' : '');
      paw.textContent = '🐾';
      c.appendChild(paw);
      ctx.delay(() => paw.remove(), hit ? 700 : 450);
    }

    $grid.addEventListener('pointerdown', e => {
      const c = e.target.closest('.cz-cell');
      if (!c || locked) return;
      e.preventDefault();
      const nx = Number(c.dataset.x), ny = Number(c.dataset.y);
      const dx = nx - px, dy = ny - py;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return;   // 옆 칸만
      const d = DIRS.findIndex(v => v[0] === dx && v[1] === dy);

      // 고양이가 미리 찍어둔 칸 (내 옛 위치 기준)
      const tx = px + DIRS[trapDir][0], ty = py + DIRS[trapDir][1];
      const wasCaught = d === trapDir;
      cat.record(d);
      px = nx; py = ny;

      if (wasCaught) {
        caught++;
        streak = 0;
        sfx.bad();
        pawFlash(tx, ty, true);
        at(px, py).classList.add('hit');
        ctx.delay(() => at(px, py) && at(px, py).classList.remove('hit'), 500);
        if (px === cx && py === cy) {
          // 치즈 칸에서 잡히면 치즈를 뺏긴다 — 욕심의 값
          $hint.textContent = '🐾 읽혔다! 치즈를 뺏겼어요';
          spawnCheese();
        } else {
          $hint.textContent = '🐾 읽혔다!';
        }
        locked = true;                       // 잠깐 굳는다 (시간이 벌점이다)
        ctx.delay(() => { locked = false; render(); }, 650);
      } else {
        streak++;
        bestStreak = Math.max(bestStreak, streak);
        pawFlash(tx, ty, false);             // 고양이가 어디를 노렸는지 보여준다
        if (px === cx && py === cy) {
          got++;
          sfx.combo(got);
          $hint.textContent = `🧀 +1${streak >= 5 ? ` · ${streak}연속 회피 중` : ''}`;
          spawnCheese();
        } else {
          sfx.tick();
          if (streak === 5 || streak === 10 || streak === 20) $hint.textContent = `${streak}연속 회피 — 고양이가 헤매고 있어요`;
        }
      }
      render();
      arm();
    });

    spawnCheese();
    arm();
    render();

    ctx.timer(DURATION, () => {
      ctx.finish({
        score: got,
        perf: (got - caught * 0.3) / EXPECTED,
        detail: `치즈 ${got} · 잡힘 ${caught} · 최고 ${bestStreak}연속 회피`,
        time: bestStreak > 0
          ? { key: 'chase_evade', value: bestStreak, unit: 'count', label: '최다 연속 회피' } : null,
      });
    });
  },
};
