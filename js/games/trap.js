// 함정 퀴즈 — 한 번 더 생각해야 풀리는 문제
// 보기 넷 중 하나는 직관이 내미는 "그럴듯한 오답"이다. 답하면 맞았든 틀렸든
// 왜 그런지를 그 문제의 숫자로 풀어서 보여준다 — 원리가 남게.
//
// 문제는 전부 고전 논리 문제의 "가족"이다. 숫자를 바꿔 무한 생성되므로
// 답을 외울 수 없고, 통찰(비둘기집·울타리 기둥·거꾸로 세기…)만 남는다.
// 시간 제한이 없다 — 심도 있게 생각하는 게 목적이라 압박이 오히려 독이다.
import { sfx } from '../audio.js';

const ROUNDS = 5;
const EXPECTED = 3.3;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[ri(0, arr.length - 1)];
const shuffle = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

// ---------- 문제 가족 ----------
// 각 생성기는 { q, ans, trap, unit, why } 반환.
// ans/trap은 숫자, unit은 보기에 붙는 단위. why는 이 문제의 숫자로 쓴 풀이.

const COLOR_SETS = [['흰색', '검은색'], ['흰색', '검은색', '회색'], ['빨간색', '파란색', '노란색', '초록색']];

// 비둘기집 — 같은 색 두 짝
function genPigeon() {
  const colors = pick(COLOR_SETS);
  const c = colors.length;
  const T = ri(4, 9) * c * 2;   // 전체 개수는 낚시용
  return {
    q: `서랍에 ${colors.join('·')} 양말 ${T}짝이 뒤섞여 있습니다. 보지 않고 한 짝씩 꺼낼 때, 같은 색 두 짝을 확신하려면 최소 몇 짝을 꺼내야 할까요?`,
    ans: c + 1, trap: 2, unit: '짝',
    why: `최악의 경우를 생각하세요. 색이 ${c}가지니 ${c}짝이 전부 다른 색일 수 있습니다. 하지만 ${c + 1}짝째는 어떤 색이든 이미 나온 색과 겹칠 수밖에 없습니다. 전체 ${T}짝이라는 숫자는 답과 무관한 낚시입니다.`,
  };
}

// 비둘기집 심화 — 같은 색 K개
function genPigeonK() {
  const colors = pick(COLOR_SETS);
  const c = colors.length, k = ri(3, 5);
  const ans = c * (k - 1) + 1;
  return {
    q: `상자에 ${colors.join('·')} 구슬이 잔뜩 들어 있습니다. 보지 않고 꺼낼 때, 같은 색 구슬 ${k}개를 확신하려면 최소 몇 개를 꺼내야 할까요?`,
    ans, trap: k + 1, unit: '개',
    why: `최악의 경우: 색마다 ${k - 1}개씩, 총 ${c}×${k - 1} = ${c * (k - 1)}개를 꺼내고도 아직 ${k}개가 된 색이 없습니다. 그다음 한 개는 어느 색이든 ${k}개째가 됩니다. 그래서 ${ans}개.`,
  };
}

// 비둘기집 변형 — 특정 색을 보장
function genPigeonSpecific() {
  const r = ri(4, 9), b = ri(5, 12);
  const ans = b + 2;
  return {
    q: `서랍에 빨간 양말 ${r}짝과 파란 양말 ${b}짝이 섞여 있습니다. 보지 않고 꺼낼 때, "빨간" 양말 두 짝을 확신하려면 최소 몇 짝을 꺼내야 할까요?`,
    ans, trap: 3, unit: '짝',
    why: `"같은 색 아무거나"가 아니라 "꼭 빨간색"입니다. 재수 없으면 파란 ${b}짝을 전부 먼저 꺼낼 수 있습니다. 그 뒤 두 짝이 반드시 빨강이므로 ${b} + 2 = ${ans}짝. 색만 맞추면 되는 문제(답 3짝)와 다른 점이 여기 있습니다.`,
  };
}

