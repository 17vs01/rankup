// 함정 퀴즈 — 한 번 더 생각해야 풀리는 문제
//
// 이 종목의 가장 큰 위험은 "1회용"이 되는 것이다. 통찰은 한 번 깨달으면 끝이라,
// 숫자만 바꾸면 두 번째부터는 1초 만에 풀린다. 두 가지로 막는다.
//
// ① 같은 가족 안에서 지문이 공식을 바꾼다.
//    가로수는 직선이냐 원형이냐 양편이냐에 따라 답이 n+1 / n / 2n+2로 갈린다.
//    "가로수 문제네" 하고 반사적으로 답하면 틀린다 — 매번 읽어야 한다.
// ② 함정이 없는 문제를 섞는다 (plain).
//    전부 함정이면 "직관과 다른 쪽"만 찍으면 되는 메타 공략이 생긴다.
//    시간이 같은 평균 속도는 산술평균이 정답이고, 선물 교환은 두 배가 정답이다.
//    이때는 과하게 생각한 사람이 걸리도록 trap을 반대로 놓는다.
import { sfx } from '../audio.js';

const ROUNDS = 5;
const EXPECTED = 3.3;

const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = arr => arr[ri(0, arr.length - 1)];

// 받침에 따라 조사를 고른다 (공이 / 쿠키가, 가방은 / 커피는, 필통을 / 쿠키를)
function batchim(w) {
  const c = w.charCodeAt(w.length - 1) - 0xAC00;
  return c >= 0 && c <= 11171 && c % 28 !== 0;
}
const ga = w => w + (batchim(w) ? '이' : '가');
const neun = w => w + (batchim(w) ? '은' : '는');
const reul = w => w + (batchim(w) ? '을' : '를');
const shuffle = a => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = ri(0, i); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};

// ---------- 문제 가족 ----------
// 각 생성기는 { q, ans, trap, alts, unit, why, plain? } 반환.
// trap = 가장 많이 걸리는 오답. plain이면 "과하게 생각한" 답이 여기 온다.
// alts = 그다음으로 그럴듯한 오답들. 보기 넷은 여기서 채운다.
//
// alts를 아무 숫자로 채우면 함정이 작동하지 않는다. 양말 문제에서 "전체 40짝이
// 낚시"라고 해설하려면 보기에 40이 있어야 한다 — 없으면 낚일 기회가 없다.

const COLOR_SETS = [['흰색', '검은색'], ['흰색', '검은색', '회색'], ['빨간색', '파란색', '노란색', '초록색']];

