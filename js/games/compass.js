// 머릿속 나침반 — 경로 적분(path integration)
// 전진·회전 지시를 머릿속으로만 따라가고, 마지막에 "출발점이 지금 어느 쪽인지" 답한다.
// 지하철 출구, 주차장에서 차 찾기에 실제로 쓰는 능력.
//
// 답한 뒤에는 걸어온 길을 지도로 되짚어 보여준다. 방향만 알려주면
// "왜 틀렸는지"를 모르는데, 경로를 보면 어디서 어긋났는지 눈으로 잡힌다.
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
const HEAD_NAME = ['북', '동', '남', '서'];

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
      <div class="cp-review hidden" id="cp-review"></div>
    `;
    const $round = ctx.body.querySelector('#cp-round');
    const $stage = ctx.body.querySelector('#cp-stage');
    const $prog = ctx.body.querySelector('#cp-progress');
    const $rose = ctx.body.querySelector('#cp-rose');
    const $review = ctx.body.querySelector('#cp-review');

    function buildRoute() {
      let x = 0, y = 0, h = 0;
      const seq = [];
      const pts = [[0, 0]];   // 꺾인 지점들 — 나중에 지도로 그린다
      let moves = 0;
      for (let i = 0; i < steps; i++) {
        // 남은 지시로 최소 2번은 전진해야 방향이 결정된다
        const mustMove = steps - i <= 2 - moves;
        if (mustMove || Math.random() < 0.5) {
          const n = ri(1, 3);
          x += STEP[h][0] * n;
          y += STEP[h][1] * n;
          seq.push({ text: `${n}칸 전진`, icon: '⬆' });
          pts.push([x, y]);
          moves++;
        } else {
          const t = ri(0, 2);
          if (t === 0) { h = (h + 1) % 4; seq.push({ text: '우회전', icon: '↻' }); }
          else if (t === 1) { h = (h + 3) % 4; seq.push({ text: '좌회전', icon: '↺' }); }
          else { h = (h + 2) % 4; seq.push({ text: '뒤로 돌기', icon: '⇅' }); }
        }
      }
      return { seq, x, y, h, pts };
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

    // ---------- 되짚어보기 지도 ----------
    // 상대방위(내 진행방향 기준) → 절대 각도. 화면은 항상 북쪽이 위.
    function absAngleOf(relIdx, h) {
      // relIdx 0=앞 … 시계방향. h는 현재 바라보는 절대 방위.
      return (relIdx * 45 + h * 90) * Math.PI / 180;   // 북 기준 시계방향 라디안
    }

    function drawReview(route, ansIdx, myIdx, ok) {
      const pts = route.pts;
      // 경계 계산 후 여백을 둔 viewBox
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const minX = Math.min(...xs) - 1.4, maxX = Math.max(...xs) + 1.4;
      const minY = Math.min(...ys) - 1.4, maxY = Math.max(...ys) + 1.4;
      const w = maxX - minX, hgt = maxY - minY;
      const side = Math.max(w, hgt);
      // 정사각 뷰로 맞춰 격자가 찌그러지지 않게
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const x0 = cx - side / 2, y0 = cy - side / 2;
      const S = 100 / side;                              // 좌표 → SVG 배율
      const px = x => (x - x0) * S;
      const py = y => (y0 + side - y) * S;               // y축 뒤집기 (북쪽이 위)

      // 격자
      let grid = '';
      for (let g = Math.ceil(x0); g <= x0 + side; g++) {
        grid += `<line x1="${px(g).toFixed(1)}" y1="0" x2="${px(g).toFixed(1)}" y2="100" class="cpm-grid"/>`;
      }
      for (let g = Math.ceil(y0); g <= y0 + side; g++) {
        grid += `<line x1="0" y1="${py(g).toFixed(1)}" x2="100" y2="${py(g).toFixed(1)}" class="cpm-grid"/>`;
      }

      // 걸어온 길
      const poly = pts.map(p => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
      // 꺾인 지점 번호
      let dots = '';
      pts.forEach((p, i) => {
        if (i === 0 || i === pts.length - 1) return;
        dots += `<circle cx="${px(p[0]).toFixed(1)}" cy="${py(p[1]).toFixed(1)}" r="1.6" class="cpm-node"/>`;
      });

      const ex = px(route.x), ey = py(route.y);
      const sx = px(0), sy = py(0);

      // 지금 바라보는 방향 (짧은 화살표)
      const hAng = route.h * Math.PI / 2;
      const hx = ex + Math.sin(hAng) * 11, hy = ey - Math.cos(hAng) * 11;

      // 정답 방향 = 현재 위치 → 출발점
      const aAng = absAngleOf(ansIdx, route.h);
      const ax = ex + Math.sin(aAng) * 16, ay = ey - Math.cos(aAng) * 16;
      // 내가 고른 방향
      const mAng = absAngleOf(myIdx, route.h);
      const mx = ex + Math.sin(mAng) * 16, my = ey - Math.cos(mAng) * 16;

      const wrongArrow = ok ? '' : `
        <line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}"
              class="cpm-mine" marker-end="url(#cpm-mine-head)"/>`;

      $review.innerHTML = `
        <svg viewBox="-6 -6 112 112" class="cpm-svg">
          <defs>
            <marker id="cpm-ans-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="cpm-ans-fill"/>
            </marker>
            <marker id="cpm-mine-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="cpm-mine-fill"/>
            </marker>
            <marker id="cpm-face-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" class="cpm-face-fill"/>
            </marker>
          </defs>
          ${grid}
          <polyline points="${poly}" class="cpm-path"/>
          ${dots}
          <line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"
                class="cpm-face" marker-end="url(#cpm-face-head)"/>
          <line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}"
                class="cpm-ans" marker-end="url(#cpm-ans-head)"/>
          ${wrongArrow}
          <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3.2" class="cpm-start"/>
          <text x="${sx.toFixed(1)}" y="${(sy - 5.5).toFixed(1)}" class="cpm-label">출발</text>
          <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.2" class="cpm-end"/>
          <text x="${ex.toFixed(1)}" y="${(ey + 8).toFixed(1)}" class="cpm-label">지금</text>
          <text x="2" y="7" class="cpm-north">↑ 북</text>
        </svg>
        <div class="cpm-legend">
          <span><i class="lg-path"></i>걸어온 길</span>
          <span><i class="lg-face"></i>보는 방향 (${HEAD_NAME[route.h]})</span>
          <span><i class="lg-ans"></i>출발점 = ${DIRS[ansIdx].label}</span>
          ${ok ? '' : `<span><i class="lg-mine"></i>내 답 = ${DIRS[myIdx].label}</span>`}
        </div>
      `;
      $review.classList.remove('hidden');
    }

    function startRound() {
      round++;
      if (round > ROUNDS) return end();
      const route = buildBalancedRoute();
      const ansIdx = route.ans;
      lastAns = ansIdx;

      $round.textContent = `${round} / ${ROUNDS}라운드 · 지시 ${route.seq.length}개`;
      $rose.classList.add('hidden');
      $review.classList.add('hidden');
      $review.innerHTML = '';
      $prog.innerHTML = '';
      $stage.className = 'cp-stage';
      $stage.innerHTML = '<div class="cp-instr">북쪽을 보고 출발</div>';

      let i = 0;
      const play = () => {
        if (i >= route.seq.length) return ask(route, ansIdx);
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

    function ask(route, ansIdx) {
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
          // 걸어온 길을 지도로 되짚어 준다
          $stage.innerHTML = `<div class="cp-instr">${ok ? '정답' : `정답은 ${DIRS[ansIdx].label}`}</div>`;
          drawReview(route, ansIdx, c.idx, ok);
          // 틀렸으면 더 오래 보여준다
          ctx.delay(startRound, ok ? 2200 : 3800);
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