// 방망이와 공 — 합과 차 (조사 오류를 피하려고 문구를 통째로 들고 있다)
const PRICE_PAIRS = [
  { sum: '방망이와 공을 합치면', more: '방망이는 공보다', ask: '공은', a: '방망이', b: '공' },
  { sum: '커피와 쿠키를 합치면', more: '커피는 쿠키보다', ask: '쿠키는', a: '커피', b: '쿠키' },
  { sum: '가방과 필통을 합치면', more: '가방은 필통보다', ask: '필통은', a: '가방', b: '필통' },
];
function genBatBall() {
  const p = pick(PRICE_PAIRS);
  const D = pick([1000, 2000, 5000]);
  const x = ri(1, 9) * 50;
  const S = D + 2 * x;
  return {
    q: `${p.sum} ${S.toLocaleString()}원입니다. ${p.more} ${D.toLocaleString()}원 더 비쌉니다. ${p.ask} 얼마일까요?`,
    ans: x, trap: S - D, unit: '원',
    why: `${p.b}가 ${S - D}원이면 ${p.a}는 ${(S - D + D).toLocaleString()}원이라 합이 ${(2 * (S - D) + D).toLocaleString()}원이 되어 어긋납니다. ${p.b}를 x원이라 하면 ${p.a}는 x+${D.toLocaleString()}원, 합은 2x+${D.toLocaleString()}원. 2x = ${2 * x}이므로 x = ${x}원.`,
  };
}

// 수련 연못 — 거꾸로 세기
function genLily() {
  const n = ri(20, 48);
  const half = Math.random() < 0.6;
  return {
    q: `연못의 수련이 매일 2배로 넓어집니다. ${n}일째에 연못을 전부 덮었다면, ${half ? '절반' : '4분의 1'}을 덮은 날은 며칠째일까요?`,
    ans: half ? n - 1 : n - 2, trap: Math.round(n / (half ? 2 : 4)), unit: '일째',
    why: `앞에서부터 세면 함정에 빠집니다. 거꾸로 보세요 — 매일 2배가 된다는 건 "하루 전에는 절반이었다"는 뜻입니다. ${n}일째 가득 → ${n - 1}일째 절반${half ? '' : ` → ${n - 2}일째 4분의 1`}. 성장은 마지막에 몰아칩니다.`,
  };
}

// 기계와 부품 — 비율의 착시
function genMachine() {
  const m = pick([3, 4, 5, 6]);
  const N = pick([50, 100, 200]);
  return {
    q: `기계 ${m}대가 ${m}분 동안 부품 ${m}개를 만듭니다. 기계 ${N}대가 부품 ${N}개를 만드는 데는 몇 분이 걸릴까요?`,
    ans: m, trap: N, unit: '분',
    why: `기계 1대의 속도를 보세요. ${m}대가 ${m}분에 ${m}개를 만드니, 1대는 ${m}분에 1개를 만듭니다. 기계가 ${N}대면 ${m}분 동안 정확히 ${N}개가 나옵니다. 대수와 개수가 같이 늘면 시간은 그대로입니다.`,
  };
}

// 가로수 — 울타리 기둥 (직선·원형)
function genFence() {
  const g = pick([4, 5, 6, 8, 10]);
  const n = ri(5, 12);
  const L = g * n;
  const circular = Math.random() < 0.4;
  return {
    q: circular
      ? `둘레가 ${L}m인 원형 연못을 따라 ${g}m 간격으로 나무를 심습니다. 나무는 몇 그루 필요할까요?`
      : `길이 ${L}m인 길의 처음부터 끝까지 ${g}m 간격으로 나무를 심습니다. 나무는 몇 그루 필요할까요?`,
    ans: circular ? n : n + 1, trap: circular ? n + 1 : n, unit: '그루',
    why: circular
      ? `${L} ÷ ${g} = ${n}개의 간격이 생깁니다. 원에서는 끝이 처음과 이어져 있어서 나무 수 = 간격 수, ${n}그루면 됩니다. 직선이었다면 ${n + 1}그루가 필요했을 겁니다.`
      : `${L} ÷ ${g} = ${n}은 나무 사이 "간격"의 수입니다. 맨 처음 자리에도 나무가 서야 하니 간격보다 하나 많은 ${n + 1}그루가 필요합니다. 손가락 5개 사이 틈이 4개인 것과 같은 이치입니다.`,
  };
}