// ===== 비둘기집 =====
// 변형 4가지: 같은 색 두 짝 / 같은 색 K개 / 특정 색 보장 / 거꾸로 묻기
function genPigeon() {
  const v = pick(['two', 'k', 'specific', 'reverse']);
  const colors = pick(COLOR_SETS);
  const c = colors.length;

  if (v === 'two') {
    const T = ri(4, 9) * c * 2;
    return {
      q: `서랍에 ${colors.join('·')} 양말 ${T}짝이 뒤섞여 있습니다. 보지 않고 한 짝씩 꺼낼 때, 같은 색 두 짝을 확신하려면 최소 몇 짝을 꺼내야 할까요?`,
      ans: c + 1, trap: T / 2 + 1, alts: [T, 2, T / 2], unit: '짝',
      why: `최악의 경우를 생각하세요. 색이 ${c}가지니 ${c}짝이 전부 다른 색일 수 있습니다. 하지만 ${c + 1}짝째는 어떤 색이든 이미 나온 색과 겹칠 수밖에 없습니다. 전체 ${T}짝이라는 숫자는 답과 무관한 낚시입니다.`,
    };
  }
  if (v === 'k') {
    const k = ri(3, 5);
    const ans = c * (k - 1) + 1;
    return {
      q: `상자에 ${colors.join('·')} 구슬이 잔뜩 들어 있습니다. 보지 않고 꺼낼 때, 같은 색 구슬 ${k}개를 확신하려면 최소 몇 개를 꺼내야 할까요?`,
      ans, trap: c * k, alts: [k, k + 1, ans + c], unit: '개',
      why: `최악의 경우: 색마다 ${k - 1}개씩, 총 ${c}×${k - 1} = ${c * (k - 1)}개를 꺼내고도 아직 ${k}개가 된 색이 없습니다. 그다음 한 개는 어느 색이든 ${k}개째가 됩니다. 그래서 ${ans}개.`,
    };
  }
  if (v === 'specific') {
    const r = ri(4, 9), b = ri(5, 12);
    return {
      q: `서랍에 빨간 양말 ${r}짝과 파란 양말 ${b}짝이 섞여 있습니다. 보지 않고 꺼낼 때, "빨간" 양말 두 짝을 확신하려면 최소 몇 짝을 꺼내야 할까요?`,
      ans: b + 2, trap: 3, alts: [r + 2, r + b, b], unit: '짝',
      why: `"같은 색 아무거나"가 아니라 "꼭 빨간색"입니다. 재수 없으면 파란 ${b}짝을 전부 먼저 꺼낼 수 있습니다. 그 뒤 두 짝이 반드시 빨강이므로 ${b} + 2 = ${b + 2}짝. 색만 맞추면 되는 문제(답 3짝)와 다른 점이 여기 있습니다.`,
    };
  }
  // 거꾸로 묻기 — 답을 주고 조건을 묻는다
  const n = ri(4, 8);
  return {
    q: `어떤 서랍에서 양말을 ${n}짝만 꺼내면 같은 색 두 짝이 반드시 나온다고 합니다. 이 서랍에 든 양말 색은 최대 몇 가지일까요?`,
    ans: n - 1, trap: n, alts: [n + 1, n - 2, 2], unit: '가지',
    why: `색이 ${n - 1}가지라면 최악의 경우 ${n - 1}짝이 다 다른 색이고 ${n}짝째에 반드시 겹칩니다. 색이 ${n}가지면 ${n}짝을 꺼내고도 전부 다를 수 있어 보장되지 않습니다. 그래서 최대 ${n - 1}가지입니다.`,
  };
}

// ===== 합과 차 (방망이와 공) =====
const PRICE_PAIRS = [
  { sum: '방망이와 공을 합치면', more: '방망이는 공보다', ask: '공은', a: '방망이', b: '공' },
  { sum: '커피와 쿠키를 합치면', more: '커피는 쿠키보다', ask: '쿠키는', a: '커피', b: '쿠키' },
  { sum: '가방과 필통을 합치면', more: '가방은 필통보다', ask: '필통은', a: '가방', b: '필통' },
];
function genBatBall() {
  const p = pick(PRICE_PAIRS);
  // 변형: "얼마 더 비싸다"(차) / "몇 배 비싸다"(비율) — 공식이 완전히 다르다
  if (Math.random() < 0.35) {
    const k = ri(3, 6);
    const x = ri(2, 12) * 100;
    const S = x * (k + 1);
    return {
      q: `${p.sum} ${S.toLocaleString()}원입니다. ${p.more} ${k}배 비쌉니다. ${p.ask} 얼마일까요?`,
      ans: x, trap: Math.round(S / k), alts: [S / 2, x * k, S - x * k], unit: '원',
      why: `"${k}배 비싸다"는 ${p.a} = ${p.b} × ${k}이라는 뜻입니다. ${reul(p.b)} x라 하면 합은 x + ${k}x = ${k + 1}x = ${S.toLocaleString()}원. x = ${x.toLocaleString()}원입니다. ${k}로 나누면(${Math.round(S / k).toLocaleString()}원) 몫이 ${k + 1}이어야 할 자리에 ${k}를 쓴 셈이라 틀립니다.`,
    };
  }
  const D = pick([1000, 2000, 5000]);
  const x = ri(1, 9) * 50;
  const S = D + 2 * x;
  return {
    q: `${p.sum} ${S.toLocaleString()}원입니다. ${p.more} ${D.toLocaleString()}원 더 비쌉니다. ${p.ask} 얼마일까요?`,
    ans: x, trap: S - D, alts: [S / 2, D, x * 2], unit: '원',
    why: `${ga(p.b)} ${(S - D).toLocaleString()}원이면 ${neun(p.a)} ${(S - D + D).toLocaleString()}원이라 합이 ${(2 * (S - D) + D).toLocaleString()}원이 되어 어긋납니다. ${reul(p.b)} x원이라 하면 ${neun(p.a)} x+${D.toLocaleString()}원, 합은 2x+${D.toLocaleString()}원. 2x = ${2 * x}이므로 x = ${x}원.`,
  };
}

