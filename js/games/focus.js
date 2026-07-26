// 집중력 콤보: 반응속도 3회 → 스트룹 20초 → 고/노고 20초
import { sfx } from '../audio.js';

const COLORS = [
  { name: '빨강', css: '#ff5d6c' },
  { name: '파랑', css: '#5b8cff' },
  { name: '초록', css: '#34d27b' },
  { name: '노랑', css: '#ffc94d' },
];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export const focusGame = {
  id: 'focus',
  name: '집중력',
  icon: '⚡',
  desc: '반응속도 + 스트룹 + 고/노고',
  run(ctx) {
    let totalPts = 0;
    const parts = [];

    // ---------- 1단계: 반응속도 ----------
    function stageReaction() {
      ctx.setTitle('⚡ 반응속도 1/3');
      const times = [];
      let trial = 0;

      ctx.body.innerHTML = `
        <div class="focus-stage">초록색이 되는 순간 탭!</div>
        <div class="reaction-pad" id="r-pad"><span>준비되면 탭</span></div>
      `;
      const $pad = ctx.body.querySelector('#r-pad');
      let state = 'idle'; // idle -> wait -> go
      let goAt = 0, timeoutId = null;

      function arm() {
        state = 'wait';
        $pad.className = 'reaction-pad wait';
        $pad.innerHTML = '<span>기다려…</span>';
        timeoutId = ctx.delay(() => {
          state = 'go';
          goAt = performance.now();
          $pad.className = 'reaction-pad go';
          $pad.innerHTML = '<span>탭!!</span>';
        }, ri(1000, 2600));
      }

      $pad.addEventListener('pointerdown', () => {
        if (state === 'idle') { arm(); return; }
        if (state === 'wait') {
          // 부정출발
          clearTimeout(timeoutId);
          sfx.bad();
          times.push(600);
          state = 'result';
          $pad.className = 'reaction-pad';
          $pad.innerHTML = '<span>부정출발! (+600ms)</span>';
          ctx.delay(nextTrial, 900);
          return;
        }
        if (state === 'go') {
          const ms = Math.round(performance.now() - goAt);
          times.push(ms);
          sfx.good();
          state = 'result';
          $pad.className = 'reaction-pad';
          $pad.innerHTML = `<span class="ms">${ms}<small>ms</small></span>`;
          ctx.delay(nextTrial, 900);
        }
      });

      function nextTrial() {
        trial++;
        if (trial >= 3) {
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
          const pts = Math.max(0, Math.round((520 - avg) / 15));
          totalPts += pts;
          parts.push(`반응 ${avg}ms`);
          stageStroop();
          return;
        }
        ctx.setTitle(`⚡ 반응속도 ${trial + 1}/3`);
        state = 'idle';
        $pad.className = 'reaction-pad';
        $pad.innerHTML = '<span>준비되면 탭</span>';
      }
    }

    // ---------- 2단계: 스트룹 ----------
    function stageStroop() {
      ctx.setTitle('🎨 스트룹');
      let correct = 0, wrong = 0, cur = null, locked = false;

      ctx.body.innerHTML = `
        <div class="focus-stage">글자 말고 <b>색깔</b>을 고르세요</div>
        <div class="stroop-word" id="s-word"></div>
        <div class="choices-grid" id="s-choices"></div>
        <div class="score-line" id="s-score">정답 <b>0</b> · 오답 0</div>
      `;
      const $w = ctx.body.querySelector('#s-word');
      const $c = ctx.body.querySelector('#s-choices');
      const $s = ctx.body.querySelector('#s-score');

      // 색 버튼 4개 고정
      COLORS.forEach(col => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = col.name;
        b.addEventListener('pointerdown', () => {
          if (locked || !cur) return;
          locked = true;
          if (col.name === cur.ink.name) { correct++; sfx.good(); }
          else { wrong++; sfx.bad(); }
          $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`;
          ctx.delay(next, 120);
        });
        $c.appendChild(b);
      });

      function next() {
        locked = false;
        const word = COLORS[ri(0, 3)];
        let ink = COLORS[ri(0, 3)];
        // 70% 확률로 글자≠색 (간섭 유발)
        if (word === ink && Math.random() < 0.7) ink = COLORS[(COLORS.indexOf(ink) + ri(1, 3)) % 4];
        cur = { word, ink };
        $w.textContent = word.name;
        $w.style.color = ink.css;
      }

      next();
      ctx.timer(20, () => {
        totalPts += Math.max(0, correct - wrong);
        parts.push(`스트룹 ${correct}`);
        stageGoNoGo();
      });
    }

    // ---------- 3단계: 고/노고 ----------
    function stageGoNoGo() {
      ctx.setTitle('🎯 고/노고');
      let hits = 0, misses = 0, falses = 0;
      let cur = null, curTimeout = null;

      ctx.body.innerHTML = `
        <div class="focus-stage"><b style="color:#5b8cff">파란 ●</b> 일 때만 탭!</div>
        <div class="reaction-pad" id="g-pad"><span style="font-size:64px" id="g-shape"></span></div>
        <div class="score-line" id="g-score">명중 <b>0</b> · 오탭 0</div>
      `;
      const $pad = ctx.body.querySelector('#g-pad');
      const $shape = ctx.body.querySelector('#g-shape');
      const $s = ctx.body.querySelector('#g-score');

      const SHAPES = [
        { html: '<span style="color:#5b8cff">●</span>', target: true },
        { html: '<span style="color:#ff5d6c">●</span>', target: false },
        { html: '<span style="color:#5b8cff">■</span>', target: false },
        { html: '<span style="color:#ffc94d">▲</span>', target: false },
      ];

      function show() {
        // 45% 확률로 타겟
        cur = Math.random() < 0.45 ? SHAPES[0] : SHAPES[ri(1, 3)];
        cur.done = false;
        $shape.innerHTML = cur.html;
        curTimeout = ctx.delay(() => {
          if (cur.target && !cur.done) misses++;
          $shape.innerHTML = '';
          cur = null;
          ctx.delay(show, ri(250, 550));
        }, 750);
      }

      $pad.addEventListener('pointerdown', () => {
        if (!cur || cur.done) return;
        cur.done = true;
        if (cur.target) {
          hits++; sfx.good();
        } else {
          falses++; sfx.bad();
        }
        $s.innerHTML = `명중 <b>${hits}</b> · 오탭 ${falses}`;
      });

      show();
      ctx.timer(20, () => {
        clearTimeout(curTimeout);
        totalPts += Math.max(0, hits - falses * 2 - misses);
        parts.push(`고/노고 ${hits}`);
        end();
      });
    }

    function end() {
      const expected = 30 + Math.max(0, ctx.rating - 800) / 40;
      const perf = totalPts / expected;
      ctx.finish({
        score: totalPts,
        perf,
        detail: parts.join(' · '),
      });
    }

    stageReaction();
  },
};