// 통나무 자르기 — 마지막 한 번이 두 토막을 만든다
function genLog() {
  const n = ri(4, 9);
  const t = pick([2, 3, 4, 5]);
  return {
    q: `통나무를 한 번 자르는 데 ${t}분이 걸립니다. 통나무 하나를 ${n}토막으로 만들려면 몇 분이 걸릴까요?`,
    ans: (n - 1) * t, trap: n * t, unit: '분',
    why: `${n}토막을 만드는 데 필요한 칼질은 ${n}번이 아니라 ${n - 1}번입니다 — 마지막 칼질 한 번이 두 토막을 만들기 때문입니다. ${n - 1} × ${t}분 = ${(n - 1) * t}분.`,
  };
}

// 시계 종 — 간격을 세는가, 소리를 세는가
function genClock() {
  const i = pick([2, 3, 4]);
  const k = ri(4, 7);
  const j = ri(k + 3, 12);
  return {
    q: `괘종시계가 ${k}시에 종을 ${k}번 치는 데 ${i * (k - 1)}초가 걸립니다. ${j}시에 ${j}번 치는 데는 몇 초가 걸릴까요?`,
    ans: i * (j - 1), trap: Math.round(i * (k - 1) / k * j), unit: '초',
    why: `시간이 걸리는 건 종소리가 아니라 종소리 "사이"입니다. ${k}번 치면 간격은 ${k - 1}개 → 간격 하나가 ${i}초. ${j}번 치면 간격이 ${j - 1}개이므로 ${i} × ${j - 1} = ${i * (j - 1)}초. 소리 개수로 비례식을 세우면 틀립니다.`,
  };
}

// 토너먼트 — 경기 하나가 팀 하나를 떨어뜨린다
function genTournament() {
  const n = ri(20, 90);
  return {
    q: `${n}개 팀이 토너먼트(지면 탈락)로 우승팀을 가립니다. 부전승 유무와 상관없이, 우승팀이 나올 때까지 총 몇 경기가 필요할까요?`,
    ans: n - 1, trap: Math.round(n / 2), unit: '경기',
    why: `대진표를 그릴 필요가 없습니다. 경기 하나가 끝날 때마다 정확히 한 팀이 탈락합니다. 우승팀 하나만 남으려면 ${n - 1}팀이 탈락해야 하므로 경기도 정확히 ${n - 1}번입니다.`,
  };
}

// 악수 — 두 번 센 것을 반으로
function genHandshake() {
  const n = ri(6, 15);
  return {
    q: `모임에 온 ${n}명이 서로 빠짐없이 한 번씩 악수를 나눕니다. 악수는 모두 몇 번 일어날까요?`,
    ans: n * (n - 1) / 2, trap: n * (n - 1), unit: '번',
    why: `한 사람이 ${n - 1}번씩 하니 ${n} × ${n - 1} = ${n * (n - 1)}번처럼 보이지만, 그 계산은 모든 악수를 두 사람 입장에서 두 번씩 센 것입니다. 절반으로 나눠 ${n * (n - 1) / 2}번.`,
  };
}