// ===== 배로 자라는 것 =====
function genLily() {
  const r = Math.random() < 0.3 ? 3 : 2;
  const n = ri(20, 48);
  // 변형: 절반은 며칠째? / 9분의 1은? / 거꾸로 묻기
  if (Math.random() < 0.25) {
    const k = ri(2, 4);
    return {
      q: `연못의 수련이 매일 ${r}배로 넓어집니다. ${n}일째에 연못을 전부 덮었습니다. ${n - k}일째에는 연못의 몇 분의 1을 덮고 있었을까요? (분모를 답하세요)`,
      ans: Math.pow(r, k), trap: k * r, alts: [Math.pow(r, k) * r, k, n - k], unit: '분의 1',
      why: `하루 전은 ${r}분의 1, 이틀 전은 ${r}×${r} = ${r * r}분의 1… ${k}일 전이면 ${r}의 ${k}제곱인 ${Math.pow(r, k)}분의 1입니다. 곱하기를 더하기로 착각하면 ${k * r}이 나옵니다.`,
    };
  }
  const half = Math.random() < 0.6;
  const part = half ? r : r * r;
  const days = half ? 1 : 2;
  return {
    q: `연못의 수련이 매일 ${r}배로 넓어집니다. ${n}일째에 연못을 전부 덮었다면, ${part}분의 1을 덮은 날은 며칠째일까요?`,
    ans: n - days, trap: Math.round(n / part),
    alts: [n, Math.round(n / part) + 1, n - days - 1], unit: '일째',
    why: `앞에서부터 세면 함정에 빠집니다. 거꾸로 보세요 — 매일 ${r}배가 된다는 건 "하루 전에는 ${r}분의 1이었다"는 뜻입니다. ${n}일째 가득 → ${n - 1}일째 ${r}분의 1${days === 2 ? ` → ${n - 2}일째 ${r * r}분의 1` : ''}. 성장은 마지막에 몰아칩니다.`,
  };
}

// ===== 기계와 부품 =====
function genMachine() {
  const m = pick([3, 4, 5, 6]);
  // 변형: 같은 비율(답 = m) / 다른 비율(계산 필요) — 반사적으로 m을 찍으면 틀린다
  if (Math.random() < 0.4) {
    const p = pick([2, 3, 4]);
    const q = m * p * ri(1, 3);
    const ans = q * m / (m * p);
    return {
      q: `기계 ${m}대가 ${m}분 동안 부품 ${m}개를 만듭니다. 기계 ${m * p}대가 부품 ${q}개를 만드는 데는 몇 분이 걸릴까요?`,
      ans, trap: m, alts: [q, q / p, m * p], unit: '분',
      why: `1대는 ${m}분에 1개를 만듭니다. ${m * p}대면 ${m}분에 ${m * p}개, 즉 1분에 ${m * p / m}개입니다. ${q}개를 만들려면 ${q} ÷ ${m * p / m} = ${ans}분. 이번엔 대수와 개수의 비율이 달라서 "그대로 ${m}분"이 아닙니다.`,
    };
  }
  const N = pick([50, 100, 200]);
  return {
    q: `기계 ${m}대가 ${m}분 동안 부품 ${m}개를 만듭니다. 기계 ${N}대가 부품 ${N}개를 만드는 데는 몇 분이 걸릴까요?`,
    ans: m, trap: N, alts: [N / m, N * m, N / 2], unit: '분',
    why: `기계 1대의 속도를 보세요. ${m}대가 ${m}분에 ${m}개를 만드니, 1대는 ${m}분에 1개를 만듭니다. 기계가 ${N}대면 ${m}분 동안 정확히 ${N}개가 나옵니다. 대수와 개수가 같이 늘면 시간은 그대로입니다.`,
  };
}

