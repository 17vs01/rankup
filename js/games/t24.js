// 24 만들기 — 역산
// 숫자 4개와 사칙연산으로 목표값을 만든다. 푸는 것보다 만드는 게 어렵다.
// 숫자 탭 → 연산자 탭 → 숫자 탭 하면 두 수가 하나로 합쳐진다. 마지막 한 수가 목표값이면 성공.
//
// 모드 2가지
//  - 기본: 5문제. 시간 제한 없음. 전체를 푼 총 시간이 기록으로 남는다.
//  - 타임어택: 단계마다 제한 시간 안에 5문제를 다 풀어야 다음 단계로. 단계가 오를수록 시간이 줄어든다.
import { sfx } from '../audio.js';
import { judge } from '../feedback.js';

const ROUNDS = 5;
const EPS = 1e-6;
// 데일리 챌린지면 ctx.rng(시드 난수)가 들어온다
let R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));

// 타임어택 단계별 제한 시간(초). 12%씩 줄고 45초에서 멈춘다.
function limitFor(level) {
  return Math.max(45, Math.round(150 * Math.pow(0.88, level - 1)));
}

// ---------- 분수 계산 ----------
// 타일 값을 소수로 들고 있으면 5÷6이 0.83으로 보여서 다음 수를 가늠할 수 없다.
// 분자/분모를 그대로 들고 다니며 "5/6"으로 보여준다.
const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
function rat(n, d = 1) {
  if (d < 0) { n = -n; d = -d; }
  const k = gcd(Math.abs(n), d) || 1;
  return { n: n / k, d: d / k };
}
const rAdd = (x, y) => rat(x.n * y.d + y.n * x.d, x.d * y.d);
const rSub = (x, y) => rat(x.n * y.d - y.n * x.d, x.d * y.d);
const rMul = (x, y) => rat(x.n * y.n, x.d * y.d);
const rDiv = (x, y) => (y.n === 0 ? null : rat(x.n * y.d, x.d * y.n));

// 네 수로 target을 만드는 풀이를 찾는다. 못 만들면 null.
// 각 항은 { v: 값, s: 그 값을 만든 식 } 으로 들고 다녀서, 마지막에 식 전체를 보여줄 수 있다.
function solve24(nums, target) {
  function rec(arr) {
    if (arr.length === 1) return Math.abs(arr[0].v - target) < EPS ? arr[0].s : null;
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const rest = arr.filter((_, k) => k !== i && k !== j);
        const a = arr[i], b = arr[j];
        const ops = [
          ['+', a.v + b.v],
          ['-', a.v - b.v],
          ['×', a.v * b.v],
        ];
        if (Math.abs(b.v) > EPS) ops.push(['÷', a.v / b.v]);
        for (const [sym, v] of ops) {
          // 교환법칙이 성립하는 연산은 한 방향만 봐도 된다
          if ((sym === '+' || sym === '×') && i > j) continue;
          const got = rec([...rest, { v, s: `(${a.s} ${sym} ${b.s})` }]);
          if (got) return got;
        }
      }
    }
    return null;
  }
  const sol = rec(nums.map(n => ({ v: n, s: String(n) })));
  // 가장 바깥 괄호는 군더더기라 벗긴다
  return sol && sol.startsWith('(') && sol.endsWith(')') ? sol.slice(1, -1) : sol;
}

// 중간값이 전부 정수인 풀이만 찾는다.
// 분수를 거쳐야만 풀리는 문제(4 ÷ (1 − 5/6) 같은)는 난이도가 급으로 다르다.
function solveInt(nums, target) {
  function rec(arr) {
    if (arr.length === 1) return arr[0].v === target ? arr[0].s : null;
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue;
        const rest = arr.filter((_, k) => k !== i && k !== j);
        const a = arr[i], b = arr[j];
        const ops = [['+', a.v + b.v], ['-', a.v - b.v], ['×', a.v * b.v]];
        if (b.v !== 0 && a.v % b.v === 0) ops.push(['÷', a.v / b.v]);
        for (const [sym, v] of ops) {
          if ((sym === '+' || sym === '×') && i > j) continue;
          const got = rec([...rest, { v, s: `(${a.s} ${sym} ${b.s})` }]);
          if (got) return got;
        }
      }
    }
    return null;
  }
  const sol = rec(nums.map(n => ({ v: n, s: String(n) })));
  return sol && sol.startsWith('(') && sol.endsWith(')') ? sol.slice(1, -1) : sol;
}