// 달팽이 우물 — 마지막 날은 미끄러지지 않는다
function genSnail() {
  const a = ri(3, 6);
  const b = ri(1, a - 1);
  const k = ri(3, 8);
  const d = a + (a - b) * k;
  return {
    q: `깊이 ${d}m 우물 바닥의 달팽이가 낮에 ${a}m 오르고 밤에 ${b}m 미끄러집니다. 며칠째 낮에 우물을 빠져나올까요?`,
    ans: k + 1, trap: Math.ceil(d / (a - b)), unit: '일째',
    why: `하루 순이익 ${a - b}m로 나누면 ${Math.ceil(d / (a - b))}일이 나오지만, 그건 마지막 날에도 미끄러진다고 계산한 것입니다. 꼭대기에 닿는 순간 빠져나오므로 마지막 ${a}m는 하루 만에 끝납니다. ${d} − ${a} = ${d - a}m를 하루 ${a - b}m씩 ${k}일 오르고, 다음 날 나갑니다 → ${k + 1}일째.`,
  };
}

// 평균 속도 — 조화평균 (정수가 되는 쌍만 쓴다)
const SPEED_PAIRS = [[30, 60, 40], [20, 60, 30], [40, 60, 48], [20, 30, 24], [30, 70, 42], [24, 40, 30], [60, 20, 30]];
function genSpeed() {
  const [a, b, h] = pick(SPEED_PAIRS);
  return {
    q: `같은 길을 갈 때는 시속 ${a}km, 올 때는 시속 ${b}km로 왕복했습니다. 왕복 전체의 평균 속도는 시속 몇 km일까요?`,
    ans: h, trap: (a + b) / 2, unit: 'km',
    why: `거리는 같아도 걸린 시간이 다릅니다. 느린 시속 ${Math.min(a, b)}km 구간에서 더 오래 달렸기 때문에 평균은 단순 평균 ${(a + b) / 2}보다 느린 쪽으로 끌립니다. 평균 속도 = 전체 거리 ÷ 전체 시간 = 2×${a}×${b} ÷ (${a}+${b}) = ${h}km/h.`,
  };
}

// 저울 — 한 번 달면 셋으로 갈린다
function genScale() {
  const ans = pick([2, 3, 4]);
  const lo = Math.pow(3, ans - 1) + 1;
  const n = ri(lo, Math.pow(3, ans));
  return {
    q: `똑같이 생긴 동전 ${n}개 중 하나만 조금 가볍습니다. 양팔저울로 반드시 찾아내려면 최소 몇 번 달아야 할까요?`,
    ans, trap: Math.ceil(Math.log2(n)), unit: '번',
    why: `반씩 나눠 달면 ${Math.ceil(Math.log2(n))}번쯤 걸리지만 그건 저울을 절반만 쓰는 겁니다. 한 번 달면 결과가 세 가지입니다 — 왼쪽이 가볍다·오른쪽이 가볍다·평형(안 단 무더기에 있다). 세 무더기로 나누면 한 번에 후보가 3분의 1로 줄어, 3^${ans} = ${Math.pow(3, ans)} ≥ ${n}이니 ${ans}번이면 충분합니다.`,
  };
}

// [가족, 필요 레벨]. 레벨 = (레이팅-1000)/200
const FAMILIES = [
  ['pigeon', 0, genPigeon],
  ['batball', 0, genBatBall],
  ['lily', 0, genLily],
  ['machine', 0, genMachine],
  ['fence', 0, genFence],
  ['log', 0, genLog],
  ['tournament', 0, genTournament],
  ['clock', 1, genClock],
  ['snail', 1, genSnail],
  ['handshake', 1, genHandshake],
  ['speed', 2, genSpeed],
  ['scale', 2, genScale],
  ['pigeon2', 2, genPigeonK],
  ['pigeon3', 3, genPigeonSpecific],
];

// 보기 4개: 정답 + 함정 + 그럴듯한 채움 2개
function choicesFor(p) {
  const out = [p.ans, p.trap];
  const d = Math.max(1, Math.round(p.ans * 0.3));
  for (const c of [p.ans + d, p.ans - d, p.trap + d, p.ans + 1, p.ans - 1, p.ans + d + 1]) {
    if (c > 0 && !out.includes(c)) out.push(c);
    if (out.length === 4) break;
  }
  return shuffle(out);
}