// ===== 울타리 기둥 =====
// 변형 4가지: 직선 / 원형 / 길 양편 / 양 끝 제외 — 답이 전부 다르다
function genFence() {
  const g = pick([4, 5, 6, 8, 10]);
  const n = ri(5, 12);
  const L = g * n;
  const v = pick(['line', 'circle', 'both', 'inner']);
  if (v === 'circle') {
    return {
      q: `둘레가 ${L}m인 원형 연못을 따라 ${g}m 간격으로 나무를 심습니다. 나무는 몇 그루 필요할까요?`,
      ans: n, trap: n + 1, alts: [n - 1, L / 2, n * 2], unit: '그루',
      why: `${L} ÷ ${g} = ${n}개의 간격이 생깁니다. 원에서는 끝이 처음과 이어져 있어서 나무 수 = 간격 수, ${n}그루면 됩니다. 직선이었다면 ${n + 1}그루가 필요했을 겁니다.`,
    };
  }
  if (v === 'both') {
    return {
      q: `길이 ${L}m인 곧은 길의 <b>양쪽 편</b>에 처음부터 끝까지 ${g}m 간격으로 나무를 심습니다. 나무는 모두 몇 그루 필요할까요?`,
      ans: 2 * (n + 1), trap: n + 1, alts: [2 * n, n, L / g * 2 + 1], unit: '그루',
      why: `한쪽 편만 보면 간격 ${n}개에 나무는 ${n + 1}그루입니다. 길 양편에 심으므로 두 배인 ${2 * (n + 1)}그루. 간격 수(${n})만 두 배 하면 양 끝을 빠뜨립니다.`,
    };
  }
  if (v === 'inner') {
    return {
      q: `길이 ${L}m인 곧은 길에 ${g}m 간격으로 나무를 심되, <b>길 양 끝에는 심지 않습니다</b>. 나무는 몇 그루 필요할까요?`,
      ans: n - 1, trap: n + 1, alts: [n, n - 2, L / g], unit: '그루',
      why: `간격은 ${n}개이고 그 사이의 "경계"는 ${n + 1}곳입니다. 양 끝 두 곳을 빼면 ${n + 1} − 2 = ${n - 1}그루. 조건을 안 읽고 기본형(${n + 1}그루)으로 답하면 틀립니다.`,
    };
  }
  return {
    q: `길이 ${L}m인 길의 처음부터 끝까지 ${g}m 간격으로 나무를 심습니다. 나무는 몇 그루 필요할까요?`,
    ans: n + 1, trap: n, alts: [n + 2, n - 1, L / 2], unit: '그루',
    why: `${L} ÷ ${g} = ${n}은 나무 사이 "간격"의 수입니다. 맨 처음 자리에도 나무가 서야 하니 간격보다 하나 많은 ${n + 1}그루가 필요합니다. 손가락 5개 사이 틈이 4개인 것과 같은 이치입니다.`,
  };
}

// ===== 통나무 자르기 =====
function genLog() {
  const n = ri(4, 9);
  const t = pick([2, 3, 4, 5]);
  // 변형: 통나무 여러 개 / 거꾸로 묻기 / 기본
  const v = pick(['basic', 'many', 'reverse']);
  if (v === 'many') {
    const m = ri(2, 4);
    return {
      q: `통나무를 한 번 자르는 데 ${t}분이 걸립니다. 통나무 ${m}개를 각각 ${n}토막으로 만들려면 몇 분이 걸릴까요?`,
      ans: m * (n - 1) * t, trap: m * n * t, alts: [(n - 1) * t, (m * n - 1) * t, m * n], unit: '분',
      why: `통나무 하나당 칼질은 ${n - 1}번입니다(마지막 칼질이 두 토막을 만드니까). ${m}개면 ${m} × ${n - 1} = ${m * (n - 1)}번, 시간은 ${m * (n - 1)} × ${t} = ${m * (n - 1) * t}분. 통나무는 이어져 있지 않으므로 ${m * n - 1}번이 아닙니다.`,
    };
  }
  if (v === 'reverse') {
    const T = (n - 1) * t;
    return {
      q: `통나무를 한 번 자르는 데 ${t}분이 걸립니다. ${T}분 동안 잘랐다면 통나무는 몇 토막이 되었을까요?`,
      ans: n, trap: n - 1, alts: [n + 1, T / t + 1, T], unit: '토막',
      why: `${T} ÷ ${t} = ${n - 1}번 잘랐습니다. 칼질 ${n - 1}번은 ${n}토막을 만듭니다 — 마지막 칼질 하나가 토막 하나를 더 만들기 때문입니다.`,
    };
  }
  return {
    q: `통나무를 한 번 자르는 데 ${t}분이 걸립니다. 통나무 하나를 ${n}토막으로 만들려면 몇 분이 걸릴까요?`,
    ans: (n - 1) * t, trap: n * t, alts: [(n + 1) * t, (n - 2) * t, n], unit: '분',
    why: `${n}토막을 만드는 데 필요한 칼질은 ${n}번이 아니라 ${n - 1}번입니다 — 마지막 칼질 한 번이 두 토막을 만들기 때문입니다. ${n - 1} × ${t}분 = ${(n - 1) * t}분.`,
  };
}

