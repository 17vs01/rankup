// 집중력 — 반응속도·스트룹·고/노고 중 골라서 단련
// 1종목이면 5판, 2종목이면 각 3판, 3종목 모두면 각 1판.
// 3종목 모두에서 레벨 기준을 전부 충족하면 레벨업. 상한 없음.
import { sfx } from '../audio.js';

const COLORS = [
  { name: '빨강', css: '#ff5d6c' },
  { name: '파랑', css: '#5b8cff' },
  { name: '초록', css: '#34d27b' },
  { name: '노랑', css: '#ffc94d' },
];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

const STAGES = [
  { id: 'reaction', name: '반응속도', desc: '초록이 되는 순간 탭 · 1판 = 3회' },
  { id: 'stroop',   name: '스트룹',   desc: '글자 말고 색깔 고르기 · 1판 = 20초' },
  { id: 'gonogo',   name: '고/노고', desc: '파란 ●일 때만 탭 · 1판 = 20초' },
];

// 레벨 t에 오르기 위한 기준 (3종목 모두 한 판에서)
function goalsFor(t) {
  return {
    reaction: Math.max(220, 420 - (t - 1) * 8),  // 평균 반응 이하 (ms)
    stroop: 8 + t,                                // 정답 − 오답 이상
    gonogo: 6 + t,                                // 명중 − 오탭×2 − 놓침 이상
  };
}

// 저장된 선택을 읽는다 (없거나 망가졌으면 3종목 전부)
function readSel(state) {
  const s = Array.isArray(state.focusSel)
    ? state.focusSel.filter(x => STAGES.some(st => st.id === x)) : [];
  return s.length ? s : STAGES.map(x => x.id);
}

// 조합 키 — 고른 종목이 다르면 판 자체가 달라서 기록도 따로 쌓는다
function keyOf(sel) {
  return STAGES.map(s => s.id).filter(id => sel.includes(id)).join('+');
}

function labelOf(key) {
  const ids = String(key).split('+');
  if (ids.length === STAGES.length) return '3종목 전체';
  return STAGES.filter(s => ids.includes(s.id)).map(s => s.name).join(' · ');
}