// 난이도: 목표값과 숫자 범위가 올라간다
function makePuzzle(L) {
  const target = L < 1 ? 24 : L < 2.5 ? [24, 36][ri(0, 1)] : [24, 36, 48, 60][ri(0, 3)];
  const hi = Math.min(13, 9 + Math.floor(L * 1.5));
  const nums4 = () => [ri(1, hi), ri(1, hi), ri(1, hi), ri(1, hi)];

  // 분수를 거쳐야만 풀리는 문제는 높은 랭크에서 가끔만 낸다.
  // 낮은 랭크에 이게 나오면 "이게 말이 되나" 소리가 나온다.
  if (L >= 2.5 && R() < 0.2) {
    for (let t = 0; t < 300; t++) {
      const nums = nums4();
      if (solveInt(nums, target)) continue;      // 정수로 풀리면 이번엔 건너뛴다
      const sol = solve24(nums, target);
      if (sol) return { nums, target, sol, frac: true };
    }
  }
  for (let t = 0; t < 600; t++) {
    const nums = nums4();
    const sol = solveInt(nums, target);
    if (sol) return { nums, target, sol, frac: false };
  }
  return { nums: [4, 6, 2, 3], target: 24, sol: solveInt([4, 6, 2, 3], 24), frac: false };
}

// 분수는 5/6처럼, 정수는 그대로
const fmt = x => (x.d === 1 ? String(x.n) : `${x.n}/${x.d}`);