export const trapGame = {
  id: 'trap',
  name: '함정 퀴즈',
  icon: '🪤',
  desc: '한 번 더 생각해야 풀리는 문제',
  run(ctx) {
    const L = Math.max(0, (ctx.rating - 1000) / 200);
    const pool = FAMILIES.filter(([, lvl]) => L >= lvl);

    let round = 0, correct = 0, trapped = 0;
    let cur = null, locked = false;
    const used = new Set();   // 한 판에 같은 가족은 한 번만
    const elapsed = ctx.stopwatch();

    ctx.body.innerHTML = `
      <div class="score-line" id="tq-round"></div>
      <div class="tq-q" id="tq-q"></div>
      <div class="choices" id="tq-choices"></div>
      <div class="tq-why hidden" id="tq-why"></div>
      <button class="btn-primary tq-next hidden" id="tq-next"></button>
    `;
    const $round = ctx.body.querySelector('#tq-round');
    const $q = ctx.body.querySelector('#tq-q');
    const $c = ctx.body.querySelector('#tq-choices');
    const $why = ctx.body.querySelector('#tq-why');
    const $next = ctx.body.querySelector('#tq-next');

    function next() {
      round++;
      if (round > ROUNDS) return end();
      // 이번 판에 안 나온 가족 중에서 뽑는다
      const cands = pool.filter(([fam]) => !used.has(fam));
      const [fam, , gen] = pick(cands.length ? cands : pool);
      used.add(fam);
      cur = gen();
      locked = false;
      $round.innerHTML = `${round} / ${ROUNDS}문제 · 정답 <b>${correct}</b>`;
      $q.textContent = cur.q;
      $why.classList.add('hidden');
      $next.classList.add('hidden');
      $c.innerHTML = '';
      for (const v of choicesFor(cur)) {
        const b = document.createElement('button');
        b.className = 'choice';
        b.textContent = `${v.toLocaleString()}${cur.unit}`;
        b.dataset.v = v;
        b.addEventListener('pointerdown', e => { e.preventDefault(); answer(b, v); }, { once: true });
        $c.appendChild(b);
      }
    }

    function answer(btn, v) {
      if (locked) return;
      locked = true;
      const ok = v === cur.ans;
      if (ok) { correct++; sfx.good(); btn.classList.add('correct'); }
      else {
        sfx.bad();
        btn.classList.add('wrong');
        for (const c of $c.children) if (Number(c.dataset.v) === cur.ans) c.classList.add('correct');
        if (v === cur.trap) trapped++;
      }
      // 맞았든 틀렸든 "왜"를 이 문제의 숫자로 풀어서 보여준다
      $why.innerHTML = `
        <div class="tq-verdict ${ok ? 'good' : 'bad'}">${ok ? '정답' : (v === cur.trap ? '직관의 함정에 걸렸습니다' : '오답')} — 정답 ${cur.ans.toLocaleString()}${cur.unit}</div>
        <div class="tq-text">${cur.why}</div>`;
      $why.classList.remove('hidden');
      $round.innerHTML = `${round} / ${ROUNDS}문제 · 정답 <b>${correct}</b>`;
      $next.textContent = round >= ROUNDS ? '결과 보기' : '다음 문제';
      $next.classList.remove('hidden');
    }

    $next.addEventListener('click', next);

    function end() {
      const sec = elapsed();
      const perfect = correct === ROUNDS;
      ctx.finish({
        score: correct,
        perf: correct / EXPECTED,
        detail: `${correct}/${ROUNDS} 정답${trapped ? ` · 함정에 ${trapped}번 걸림` : ' · 함정에 안 걸림'}`,
        // 5문제 전부 맞힌 판만 시간 기록 — 찍어서 빨리 끝낸 판은 기록이 아니다
        time: perfect ? { key: 'time_perfect', value: sec, unit: 'sec', label: '5문제 전원 정답' } : null,
      });
    }

    next();
  },
};
