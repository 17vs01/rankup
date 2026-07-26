// 머릿속 나침반 — 경로 적분(path integration)
// 전진·회전 지시를 머릿속으로만 따라가고, 마지막에 "출발점이 지금 어느 쪽인지" 답한다.
// 지하철 출구, 주차장에서 차 찾기에 실제로 쓰는 능력.
import { sfx } from '../audio.js';

const ROUNDS = 5;
const EXPECTED = 3.2;

// 8방위 (현재 진행방향 기준 상대 방위)
const DIRS = [
  { label: '앞',      cell: 1 },
  { label: '앞오른쪽', cell: 2 },
  { label: '오른쪽',   cell: 5 },
  { label: '뒤오른쪽', cell: 8 },
  { label: '뒤',      cell: 7 },
  { label: '뒤왼쪽',   cell: 6 },
  { label: '왼쪽',     cell: 3 },
  { label: '앞왼쪽',   cell: 0 },
];

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// heading: 0=북 1=동 2=남 3=서
const STEP = [[0, 1], [1, 0], [0, -1], [-1, 0]];

export const compassGame = {
  id: 'compass',
  name: '나침반',
  icon: '🧭',
  desc: '머릿속으로 길 추적하기',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 800) / 150);
    const steps = Math.min(12, 3 + Math.floor(L));
    const showMs = Math.max(700, 1500 - L * 70);

    let round = 0, correct = 0;

    ctx.body.innerHTML = `
      <div class="cp-round" id="cp-round"></div>
      <div class="cp-stage" id="cp-stage"></div>
      <div class="cp-progress" id="cp-progress"></div>
      <div class="cp-rose hidden" id="cp-rose"></div>
    `;
    const $round = ctx.body.querySelector('#cp-round');
    const $stage = ctx.body.querySelector('#cp-stage');
    const $prog = ctx.body.querySelector('#cp-progress');
    const $rose = ctx.body.querySelector('#cp-rose');

    function buildRoute() {
      let x = 0, y = 0, h = 0;
      const seq = [];
      let moves = 0;
      for (let i = 0; i < steps; i++) {
        // 남은 지시로 최소 2번은 전진해야 방향이 결정된다
        const mustMove = steps - i <= 2 - moves;
        if (mustMove || Math.random() < 0.5) {
          const n = ri(1, 3);
          x += STEP[h][0] * n;
          y += STEP[h][1] * n;
          seq.push({ text: `${n}칸 전진`, icon: '⬆' });
          moves++;
        } else {
          const t = ri(0, 2);
          if (t === 0) { h = (h + 1) % 4; seq.push({ text: '우회전', icon: '↻' }); }
          else if (t === 1) { h = (h + 3) % 4; seq.push({ text: '좌회전', icon: '↺' }); }
          else { h = (h + 2) % 4; seq.push({ text: '뒤로 돌기', icon: '⇅' }); }
        }
      }
      return { seq, x, y, h };
    }

    // 그냥 생성하면 경로가 원점에서 멀어지기만 해서 정답이 '뒤'로 쏠린다.
    // 목표 정답을 먼저 정하고, 그 답이 나오는 경로를 찾을 때까지 다시 뽑는다.
    let lastAns = -1;
    function buildBalancedRoute() {
      const want = ri(0, 7);
      let fallback = null;
      for (let i = 0; i < 400; i++) {
        const r = buildRoute();
        if (r.x === 0 && r.y === 0) continue;   // 출발점으로 되돌아온 경로는 방향이 없다
        const a = answerIndex(r.x, r.y, r.h);
        if (a === want) return { ...r, ans: a };
        if (!fallback && a !== lastAns) fallback = { ...r, ans: a };
      }
      return fallback || { ...buildRoute(), ans: 0 };
    }

    // 출발점(0,0)이 현재 진행방향 기준 몇 시 방향인가 → 8방위 인덱스
    function answerIndex(x, y, h) {
      const dx = -x, dy = -y;               // 현재 → 출발점 벡터 (절대 좌표)
      const ang = Math.atan2(dx, dy);        // 북쪽 기준 시계방향 각
      const rel = ang - h * Math.PI / 2;     // 진행방향 기준으로 회전
      let idx = Math.round(rel / (Math.PI / 4)) % 8;
      if (idx < 0) idx += 8;
      return idx;                            // 0=앞, 1=앞오른쪽, 2=오른쪽 ...
    }

    function startRound() {
      round++;
      if (round > ROUNDS) return end();
      const route = buildBalancedRoute();
      const ansIdx = route.ans;
      lastAns = ansIdx;

      $round.textContent = `${round} / ${ROUNDS}라운드 · 지시 ${route.seq.length}개`;
      $rose.classList.add('hidden');
      $prog.innerHTML = '';
      $stage.className = 'cp-stage';
      $stage.innerHTML = '<div class="cp-instr">북쪽을 보고 출발</div>';

      let i = 0;
      const play = () => {
        if (i >= route.seq.length) return ask(ansIdx);
        const s = route.seq[i];
        $stage.innerHTML = `<div class="cp-icon">${s.icon}</div><div class="cp-instr">${s.text}</div>`;
        sfx.tick();
        const pip = document.createElement('span');
        pip.className = 'cp-pip';
        $prog.appendChild(pip);
        i++;
        ctx.delay(play, showMs);
      };
      ctx.delay(play, 900);
    }

    function ask(ansIdx) {
      $stage.className = 'cp-stage ask';
      $stage.innerHTML = '<div class="cp-instr">출발점은 지금 어느 쪽?</div>';
      $rose.classList.remove('hidden');
      $rose.innerHTML = '';
      // 3×3 나침반 (가운데는 현재 위치)
      const cells = new Array(9).fill(null);
      DIRS.forEach((d, idx) => { cells[d.cell] = { ...d, idx }; });
      let locked = false;
      cells.forEach((c, pos) => {
        if (pos === 4) {
          const me = document.createElement('div');
          me.className = 'cp-me';
          me.textContent = '🧍';
          $rose.appendChild(me);
          return;
        }
        const b = document.createElement('button');
        b.className = 'cp-dir';
        b.textContent = c.label;
        b.addEventListener('pointerdown', e => {
          e.preventDefault();
          if (locked) return;
          locked = true;
          const ok = c.idx === ansIdx;
          if (ok) { correct++; sfx.good(); b.classList.add('correct'); }
          else {
            sfx.bad();
            b.classList.add('wrong');
            [...$rose.children].forEach(el => {
              if (el.textContent === DIRS[ansIdx].label) el.classList.add('correct');
            });
          }
          ctx.delay(startRound, ok ? 500 : 1100);
        });
        $rose.appendChild(b);
      });
    }

    function end() {
      ctx.finish({
        score: correct,
        perf: correct / EXPECTED,
        detail: `${correct} / ${ROUNDS} 정답 · 지시 ${steps}단계`,
      });
    }

    startRound();
  },
};