export const t24Game = {
  id: 't24',
  name: '24 만들기',
  icon: '🧩',
  desc: '숫자 4개로 목표값 만들기',
  modes: [
    { id: 'normal', name: '기본', desc: '5문제 · 시간 제한 없음' },
    { id: 'attack', name: '타임어택', desc: '단계가 오를수록 시간이 줄어듭니다' },
  ],
  run(ctx) {
    R = ctx.rng || Math.random;
    const L = Math.max(0, (ctx.rating - 800) / 250);
    const attack = ctx.mode === 'attack';

    let level = 1;                 // 타임어택 단계
    let round = 0, solved = 0, levelSolved = 0, totalSec = 0;
    const solveTimes = [];         // 라운드별 해결 시간 (최단 기록용)
    let tiles = [], target = 0, sol = '', selIdx = -1, op = null, startAt = 0;
    let revealed = false;          // 정답을 보여준 상태 (확인 대기)
    let finished = false;
    const history = [];            // 되돌리기용 타일 스냅샷
    let levelStart = 0, tickId = null;

    ctx.body.innerHTML = `
      <div class="t24-round" id="t24-round"></div>
      <div class="t24-target">목표 <b id="t24-target"></b></div>
      <div class="t24-tiles" id="t24-tiles"></div>
      <div class="t24-ops" id="t24-ops">
        <button class="t24-op" data-o="+">+</button>
        <button class="t24-op" data-o="-">−</button>
        <button class="t24-op" data-o="*">×</button>
        <button class="t24-op" data-o="/">÷</button>
      </div>
      <div class="t24-actions">
        <button class="btn-secondary" id="t24-undo">↺ 되돌리기</button>
        <button class="btn-secondary" id="t24-skip">모르겠어요</button>
      </div>
      <div class="t24-reveal hidden" id="t24-reveal">
        <div class="t24-sol" id="t24-sol"></div>
        <button class="btn-primary" id="t24-ok">확인했어요</button>
      </div>
      <div class="t24-reveal hidden" id="t24-next">
        <button class="btn-primary" id="t24-go">확인 — 다음 문제</button>
      </div>
      <div class="t24-fb" id="t24-fb"></div>
      <button class="t24-toggle" id="t24-autobtn"></button>
    `;
    const $round = ctx.body.querySelector('#t24-round');
    const $target = ctx.body.querySelector('#t24-target');
    const $tiles = ctx.body.querySelector('#t24-tiles');
    const $ops = ctx.body.querySelector('#t24-ops');
    const $actions = ctx.body.querySelector('.t24-actions');
    const $reveal = ctx.body.querySelector('#t24-reveal');
    const $sol = ctx.body.querySelector('#t24-sol');
    const $fb = ctx.body.querySelector('#t24-fb');
    const $next = ctx.body.querySelector('#t24-next');
    const $autobtn = ctx.body.querySelector('#t24-autobtn');

    // 정답(성공) 공개 후 자동으로 다음 문제로 넘어갈지. 끄면 "확인"을 눌러야 넘어간다.
    // 타임어택은 기다리는 동안에도 시계가 흘러 손해만 보므로 항상 자동으로 넘긴다.
    let autoNext = attack ? true : ctx.state.t24Auto !== false;   // 기본 ON
    function renderAutoBtn() {
      $autobtn.textContent = autoNext ? '정답 후 자동 넘기기 · ON' : '정답 후 자동 넘기기 · OFF';
      $autobtn.classList.toggle('off', !autoNext);
    }
    if (attack) $autobtn.classList.add('hidden');   // 타임어택은 선택지 자체를 감춘다
    renderAutoBtn();
    $autobtn.addEventListener('pointerdown', e => {
      e.preventDefault();
      autoNext = !autoNext;
      ctx.state.t24Auto = autoNext;
      ctx.persist();
      sfx.tick();
      renderAutoBtn();
    });

    // ---------- 타임어택 시계 ----------
    function startLevelClock() {
      if (!attack) return;
      levelStart = performance.now();
      if (tickId) clearInterval(tickId);
      const limit = limitFor(level);
      const tick = () => {
        const left = limit - (performance.now() - levelStart) / 1000;
        if (left <= 0) {
          clearInterval(tickId); tickId = null;
          ctx.setTimerText('0s');
          return end('time');
        }
        ctx.setTimerText(Math.ceil(left) + 's');
        const $t = document.querySelector('#game-timer');
        if ($t) $t.classList.toggle('urgent', left <= 10);
      };
      tick();
      tickId = ctx.trackInterval(setInterval(tick, 250));
    }

    function render() {
      $tiles.innerHTML = '';
      tiles.forEach((v, i) => {
        const b = document.createElement('button');
        b.className = 't24-tile' + (i === selIdx ? ' sel' : '');
        b.textContent = fmt(v);
        b.dataset.i = i;
        $tiles.appendChild(b);
      });
      for (const b of $ops.children) b.classList.toggle('sel', b.dataset.o === op);
    }

    function newRound() {
      if (finished) return;
      round++;
      // 타임어택: 5문제를 다 풀면 다음 단계 (시간이 줄어든다)
      if (round > ROUNDS) {
        if (!attack) return end();
        // 5문제를 전부 실제로 풀었을 때만 승급 — "모르겠어요"로는 넘어갈 수 없다
        if (levelSolved < ROUNDS) return end('skip');
        level++;
        round = 1;
        levelSolved = 0;
        sfx.tierup();
        $fb.textContent = `${level}단계 — 제한 ${limitFor(level)}초`;
        $fb.className = 't24-fb good';
        startLevelClock();
      }
      const p = makePuzzle(L);
      tiles = p.nums.map(n => rat(n));
      target = p.target;
      sol = p.sol;
      selIdx = -1; op = null; revealed = false;
      history.length = 0;
      startAt = performance.now();
      $reveal.classList.add('hidden');
      $next.classList.add('hidden');
      $actions.classList.remove('hidden');
      $round.textContent = attack
        ? `${level}단계 · ${round} / ${ROUNDS}문제`
        : `${round} / ${ROUNDS}라운드`;
      $target.textContent = target;
      if (!$fb.textContent.includes('단계 —')) {
        $fb.textContent = '두 수를 골라 합치세요';
        $fb.className = 't24-fb';
      }
      render();
    }

    $tiles.addEventListener('pointerdown', e => {
      const b = e.target.closest('.t24-tile');
      if (!b || revealed || finished) return;
      e.preventDefault();
      const i = Number(b.dataset.i);
      if (selIdx === -1) { selIdx = i; render(); return; }
      if (i === selIdx) { selIdx = -1; render(); return; }
      if (!op) { selIdx = i; render(); return; }

      const a = tiles[selIdx], c = tiles[i];
      let r;
      if (op === '+') r = rAdd(a, c);
      else if (op === '-') r = rSub(a, c);
      else if (op === '*') r = rMul(a, c);
      else {
        r = rDiv(a, c);
        if (!r) { $fb.textContent = '0으로 나눌 수 없습니다'; $fb.className = 't24-fb bad'; return; }
      }

      history.push(tiles.slice());
      const rest = tiles.filter((_, k) => k !== selIdx && k !== i);
      tiles = [...rest, r];
      selIdx = -1; op = null;
      sfx.tick();
      render();

      if (tiles.length === 1) {
        const ok = tiles[0].d === 1 && tiles[0].n === target;
        if (ok) {
          solved++; levelSolved++;
          const took = (performance.now() - startAt) / 1000;
          totalSec += took;
          solveTimes.push(took);
          sfx.good();
          judge(ctx.body, true, `${target} 완성! (${took.toFixed(1)}초)`);
          $fb.textContent = `성공! ${fmt(tiles[0])} = ${target}  (${took.toFixed(1)}초)`;
          $fb.className = 't24-fb good';
          if (autoNext) {
            ctx.delay(newRound, 900);
          } else {
            // 자동 넘기기 OFF: 확인을 눌러야 다음 문제로 (타임어택은 그동안에도 시계가 간다)
            revealed = true;   // 대기 중 타일·연산 입력 잠금
            $actions.classList.add('hidden');
            $next.classList.remove('hidden');
          }
        } else {
          sfx.bad();
          judge(ctx.body, false, `목표는 ${target} — 되돌리세요`);
          $fb.textContent = `${fmt(tiles[0])} … 목표는 ${target}. 되돌리세요`;
          $fb.className = 't24-fb bad';
        }
      }
    });

    $ops.addEventListener('pointerdown', e => {
      const b = e.target.closest('.t24-op');
      if (!b || revealed || finished) return;
      e.preventDefault();
      op = b.dataset.o === op ? null : b.dataset.o;
      render();
    });

    ctx.body.querySelector('#t24-undo').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (revealed || finished) return;
      const prev = history.pop();
      if (!prev) return;
      tiles = prev; selIdx = -1; op = null;
      $fb.textContent = '두 수를 골라 합치세요';
      $fb.className = 't24-fb';
      render();
    });

    // 모르겠으면 정답 식을 보여준다. 확인해야 다음 문제로 넘어간다.
    ctx.body.querySelector('#t24-skip').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (revealed || finished) return;
      revealed = true;
      sfx.bad();
      $sol.innerHTML = `<b>${sol}</b> = ${target}`;
      $reveal.classList.remove('hidden');
      $actions.classList.add('hidden');
      $fb.textContent = '이렇게 푸는 문제였습니다';
      $fb.className = 't24-fb';
    });

    ctx.body.querySelector('#t24-ok').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (!revealed || finished) return;
      revealed = false;
      $reveal.classList.add('hidden');
      $actions.classList.remove('hidden');
      newRound();
    });

    // 성공 후 확인 (자동 넘기기 OFF일 때만 보인다)
    ctx.body.querySelector('#t24-go').addEventListener('pointerdown', e => {
      e.preventDefault();
      if (finished) return;
      revealed = false;
      $next.classList.add('hidden');
      $actions.classList.remove('hidden');
      newRound();
    });

    function end(reason) {
      if (finished) return;
      finished = true;
      if (tickId) { clearInterval(tickId); tickId = null; }

      if (attack) {
        // 타임어택은 실패로만 끝난다 (시간 초과·못 푼 문제). 진행 중이던 단계는 통과하지 못한 것.
        const passed = level - 1;
        const why = reason === 'skip' ? '5문제를 다 풀지 못함' : '시간 초과';
        ctx.finish({
          score: passed,
          perf: (passed + 0.6) / 2.2,
          detail: `${passed}단계 통과 · ${level}단계에서 ${why} (${levelSolved}/${ROUNDS}문제)`,
          time: passed > 0
            ? { key: 'level_max', value: passed, unit: 'level', label: '타임어택 최고' } : null,
        });
        return;
      }

      const avg = solved > 0 ? (totalSec / solved).toFixed(0) : '–';
      const fastest = solveTimes.length ? Math.min(...solveTimes) : null;
      // 5문제를 전부 푼 판만 "전체 최단" 기록으로 인정한다
      const allSolved = solved === ROUNDS;
      const times = [];
      if (fastest !== null) times.push({ key: 'time_one', value: fastest, unit: 'sec', label: '한 문제 최단' });
      if (allSolved) times.push({ key: 'time_all', value: totalSec, unit: 'sec', label: '전체 최단' });
      ctx.finish({
        score: solved,
        perf: solved / 3.2,
        detail: `${solved}/${ROUNDS} 성공${solved ? ` · 평균 ${avg}초` : ''}`,
        times,
      });
    }

    if (attack) {
      $fb.textContent = `1단계 — 제한 ${limitFor(1)}초`;
      $fb.className = 't24-fb good';
      startLevelClock();
    }
    newRound();
  },
};