export const focusGame = {
  id: 'focus',
  name: '집중력',
  icon: '⚡',
  desc: '반응속도 + 스트룹 + 고/노고',

  // 고른 조합마다 기록을 따로 쌓는다 (main.js가 읽는 규약)
  variantKey: state => keyOf(readSel(state)),
  variantLabel: labelOf,

  // 방법 화면에서 카운트다운 전에 고르게 한다 (게임 안에서 고르면 긴장이 끊긴다).
  // host = 붙일 DOM, onStart = 고르고 나서 부를 함수.
  picker(state, host, onStart) {
    const level = (state.disc.focus.records && state.disc.focus.records.focus_level) || 0;
    const goal = goalsFor(level + 1);
    let sel = readSel(state);

    host.innerHTML = `
      <div class="fp-wrap">
        <div class="fp-title">무엇을 단련할까요?</div>
        ${STAGES.map(s => `
          <button class="fp-item${sel.includes(s.id) ? ' on' : ''}" data-id="${s.id}">
            <span class="fp-check">✓</span>
            <span><span class="fp-name">${s.name}</span><div class="fp-desc">${s.desc}</div></span>
          </button>`).join('')}
        <div class="fp-goal" id="fp-goal"></div>
        <button class="btn-primary" id="fp-start">시작</button>
      </div>
    `;
    const $goal = host.querySelector('#fp-goal');
    const vars = (state.disc.focus && state.disc.focus.variants) || {};
    const update = () => {
      let html;
      if (sel.length === 3) {
        html = `3종목 모두 통과하면 레벨업 — 지금 <b>${level}</b>단계<br>`
          + `기준: 반응 ≤ ${goal.reaction}ms · 스트룹 ≥ ${goal.stroop} · 고/노고 ≥ ${goal.gonogo}`;
      } else {
        const reps = sel.length === 1 ? 5 : 3;
        html = `${sel.length}종목 집중 단련 — 각 ${reps}판`;
      }
      // 조합마다 레이팅이 따로다 — 고르기 전에 내 실력과 기록을 보여준다
      const v = vars[keyOf(sel)];
      $goal.innerHTML = html
        + (v && v.sessions
          ? `<br><b>이 조합 ${v.rating} LP</b> · 최고 ${v.best} · ${v.sessions}판`
          : '<br>이 조합은 아직 기록이 없어요 · 1000 LP에서 시작');
    };
    update();
    host.querySelectorAll('.fp-item').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.id;
        if (sel.includes(id)) {
          if (sel.length === 1) return;   // 최소 1종목
          sel = sel.filter(s => s !== id);
          b.classList.remove('on');
        } else {
          sel = STAGES.map(s => s.id).filter(s => sel.includes(s) || s === id);
          b.classList.add('on');
        }
        sfx.tick();
        update();
      });
    });
    host.querySelector('#fp-start').addEventListener('click', () => {
      state.focusSel = sel.slice();
      onStart();
    });
  },

  run(ctx) {
    const d = ctx.state.disc.focus;
    const level = (d.records && d.records.focus_level) || 0;
    const goal = goalsFor(level + 1);
    const sel = readSel(ctx.state);

    let plan = [], planIdx = 0;
    let totalPts = 0;
    const parts = [];
    let bestReaction = null;   // 이번 판 최고 반응속도 (부정출발 제외, ms)
    // 레벨 판정용 — 3종목 모두일 때 각 종목의 성적
    const stats = { reactionAvg: null, stroopNet: null, gonogoNet: null };

    function nextStage() {
      if (planIdx >= plan.length) return end();
      const p = plan[planIdx++];
      if (p.id === 'reaction') stageReaction(p);
      else if (p.id === 'stroop') stageStroop(p);
      else stageGoNoGo(p);
    }

    const label = p => p.reps > 1 ? ` ${p.rep}/${p.reps}판` : '';

    // ---------- 반응속도 (1판 = 3회) ----------
    function stageReaction(p) {
      ctx.setTitle(`⚡ 반응속도${label(p)}`);
      ctx.setTimerText('');
      const times = [];        // 유효 반응 (ms)
      let penalties = 0;       // 부정출발 횟수
      let trial = 0;

      ctx.body.innerHTML = `
        <div class="focus-stage">초록색이 되는 순간 탭! (${trial + 1}/3)</div>
        <div class="reaction-pad" id="r-pad"><span>준비되면 탭</span></div>
      `;
      const $stage = ctx.body.querySelector('.focus-stage');
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
          penalties++;
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
          const avg = Math.round((times.reduce((a, b) => a + b, 0) + penalties * 600) / 3);
          const pts = Math.max(0, Math.round((520 - avg) / 15));
          totalPts += pts;
          if (times.length) {
            const best = Math.min(...times);
            bestReaction = bestReaction === null ? best : Math.min(bestReaction, best);
          }
          stats.reactionAvg = avg;
          parts.push(`반응 ${avg}ms`);
          nextStage();
          return;
        }
        $stage.textContent = `초록색이 되는 순간 탭! (${trial + 1}/3)`;
        state = 'idle';
        $pad.className = 'reaction-pad';
        $pad.innerHTML = '<span>준비되면 탭</span>';
      }
    }

    // ---------- 스트룹 (20초) ----------
    function stageStroop(p) {
      ctx.setTitle(`🎨 스트룹${label(p)}`);
      let correct = 0, wrong = 0, streak = 0, cur = null, locked = false;

      ctx.body.innerHTML = `
        <div class="focus-stage">글자 말고 <b>색깔</b>을 고르세요</div>
        <div class="stroop-word" id="s-word"></div>
        <div class="choices-grid" id="s-choices"></div>
        <div class="score-line" id="s-score">정답 <b>0</b> · 오답 0</div>
      `;
      const $w = ctx.body.querySelector('#s-word');
      const $c = ctx.body.querySelector('#s-choices');
      const $s = ctx.body.querySelector('#s-score');

      const renderScore = () => {
        $s.innerHTML = `정답 <b>${correct}</b> · 오답 ${wrong}`
          + (streak >= 3 ? `<span class="combo">🔥 ${streak}연속</span>` : '');
      };

      // 색 버튼 4개 고정
      COLORS.forEach(col => {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = col.name;
        b.addEventListener('pointerdown', () => {
          if (locked || !cur) return;
          locked = true;
          if (col.name === cur.ink.name) { correct++; streak++; sfx.combo(streak); }
          else { wrong++; streak = 0; sfx.bad(); }
          renderScore();
          ctx.delay(next, 120);
        });
        $c.appendChild(b);
      });

      function next() {
        locked = false;
        const word = COLORS[ri(0, 3)];
        // 70% 확률로 글자≠색 (간섭 유발)
        let ink = word;
        if (Math.random() < 0.7) ink = COLORS[(COLORS.indexOf(word) + ri(1, 3)) % 4];
        cur = { word, ink };
        $w.textContent = word.name;
        $w.style.color = ink.css;
      }

      next();
      ctx.timer(20, () => {
        totalPts += Math.max(0, correct - wrong);
        stats.stroopNet = correct - wrong;
        parts.push(`스트룹 ${correct}`);
        nextStage();
      });
    }

    // ---------- 고/노고 (20초) ----------
    function stageGoNoGo(p) {
      ctx.setTitle(`🎯 고/노고${label(p)}`);
      let hits = 0, misses = 0, falses = 0, shown = 0;
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
        // 45% 확률로 타겟. 갈수록 빨라진다 — 표시 시간이 조금씩 줄어든다.
        cur = Math.random() < 0.45 ? SHAPES[0] : SHAPES[ri(1, 3)];
        cur.done = false;
        shown++;
        $shape.innerHTML = cur.html;
        const holdMs = Math.max(480, 750 - shown * 10);
        curTimeout = ctx.delay(() => {
          if (cur.target && !cur.done) misses++;
          $shape.innerHTML = '';
          cur = null;
          ctx.delay(show, Math.max(180, ri(250, 550) - shown * 8));
        }, holdMs);
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
        const net = hits - falses * 2 - misses;
        totalPts += Math.max(0, net);
        stats.gonogoNet = net;
        parts.push(`고/노고 ${hits}`);
        nextStage();
      });
    }

    function end() {
      // 판 수가 다르면 기대치도 그만큼 배율 (기존: 3종목 각 1판 = 기준)
      const perRun = (30 + Math.max(0, ctx.rating - 800) / 40) / 3;
      const perf = totalPts / (perRun * plan.length);

      // 3종목 모두 한 판에서 기준을 전부 충족하면 레벨업
      let leveledUp = false;
      if (sel.length === 3
        && stats.reactionAvg !== null && stats.reactionAvg <= goal.reaction
        && stats.stroopNet !== null && stats.stroopNet >= goal.stroop
        && stats.gonogoNet !== null && stats.gonogoNet >= goal.gonogo) {
        leveledUp = true;
      }

      const times = [];
      if (bestReaction !== null) {
        times.push({ key: 'time_reaction', value: bestReaction, unit: 'ms', label: '최고 반응속도' });
      }
      if (leveledUp) {
        times.push({ key: 'focus_level', value: level + 1, unit: 'level', label: '3종목 레벨' });
      }

      ctx.finish({
        score: totalPts,
        perf,
        detail: parts.join(' · ')
          + (sel.length === 3 ? (leveledUp ? ` · 레벨 ${level + 1} 달성!` : ` · 레벨 ${level}`) : ''),
        times,
      });
    }

    // 선택은 방법 화면에서 이미 끝났다. 바로 판을 짠다.
    const reps = sel.length === 1 ? 5 : sel.length === 2 ? 3 : 1;
    for (const s of STAGES) {
      if (!sel.includes(s.id)) continue;
      for (let r = 1; r <= reps; r++) plan.push({ id: s.id, rep: r, reps });
    }
    nextStage();
  },
};