// ===== 시계 종 =====
function genClock() {
  const i = pick([2, 3, 4]);
  const k = ri(4, 7);
  const j = ri(k + 3, 12);
  // 변형: 거꾸로 묻기 / 기본
  if (Math.random() < 0.3) {
    const T = i * (j - 1);
    return {
      q: `괘종시계가 ${k}시에 종을 ${k}번 치는 데 ${i * (k - 1)}초가 걸립니다. 어느 날 종을 치는 데 ${T}초가 걸렸다면 몇 시였을까요?`,
      ans: j, trap: Math.round(T / (i * (k - 1)) * k), alts: [j - 1, j + 1, T / i], unit: '시',
      why: `간격 하나가 ${i}초입니다. ${T}초면 간격이 ${T} ÷ ${i} = ${j - 1}개, 종소리는 간격보다 하나 많은 ${j}번이므로 ${j}시입니다. 초를 시간에 그대로 비례시키면 틀립니다.`,
    };
  }
  return {
    q: `괘종시계가 ${k}시에 종을 ${k}번 치는 데 ${i * (k - 1)}초가 걸립니다. ${j}시에 ${j}번 치는 데는 몇 초가 걸릴까요?`,
    ans: i * (j - 1), trap: Math.round(i * (k - 1) / k * j),
    alts: [i * j, i * (k - 1) * 2, i * (j - 1) + i], unit: '초',
    why: `시간이 걸리는 건 종소리가 아니라 종소리 "사이"입니다. ${k}번 치면 간격은 ${k - 1}개 → 간격 하나가 ${i}초. ${j}번 치면 간격이 ${j - 1}개이므로 ${i} × ${j - 1} = ${i * (j - 1)}초. 소리 개수로 비례식을 세우면 틀립니다.`,
  };
}

// ===== 경기 수 =====
// 변형: 토너먼트(n-1) / 리그전(n(n-1)/2) — 지문을 안 읽으면 반드시 틀린다
function genTournament() {
  if (Math.random() < 0.4) {
    const n = ri(6, 14);
    const ans = n * (n - 1) / 2;
    return {
      q: `${n}개 팀이 <b>리그전</b>(모든 팀이 서로 한 번씩 경기)을 치릅니다. 총 몇 경기가 필요할까요?`,
      ans, trap: n - 1, alts: [n * (n - 1), n, Math.round(n * n / 2)], unit: '경기',
      why: `리그전은 토너먼트가 아닙니다. 한 팀이 ${n - 1}경기씩 치르니 ${n} × ${n - 1} = ${n * (n - 1)}처럼 보이지만, 그건 한 경기를 두 팀 입장에서 두 번 센 것입니다. 절반으로 나눠 ${ans}경기. 토너먼트였다면 ${n - 1}경기입니다.`,
    };
  }
  const n = ri(20, 90);
  return {
    q: `${n}개 팀이 <b>토너먼트</b>(지면 탈락)로 우승팀을 가립니다. 부전승 유무와 상관없이, 우승팀이 나올 때까지 총 몇 경기가 필요할까요?`,
    ans: n - 1, trap: Math.round(n / 2),
    alts: [n, Math.round(n / 2) + Math.round(n / 4), n * 2], unit: '경기',
    why: `대진표를 그릴 필요가 없습니다. 경기 하나가 끝날 때마다 정확히 한 팀이 탈락합니다. 우승팀 하나만 남으려면 ${n - 1}팀이 탈락해야 하므로 경기도 정확히 ${n - 1}번입니다.`,
  };
}

// ===== 짝짓기 =====
// 변형: 악수(방향 없음, /2) / 선물 교환(방향 있음, /2 안 함) ← 후자는 함정이 아니다
function genHandshake() {
  const n = ri(6, 15);
  if (Math.random() < 0.4) {
    return {
      q: `모임에 온 ${n}명이 <b>서로에게 선물을 하나씩</b> 줍니다 (A가 B에게, B가 A에게 각각). 선물은 모두 몇 개일까요?`,
      ans: n * (n - 1), trap: n * (n - 1) / 2, alts: [n * n, n, Math.round(n * n / 2)], unit: '개',
      plain: true,
      why: `이번엔 절반으로 나누면 안 됩니다. 악수는 두 사람이 한 번 하지만, 선물은 A→B와 B→A가 서로 다른 선물입니다. 한 사람이 ${n - 1}개씩 주므로 ${n} × ${n - 1} = ${n * (n - 1)}개. 방향이 있는지부터 확인해야 합니다.`,
    };
  }
  return {
    q: `모임에 온 ${n}명이 서로 빠짐없이 한 번씩 <b>악수</b>를 나눕니다. 악수는 모두 몇 번 일어날까요?`,
    ans: n * (n - 1) / 2, trap: n * (n - 1),
    alts: [Math.round(n * n / 2), n * (n - 1) / 2 + n, n], unit: '번',
    why: `한 사람이 ${n - 1}번씩 하니 ${n} × ${n - 1} = ${n * (n - 1)}번처럼 보이지만, 그 계산은 모든 악수를 두 사람 입장에서 두 번씩 센 것입니다. 절반으로 나눠 ${n * (n - 1) / 2}번.`,
  };
}

// ===== 달팽이 우물 =====
function genSnail() {
  const a = ri(3, 6);
  const b = ri(1, a - 1);
  const k = ri(3, 8);
  const d = a + (a - b) * k;
  // 변형: 마지막 날 예외가 없는 경우(딱 나눠떨어짐)를 섞어 반사 답을 막는다
  if (Math.random() < 0.3) {
    const days = ri(4, 9);
    const d2 = (a - b) * days;
    return {
      q: `깊이 ${d2}m 우물 바닥의 달팽이가 낮에 ${a}m 오르고 밤에 ${b}m 미끄러집니다. 며칠째 <b>밤</b>에 우물 입구 높이에 도달할까요?`,
      ans: days, trap: days + 1, alts: [Math.ceil(d2 / a), days - 1, d2], unit: '일째',
      plain: true,
      why: `이번엔 "낮에 빠져나오는 날"이 아니라 "밤에 도달하는 높이"를 묻습니다. 하루 순이익이 ${a - b}m이므로 ${d2} ÷ ${a - b} = ${days}일째 밤에 정확히 ${d2}m입니다. 마지막 날 예외를 적용하면 오히려 틀립니다.`,
    };
  }
  return {
    q: `깊이 ${d}m 우물 바닥의 달팽이가 낮에 ${a}m 오르고 밤에 ${b}m 미끄러집니다. 며칠째 <b>낮</b>에 우물을 빠져나올까요?`,
    ans: k + 1, trap: Math.ceil(d / (a - b)),
    alts: [k, Math.ceil(d / a), d], unit: '일째',
    why: `하루 순이익 ${a - b}m로 나누면 ${Math.ceil(d / (a - b))}일이 나오지만, 그건 마지막 날에도 미끄러진다고 계산한 것입니다. 꼭대기에 닿는 순간 빠져나오므로 마지막 ${a}m는 하루 만에 끝납니다. ${d} − ${a} = ${d - a}m를 하루 ${a - b}m씩 ${k}일 오르고, 다음 날 나갑니다 → ${k + 1}일째.`,
  };
}

// ===== 평균 속도 =====
// 변형: 거리가 같으면 조화평균 / 시간이 같으면 산술평균 ← 후자는 함정이 아니다
const SPEED_PAIRS = [[30, 60, 40], [20, 60, 30], [40, 60, 48], [20, 30, 24], [30, 70, 42], [24, 40, 30], [60, 20, 30]];
function genSpeed() {
  const [a, b, h] = pick(SPEED_PAIRS);
  if (Math.random() < 0.4) {
    const t = ri(2, 4);
    return {
      q: `${t}시간은 시속 ${a}km로, 이어서 ${t}시간은 시속 ${b}km로 달렸습니다. 전체 평균 속도는 시속 몇 km일까요?`,
      ans: (a + b) / 2, trap: h, alts: [a, b, Math.abs(a - b)], unit: 'km',
      plain: true,
      why: `이번엔 <b>시간</b>이 같습니다. 거리가 같을 때(왕복)는 조화평균 ${h}km/h를 써야 하지만, 시간이 같으면 단순 평균이 맞습니다. 거리는 ${a * t} + ${b * t} = ${(a + b) * t}km, 시간은 ${2 * t}시간 → ${(a + b) / 2}km/h. 조건을 안 읽고 "평균 속도는 조화평균"만 외우면 틀립니다.`,
    };
  }
  return {
    q: `같은 길을 갈 때는 시속 ${a}km, 올 때는 시속 ${b}km로 왕복했습니다. 왕복 전체의 평균 속도는 시속 몇 km일까요?`,
    ans: h, trap: (a + b) / 2, alts: [a, b, Math.round((a + b) / 2) + 5], unit: 'km',
    why: `거리는 같아도 걸린 시간이 다릅니다. 느린 시속 ${Math.min(a, b)}km 구간에서 더 오래 달렸기 때문에 평균은 단순 평균 ${(a + b) / 2}보다 느린 쪽으로 끌립니다. 평균 속도 = 전체 거리 ÷ 전체 시간 = 2×${a}×${b} ÷ (${a}+${b}) = ${h}km/h.`,
  };
}

// ===== 저울 =====
// 변형: 반드시 찾기(3분할) / 운 좋으면 몇 번?(1번) ← 후자는 함정이 아니다
function genScale() {
  const ans = pick([2, 3, 4]);
  const lo = Math.pow(3, ans - 1) + 1;
  const n = ri(lo, Math.pow(3, ans));
  if (Math.random() < 0.25) {
    return {
      q: `똑같이 생긴 동전 ${n}개 중 하나만 조금 가볍습니다. 양팔저울을 <b>운이 아주 좋다면</b> 최소 몇 번 만에 찾을 수 있을까요?`,
      ans: 1, trap: ans, alts: [Math.ceil(Math.log2(n)), n - 1, n, 2], unit: '번',
      plain: true,
      why: `"반드시"가 아니라 "운이 좋다면"입니다. 세 무더기로 나눠 두 무더기를 달았을 때 평형이면 나머지 무더기에 있다는 것만 알지만, 딱 1개씩 올려놓고 한쪽이 기울면 그 자리에서 끝납니다. 그래서 1번. 보장을 묻는 문제(답 ${ans}번)와 다릅니다.`,
    };
  }
  return {
    q: `똑같이 생긴 동전 ${n}개 중 하나만 조금 가볍습니다. 양팔저울로 <b>반드시</b> 찾아내려면 최소 몇 번 달아야 할까요?`,
    ans, trap: Math.ceil(Math.log2(n)),
    alts: [n - 1, Math.ceil(n / 2), ans + 1], unit: '번',
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
];

// 보기 4개 = 정답 + 함정 + 그 가족이 지정한 오답들.
// 정수가 아니거나 정답과 겹치는 후보는 버린다.
function choicesFor(p) {
  const out = [p.ans];
  const add = v => {
    if (out.length >= 4) return;
    const n = Math.round(v);
    if (Number.isFinite(n) && n > 0 && !out.includes(n)) out.push(n);
  };
  add(p.trap);
  for (const c of p.alts || []) add(c);
  // 가족이 준 후보끼리 겹치면 모자랄 수 있다 (답이 1처럼 작을 때).
  // 정답 주변으로 넓혀가며 반드시 4개를 채운다.
  const d = Math.max(1, Math.round(p.ans * 0.3));
  add(p.ans + d); add(p.ans - d); add(p.ans + 2 * d);
  for (let k = 1; out.length < 4 && k <= 60; k++) { add(p.ans + k); add(p.ans - k); }
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
      $q.innerHTML = cur.q;   // 조건을 굵게 강조하는 문제가 있다
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
      // 함정이 없는 문제(plain)에서는 "과하게 생각한" 쪽이 오답이다
      const verdict = ok ? '정답'
        : v === cur.trap ? (cur.plain ? '과하게 생각했습니다' : '직관의 함정에 걸렸습니다')
        : '오답';
      $why.innerHTML = `
        <div class="tq-verdict ${ok ? 'good' : 'bad'}">${verdict} — 정답 ${cur.ans.toLocaleString()}${cur.unit}</div>
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
