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

// ===== 배율과 차원 =====
// 변 2배면 넓이는 4배, 부피는 8배. 차원을 잊으면 그냥 2배라고 답한다.
function genArea() {
  const k = ri(2, 4);
  const v = pick(['square', 'cube', 'circle', 'reverse']);
  if (v === 'cube') {
    return {
      q: `정육면체의 모서리 길이를 ${k}배로 늘리면 <b>부피</b>는 몇 배가 될까요?`,
      ans: k ** 3, trap: k, alts: [k * k, k * 3, k ** 3 + k], unit: '배',
      why: `부피는 가로×세로×높이라 세 방향이 모두 ${k}배가 됩니다. ${k}×${k}×${k} = ${k ** 3}배. 길이가 ${k}배일 때 넓이는 ${k * k}배(2차원), 부피는 ${k ** 3}배(3차원)입니다.`,
    };
  }
  if (v === 'circle') {
    return {
      q: `원의 반지름을 ${k}배로 늘리면 <b>넓이</b>는 몇 배가 될까요?`,
      ans: k * k, trap: k, alts: [k ** 3, k * 2, k * k + 1], unit: '배',
      why: `넓이는 반지름의 제곱에 비례합니다(πr²). 반지름이 ${k}배면 넓이는 ${k}² = ${k * k}배. 지름이 절반인 피자가 4분의 1 크기인 것과 같은 이치입니다.`,
    };
  }
  if (v === 'reverse') {
    return {
      q: `정사각형의 <b>넓이를 ${k * k}배</b>로 만들려면 한 변을 몇 배로 늘려야 할까요?`,
      ans: k, trap: k * k, alts: [k * k / 2, k + 1, k * k * 2].filter(Number.isInteger), unit: '배',
      why: `넓이는 변의 제곱이므로 거꾸로 제곱근을 취합니다. 넓이 ${k * k}배 → 변은 √${k * k} = ${k}배. 변을 ${k * k}배로 늘리면 넓이는 ${k * k * k * k}배가 되어 너무 큽니다.`,
    };
  }
  return {
    q: `정사각형의 한 변을 ${k}배로 늘리면 <b>넓이</b>는 몇 배가 될까요?`,
    ans: k * k, trap: k, alts: [k ** 3, k * 2, k * k + k], unit: '배',
    why: `가로도 ${k}배, 세로도 ${k}배가 되므로 넓이는 ${k}×${k} = ${k * k}배입니다. 길이가 ${k}배라고 넓이도 ${k}배가 되는 게 아닙니다 — 차원이 하나 더 있습니다.`,
  };
}

// ===== 함께 하는 일 =====
// 6시간 걸리는 사람과 3시간 걸리는 사람이 함께 하면 4.5시간이 아니라 2시간이다.
const WORK_PAIRS = [[6, 3, 2], [12, 4, 3], [20, 5, 4], [6, 12, 4], [30, 20, 12],
  [10, 15, 6], [8, 24, 6], [9, 18, 6], [21, 28, 12], [12, 6, 4]];
const WORK_WHO = [
  { a: '수도관 A', b: '수도관 B', what: '물통을 채우는', unit: '시간' },
  { a: '형', b: '동생', what: '방을 청소하는', unit: '분' },
  { a: '기계 A', b: '기계 B', what: '작업을 끝내는', unit: '시간' },
];
function genWork() {
  const [a, b, t] = pick(WORK_PAIRS);
  const w = pick(WORK_WHO);
  return {
    q: `${w.a}는 혼자서 ${a}${w.unit}, ${w.b}는 혼자서 ${b}${w.unit}이면 ${w.what} 일을 끝냅니다. 둘이 <b>함께</b> 하면 몇 ${w.unit}이 걸릴까요?`,
    ans: t, trap: Math.round((a + b) / 2), alts: [Math.min(a, b), a + b, Math.abs(a - b)], unit: w.unit,
    why: `시간을 평균 내면 안 됩니다 — 더해야 하는 건 시간이 아니라 "1${w.unit}당 하는 양"입니다. ${w.a}는 1${w.unit}에 ${a}분의 1, ${w.b}는 ${b}분의 1을 하니 함께라면 ${a}분의 1 + ${b}분의 1 = ${a * b / (a + b) === t ? `${a + b}/${a * b}` : ''}. 전체를 이 속도로 나누면 ${t}${w.unit}입니다. 혼자 빠른 쪽(${Math.min(a, b)}${w.unit})보다 반드시 빨라야 한다는 점도 확인해 보세요.`,
  };
}

// ===== 겹치는 할인 =====
const DISCOUNT_PAIRS = [[20, 20, 36], [30, 20, 44], [50, 20, 60], [10, 10, 19],
  [40, 50, 70], [25, 20, 40], [30, 30, 51], [50, 40, 70], [20, 10, 28]];
function genDiscount() {
  // 변형: 할인 겹치기 / 할인 후 같은 비율 인상(원래로 안 돌아온다)
  if (Math.random() < 0.4) {
    // r²/100이 정수여야 답이 소수가 되지 않는다 (25%는 93.75%가 나온다)
    const r = pick([10, 20, 30, 40, 50]);
    const back = 100 - r * r / 100;
    return {
      q: `어떤 상품을 ${r}% 할인했다가, 나중에 할인된 가격에서 다시 ${r}% <b>인상</b>했습니다. 지금 가격은 원래 가격의 몇 %일까요?`,
      ans: back, trap: 100, alts: [100 - r, 100 + r, back - r], unit: '%',
      plain: true,
      why: `원래 가격을 100이라 하면 ${r}% 할인 후 ${100 - r}, 여기서 ${r}% 인상하면 ${100 - r} × ${(100 + r) / 100} = ${back}입니다. 같은 비율이라도 <b>기준이 달라서</b> 원래로 돌아오지 않습니다 — 할인은 100 기준, 인상은 ${100 - r} 기준이니까요.`,
    };
  }
  const [a, b, ans] = pick(DISCOUNT_PAIRS);
  return {
    q: `정가에서 ${a}% 할인한 뒤, 계산할 때 거기서 다시 ${b}%를 더 할인해 줍니다. 정가 대비 총 몇 % 할인일까요?`,
    ans, trap: a + b, alts: [100 - ans, Math.round((a + b) / 2), a + b - 5], unit: '%',
    why: `${a}% + ${b}% = ${a + b}%가 아닙니다. 두 번째 할인은 <b>이미 깎인 가격</b>에서 적용되기 때문입니다. 정가를 100이라 하면 ${100 - a} → ${100 - a} × ${(100 - b) / 100} = ${100 - ans}. 즉 ${ans}% 할인입니다.`,
  };
}

// ===== 평균 끌어올리기 =====
function genAverage() {
  const n = ri(3, 8);
  const a = ri(6, 9) * 10;
  const up = ri(1, 4);
  const ans = (n + 1) * (a + up) - n * a;
  return {
    q: `지금까지 ${n}과목 시험의 평균이 ${a}점입니다. 한 과목을 더 봐서 <b>전체 평균</b>을 ${a + up}점으로 올리려면 그 과목에서 몇 점을 받아야 할까요?`,
    ans, trap: a + up, alts: [a + up * 2, a, ans + up], unit: '점',
    why: `${a + up}점을 받으면 평균은 ${a + up}점이 아니라 그보다 낮아집니다 — 앞의 ${n}과목이 평균을 끌어내리니까요. 전체 ${n + 1}과목 합계가 ${n + 1} × ${a + up} = ${(n + 1) * (a + up)}점이어야 하는데 지금까지 ${n} × ${a} = ${n * a}점이므로, 차이인 ${ans}점이 필요합니다.`,
  };
}

// ===== 나이 =====
function genAge() {
  const s = ri(6, 14);
  const y = ri(3, 8);
  const m = ri(2, 3);
  const d = (m - 1) * (s + y);
  return {
    q: `아버지는 아들보다 ${d}살 많습니다. ${y}년 뒤에 아버지 나이가 아들 나이의 <b>정확히 ${m}배</b>가 된다면, 지금 아들은 몇 살일까요?`,
    ans: s, trap: s + y, alts: [Math.round(d / m), s + d, d - y], unit: '살',
    why: `"지금" ${m}배라고 풀면 ${d} ÷ ${m - 1} = ${s + y}살이 나오지만, 문제는 <b>${y}년 뒤</b>입니다. ${y}년 뒤 아들을 x라 하면 아버지는 x+${d}, 조건은 x+${d} = ${m}x → ${d} = ${m - 1}x → x = ${s + y}살. 그건 ${y}년 뒤 나이이므로 지금은 ${s + y} − ${y} = ${s}살입니다.`,
  };
}

// ===== 기차가 다리를 건넌다 =====
const TRAIN_SPEEDS = [[36, 10], [54, 15], [72, 20], [90, 25], [108, 30]];
function genTrain() {
  const [kmh, ms] = pick(TRAIN_SPEEDS);
  // 길이를 초속의 배수로 잡으면 답이 항상 정수로 떨어진다
  const len = ms * ri(6, 14);
  const b = ms * ri(8, 25);
  const total = len + b;
  const ans = total / ms;
  return {
    q: `길이 ${len}m인 기차가 시속 ${kmh}km로 달려 길이 ${b}m인 다리를 <b>완전히</b> 건넙니다. 몇 초가 걸릴까요?`,
    ans, trap: b / ms, alts: [len / ms, Math.round((b - len) / ms), ans + len / ms],
    unit: '초',
    why: `기차 <b>끝</b>이 다리를 벗어나야 "완전히" 건넌 것입니다. 그래서 달려야 할 거리는 다리 길이 ${b}m가 아니라 다리 + 기차 = ${b} + ${len} = ${total}m입니다. 시속 ${kmh}km는 초속 ${ms}m이므로 ${total} ÷ ${ms} = ${ans}초. 다리 길이만 쓰면 ${b / ms}초가 나옵니다.`,
  };
}

// ===== 층수와 계단 =====
function genStair() {
  const a = ri(3, 5);
  const b = ri(a + 2, 11);
  const per = ri(2, 8) * 5;
  const t = per * (a - 1);
  return {
    q: `1층에서 ${a}층까지 걸어 올라가는 데 ${t}초가 걸립니다. 같은 속도라면 1층에서 <b>${b}층</b>까지는 몇 초가 걸릴까요?`,
    ans: per * (b - 1), trap: Math.round(t / a * b),
    alts: [per * b, t * 2, Math.round(t * b / a) + per], unit: '초',
    why: `층수가 아니라 <b>층과 층 사이</b>를 세야 합니다. 1층→${a}층은 계단 ${a - 1}구간이라 한 구간에 ${t} ÷ ${a - 1} = ${per}초. 1층→${b}층은 ${b - 1}구간이므로 ${per} × ${b - 1} = ${per * (b - 1)}초입니다. 층수로 비례식(${Math.round(t / a * b)}초)을 세우면 틀립니다.`,
  };
}

// ===== 색칠한 큐브 =====
function genCube() {
  const n = ri(3, 6);
  const v = pick(['none', 'one', 'two']);
  if (v === 'one') {
    return {
      q: `${n}×${n}×${n} 정육면체의 겉면 전체를 칠한 뒤 1×1×1 조각으로 자릅니다. <b>정확히 한 면</b>만 칠해진 조각은 몇 개일까요?`,
      ans: 6 * (n - 2) ** 2, trap: 6 * n * n, alts: [(n - 2) ** 3, 12 * (n - 2), 6 * (n - 2)], unit: '개',
      why: `한 면만 칠해진 조각은 각 면의 <b>테두리를 뺀 안쪽</b>에 있습니다. 한 면에 ${n - 2}×${n - 2} = ${(n - 2) ** 2}개, 면이 6개이므로 ${6 * (n - 2) ** 2}개입니다. 테두리 조각은 두 면 이상 칠해져 있습니다.`,
    };
  }
  if (v === 'two') {
    return {
      q: `${n}×${n}×${n} 정육면체의 겉면 전체를 칠한 뒤 1×1×1 조각으로 자릅니다. <b>정확히 두 면</b>이 칠해진 조각은 몇 개일까요?`,
      ans: 12 * (n - 2), trap: 12, alts: [6 * (n - 2) ** 2, 8, (n - 2) ** 3], unit: '개',
      why: `두 면이 칠해진 조각은 <b>모서리</b>에 있되 꼭짓점은 아닌 것들입니다. 정육면체의 모서리는 12개이고 각 모서리마다 꼭짓점 2개를 뺀 ${n - 2}개가 있으므로 12 × ${n - 2} = ${12 * (n - 2)}개. 꼭짓점 8개는 세 면이 칠해져 있습니다.`,
    };
  }
  return {
    q: `${n}×${n}×${n} 정육면체의 겉면 전체를 칠한 뒤 1×1×1 조각으로 자릅니다. <b>어느 면에도 색이 없는</b> 조각은 몇 개일까요?`,
    ans: (n - 2) ** 3, trap: (n - 1) ** 3, alts: [n ** 3 - 6 * n * n, 1, 12 * (n - 2)].filter(v => v > 0), unit: '개',
    why: `색이 안 묻은 조각은 겉껍질을 <b>여섯 방향 모두</b> 벗겨낸 안쪽 덩어리입니다. 각 방향에서 한 겹씩 빠지므로 한 변이 ${n} − 2 = ${n - 2}, 즉 ${n - 2}³ = ${(n - 2) ** 3}개입니다. 한 겹만 벗기면 ${(n - 1) ** 3}개가 나와 틀립니다.`,
  };
}

// ===== 시계 각도 =====
function genAngle() {
  const h = ri(1, 12);
  const m = pick([10, 20, 30, 40, 50]);
  let a = Math.abs(30 * h - 5.5 * m);
  if (a > 180) a = 360 - a;
  let naive = Math.abs(30 * h - 6 * m);
  if (naive > 180) naive = 360 - naive;
  if (a === naive || !Number.isInteger(a)) return genAngle();
  return {
    q: `${h}시 ${m}분에 시계의 <b>시침과 분침</b>이 이루는 작은 쪽 각도는 몇 도일까요?`,
    ans: a, trap: naive, alts: [Math.abs(a - 15), a + 15, 180 - a].filter(v => v > 0 && v !== a),
    unit: '도',
    why: `분침만 움직인다고 보면 ${naive}도가 나오지만, <b>시침도 같이 움직입니다</b>. 시침은 1분에 0.5도씩 가므로 ${h}시 ${m}분의 시침은 ${(30 * h) % 360}도가 아니라 ${(30 * h + 0.5 * m) % 360}도에 있습니다. 분침은 ${6 * m}도이므로 차이는 ${a}도입니다.`,
  };
}

// ===== 소금물 섞기 =====
const MIX_SETS = [[10, 200, 20, 300, 16], [6, 300, 16, 200, 10], [5, 400, 15, 100, 7],
  [12, 100, 20, 300, 18], [4, 300, 24, 200, 12], [8, 500, 18, 500, 13], [3, 200, 13, 300, 9]];
function genMix() {
  const [c1, g1, c2, g2, ans] = pick(MIX_SETS);
  const avg = (c1 + c2) / 2;
  return {
    q: `${c1}% 소금물 ${g1}g과 ${c2}% 소금물 ${g2}g을 <b>섞으면</b> 몇 %가 될까요?`,
    ans, trap: avg, alts: [c1 + c2, Math.abs(c2 - c1), ans + 2], unit: '%',
    why: `양이 다르므로 농도를 단순 평균(${avg}%) 내면 안 됩니다. 소금의 양을 세세요 — ${g1 * c1 / 100}g + ${g2 * c2 / 100}g = ${g1 * c1 / 100 + g2 * c2 / 100}g이고 전체는 ${g1 + g2}g이므로 ${ans}%입니다. 양이 많은 ${g1 > g2 ? `${c1}%` : `${c2}%`} 쪽으로 끌립니다.`,
  };
}

// ===== 역비율 =====
const RATIO_SETS = [[25, 20], [100, 50], [150, 60], [300, 75], [400, 80], [900, 90], [50, 33.33]];
function genRatio() {
  const [more, less] = pick(RATIO_SETS.filter(([, l]) => Number.isInteger(l)));
  return {
    q: `A는 B보다 ${more}% <b>많습니다</b>. 그렇다면 B는 A보다 몇 % <b>적을까요</b>?`,
    ans: less, trap: more, alts: [100 - more, more - less, less + 10].filter(v => v > 0 && v !== less),
    unit: '%',
    why: `기준이 다릅니다. B를 100이라 하면 A는 ${100 + more}입니다. B가 A보다 얼마나 적은지는 <b>A를 기준</b>으로 재야 하므로 ${more} ÷ ${100 + more} = ${less}%입니다. "${more}% 많다"와 "${more}% 적다"는 같은 말이 아닙니다.`,
  };
}

// ===== 확률의 분모 =====
function genCoin() {
  const v = pick(['coin', 'dice', 'twoheads']);
  if (v === 'dice') {
    return {
      q: `주사위 두 개를 던졌을 때 <b>눈의 합이 7</b>일 확률은 몇 분의 1일까요?`,
      ans: 6, trap: 11, alts: [36, 12, 7], unit: '분의 1',
      why: `합이 나올 수 있는 경우는 2부터 12까지 11가지지만 <b>가능성이 서로 다릅니다</b>. 전체 경우는 6×6 = 36가지이고 합이 7인 경우는 (1,6)(2,5)(3,4)(4,3)(5,2)(6,1) 6가지이므로 6/36 = 6분의 1입니다.`,
    };
  }
  if (v === 'twoheads') {
    const n = ri(3, 4);
    return {
      q: `동전 ${n}개를 던져 <b>모두 앞면</b>이 나올 확률은 몇 분의 1일까요?`,
      ans: 2 ** n, trap: n + 1, alts: [n * 2, 2 ** n / 2, n], unit: '분의 1',
      why: `동전 하나가 앞면일 확률이 2분의 1이고 서로 영향을 주지 않으므로 곱합니다. 2를 ${n}번 곱해 ${2 ** n}분의 1입니다. "앞면 개수"로 세면 ${n + 1}가지지만 그 경우들의 가능성이 서로 달라서 그렇게 세면 안 됩니다.`,
    };
  }
  return {
    q: `동전 두 개를 던졌을 때 <b>하나는 앞면, 하나는 뒷면</b>이 나올 확률은 몇 분의 1일까요?`,
    ans: 2, trap: 3, alts: [4, 6, 8], unit: '분의 1',
    why: `경우를 (앞앞)(앞뒤)(뒤앞)(뒤뒤) 넷으로 세야 합니다. "앞뒤"와 "뒤앞"은 서로 다른 경우이므로 2/4 = 2분의 1입니다. (둘 다 앞)(하나씩)(둘 다 뒤) 셋으로 세면 3분의 1이라는 답이 나오는데, 이건 18세기 달랑베르도 빠졌던 함정입니다.`,
  };
}

// ===== 포함과 배제 =====
function genVenn() {
  const T = ri(6, 12) * 5;
  const both = ri(4, 12);
  const a = both + ri(3, 15), b = both + ri(3, 15);
  const neither = T - (a + b - both);
  if (neither < 2 || a > T || b > T) return genVenn();
  const S = pick([['축구', '농구'], ['커피', '차'], ['영화', '독서']]);
  if (Math.random() < 0.35) {
    return {
      q: `${T}명 중 ${S[0]}을(를) 좋아하는 사람이 ${a}명, ${S[1]}을(를) 좋아하는 사람이 ${b}명, <b>둘 다</b> 좋아하는 사람이 ${both}명입니다. ${S[0]}<b>만</b> 좋아하는 사람은 몇 명일까요?`,
      ans: a - both, trap: a, alts: [b - both, a + both, T - a], unit: '명',
      why: `${S[0]}을(를) 좋아하는 ${a}명 안에는 <b>둘 다 좋아하는 ${both}명이 이미 포함</b>돼 있습니다. ${S[0]}만 좋아하는 사람은 ${a} − ${both} = ${a - both}명입니다.`,
    };
  }
  return {
    q: `${T}명 중 ${S[0]}을(를) 좋아하는 사람이 ${a}명, ${S[1]}을(를) 좋아하는 사람이 ${b}명, 둘 다 좋아하는 사람이 ${both}명입니다. <b>둘 다 좋아하지 않는</b> 사람은 몇 명일까요?`,
    ans: neither, trap: T - a - b > 0 ? T - a - b : T - a - b + both * 2,
    alts: [both, a + b - both, T - both], unit: '명',
    why: `${a} + ${b} = ${a + b}명으로 세면 둘 다 좋아하는 ${both}명을 <b>두 번</b> 센 것입니다. 한 번 빼면 ${a} + ${b} − ${both} = ${a + b - both}명이 적어도 하나를 좋아합니다. 전체에서 빼면 ${T} − ${a + b - both} = ${neither}명입니다.`,
  };
}

// ===== 하노이 탑 =====
function genHanoi() {
  const n = ri(3, 8);
  return {
    q: `원반 ${n}개짜리 하노이 탑을 옮기려면 <b>최소</b> 몇 번 움직여야 할까요? (한 번에 한 개씩, 큰 원반을 작은 원반 위에 올릴 수 없습니다)`,
    ans: 2 ** n - 1, trap: 2 ** n, alts: [n * n, 2 * n, 2 ** (n - 1)], unit: '번',
    why: `원반 하나가 늘 때마다 횟수가 두 배보다 하나 더 늘어납니다. n개면 2ⁿ − 1번이고, ${n}개는 2^${n} − 1 = ${2 ** n - 1}번입니다. (위 ${n - 1}개를 옮기고 → 제일 큰 것 1번 → 다시 ${n - 1}개를 옮기니 2×${2 ** (n - 1) - 1}+1)`,
  };
}

// ===== 비례의 연쇄 (저울) =====
function genBalance() {
  const a = ri(2, 4), b = ri(2, 5), c = ri(2, 4), d = ri(2, 5);
  const n = a * c * ri(1, 3);
  const ans = n * b * d / (a * c);
  if (!Number.isInteger(ans) || ans > 200) return genBalance();
  const F = pick([['사과', '배', '귤'], ['빨간 구슬', '파란 구슬', '노란 구슬'], ['금화', '은화', '동전']]);
  return {
    q: `저울에서 ${F[0]} ${a}개와 ${F[1]} ${b}개의 무게가 같고, ${F[1]} ${c}개와 ${F[2]} ${d}개의 무게가 같습니다. ${F[0]} ${n}개는 ${F[2]} 몇 개와 무게가 같을까요?`,
    // 가장 흔한 실수는 한 단계만 바꾸고 멈추는 것
    ans, trap: n * b / a,
    alts: [n * d / c, ans + n, n * (b + d)].filter(Number.isInteger), unit: '개',
    why: `두 번 바꿔야 합니다. ${F[0]} ${n}개 = ${F[1]} ${n * b / a}개(${a}개당 ${b}개 비율), 그리고 ${F[1]} ${n * b / a}개 = ${F[2]} ${ans}개(${c}개당 ${d}개 비율)입니다. 비율은 <b>곱해서</b> 이어붙여야지 더하면 안 됩니다.`,
  };
}

// ===== 일의 자리 (주기) =====
function genLastDigit() {
  const base = pick([2, 3, 7, 8, 12, 13, 17]);
  const e = pick([50, 100, 2026, 99, 77, 123]);
  const last = base % 10;
  const cyc = [];
  let x = 1;
  for (let i = 0; i < 4; i++) { x = (x * last) % 10; cyc.push(x); }
  const ans = cyc[(e - 1) % 4];
  return {
    q: `${base}<sup>${e}</sup>의 <b>일의 자리</b> 숫자는 무엇일까요?`,
    ans, trap: last, alts: cyc.filter(v => v !== ans && v !== last).concat([e % 10]), unit: '',
    why: `일의 자리는 ${last}, ${cyc[1]}, ${cyc[2]}, ${cyc[3]} 네 개가 <b>계속 반복</b>됩니다(주기 4). ${e}를 4로 나눈 나머지가 ${e % 4 === 0 ? '0이므로 네 번째' : `${e % 4}이므로 ${e % 4}번째`}인 ${ans}입니다. 큰 지수라도 직접 계산할 필요가 없습니다.`,
  };
}

// ===== 금괴 자르기 (이진 분할) =====
function genGold() {
  const k = ri(2, 5);
  const n = 2 ** k - 1;
  return {
    q: `금괴 하나로 ${n}일 동안 일당을 줍니다. 매일 ${n}분의 1씩 <b>정확히</b> 지급해야 하고, 이미 준 조각을 <b>거슬러 받아도</b> 됩니다. 금괴를 최소 몇 번 잘라야 할까요?`,
    ans: k - 1, trap: n - 1, alts: [k, n, Math.round(n / 2)], unit: '번',
    why: `${k - 1}번 자르면 조각이 ${k}개 생깁니다 — 크기를 1 : 2${k >= 3 ? ' : 4' : ''}${k >= 4 ? ' : 8' : ''}${k >= 5 ? ' : 16' : ''}로 나누면 되죠. 2일째엔 2짜리를 주고 1짜리를 <b>거슬러 받고</b>, 3일째엔 1짜리를 다시 주는 식으로 1부터 ${n}까지 모든 수를 만들 수 있습니다. 매일 한 조각씩 주려고 ${n - 1}번 자를 필요가 없습니다.`,
  };
}

// ===== 순서 추론 (연역) =====
const ORDER_ITEMS = [['가 상자', '나 상자', '다 상자', '라 상자'], ['민수', '지연', '태호', '수빈']];
function genOrder() {
  const names = pick(ORDER_ITEMS);
  const order = shuffle(names.slice());   // order[0]이 가장 가볍다
  const heavy = pick([true, false]);
  const lines = [];
  for (let i = 0; i < order.length - 1; i++) {
    // 무겁다/가볍다를 섞어서 방향을 통일해 읽지 못하게 한다
    lines.push(Math.random() < 0.5
      ? `${order[i + 1]}은(는) ${order[i]}보다 무겁습니다`
      : `${order[i]}은(는) ${order[i + 1]}보다 가볍습니다`);
  }
  const ask = pick(names);
  const idx = order.indexOf(ask);
  const ans = heavy ? order.length - idx : idx + 1;
  return {
    q: `${shuffle(lines).join('. ')}. <b>${heavy ? '가장 무거운' : '가장 가벼운'} 것부터</b> 순서를 매길 때 ${ask}은(는) 몇 번째일까요?`,
    ans, trap: order.length + 1 - ans, alts: [ans === 1 ? 3 : 1, order.length, 2].filter(v => v !== ans),
    unit: '번째',
    why: `문장을 한 줄로 이어보면 가벼운 것부터 ${order.join(' < ')} 입니다. ${heavy ? '무거운' : '가벼운'} 것부터 세면 ${ask}은(는) ${ans}번째입니다. 문장마다 "무겁다"와 "가볍다"가 섞여 있어서 방향을 한 번 통일하고 세야 합니다.`,
  };
}

// ===== 다리 건너기 (최적화) =====
function genBridge() {
  const a = ri(1, 2), b = a + ri(1, 3), c = b + ri(1, 4), d = c + ri(2, 8);
  const greedy = 2 * a + b + c + d;      // 가장 빠른 사람이 매번 안내
  const smart = a + 3 * b + d;           // 느린 둘을 한 번에 보낸다
  const ans = Math.min(greedy, smart);
  if (greedy === smart) return genBridge();
  return {
    q: `네 사람이 밤에 다리를 건넙니다. 각각 ${a}분·${b}분·${c}분·${d}분이 걸리고, 다리는 <b>한 번에 두 명</b>까지, 반드시 <b>손전등</b>을 들어야 건널 수 있습니다. 손전등은 하나뿐이라 누군가 다시 가져와야 합니다. 네 명이 모두 건너는 <b>최소</b> 시간은?`,
    ans, trap: Math.max(greedy, smart), alts: [a + b + c + d, d + c, 2 * d], unit: '분',
    why: ans === smart
      ? `가장 빠른 사람(${a}분)이 매번 안내하면 ${greedy}분이 걸립니다. 더 좋은 방법은 <b>느린 두 사람을 한 번에</b> 보내는 것입니다: ${a}·${b} 건넘(${b}) → ${a} 복귀(${a}) → ${c}·${d} 건넘(${d}) → ${b} 복귀(${b}) → ${a}·${b} 건넘(${b}) = ${smart}분. 느린 사람 둘이 같이 가면 그중 한 번만 손해입니다.`
      : `이번에는 가장 빠른 사람(${a}분)이 매번 안내하는 쪽이 낫습니다: ${greedy}분. 느린 둘을 묶어 보내는 방법은 ${smart}분이 걸립니다. 두 전략을 <b>모두 계산해 보고</b> 작은 쪽을 골라야 합니다.`,
  };
}

// ===== 전구 토글 (불변량) =====
function genBulbs() {
  const n = pick([50, 100, 144, 200, 400]);
  const ans = Math.floor(Math.sqrt(n));
  return {
    q: `전구 ${n}개가 모두 꺼져 있습니다. 1번 사람이 <b>모든</b> 전구의 스위치를 누르고, 2번 사람이 2의 배수 번호, 3번 사람이 3의 배수 번호… ${n}번 사람까지 누릅니다. 마지막에 <b>켜져 있는</b> 전구는 몇 개일까요?`,
    ans, trap: n / 2, alts: [n, Math.round(n / 4), ans * 2], unit: '개',
    why: `${n}번 전구는 ${n}의 약수 개수만큼 눌립니다. 홀수 번 눌려야 켜진 채로 남는데, 약수는 보통 짝을 지어 나오므로(1×12, 2×6, 3×4) 짝수 개입니다. <b>완전제곱수</b>만 예외입니다 — 36 = 6×6처럼 짝이 자기 자신이라 약수가 홀수 개죠. 1부터 ${n}까지 완전제곱수는 ${ans}개(1², 2², …, ${ans}²)입니다.`,
  };
}

// ===== 나머지 추론 =====
function genRemainder() {
  const gcd = (x, y) => y ? gcd(y, x % y) : x;
  const a = pick([3, 4, 5]), b = pick([5, 6, 7]);
  // 서로소여야 답이 a×b 구간에 정확히 하나만 있다 (아니면 문제가 애매해진다)
  if (a === b || gcd(a, b) !== 1) return genRemainder();
  const r1 = ri(1, a - 1), r2 = ri(1, b - 1);
  const lo = ri(3, 8) * 10;
  let ans = null;
  for (let x = lo; x < lo + a * b; x++) {
    if (x % a === r1 && x % b === r2) { ans = x; break; }
  }
  if (ans === null || ans > lo + a * b) return genRemainder();
  return {
    q: `달걀을 ${a}개씩 담으면 ${r1}개가 남고, ${b}개씩 담으면 ${r2}개가 남습니다. 달걀이 ${lo}개 이상 ${lo + a * b - 1}개 이하일 때 달걀은 몇 개일까요?`,
    ans, trap: lo + r1 + r2, alts: [ans + a, ans - b, a * b + r1], unit: '개',
    why: `${a}로 나눈 나머지가 ${r1}, ${b}로 나눈 나머지가 ${r2}인 수를 찾습니다. 두 조건을 <b>동시에</b> 만족하는 수는 ${a * b}개마다 한 번씩 나오므로, ${lo}~${lo + a * b - 1} 사이에는 정확히 하나 — ${ans}개입니다. (${ans} ÷ ${a} = ${Math.floor(ans / a)}…${r1}, ${ans} ÷ ${b} = ${Math.floor(ans / b)}…${r2})`,
  };
}

// ===== 몬티 홀 =====
function genMonty() {
  const n = pick([4, 5, 10, 20, 50, 100]);
  const ans = Math.round((n - 1) / n * 100);
  return {
    q: `문 ${n}개 중 하나에만 상품이 있습니다. 당신이 문 하나를 고르자, <b>정답을 아는</b> 진행자가 나머지 문 중 빈 문 ${n - 2}개를 열어 보여줍니다. 이제 남은 문으로 <b>바꾸면</b> 상품을 얻을 확률은 몇 %일까요?`,
    ans, trap: 50, alts: [Math.round(100 / n), 100, ans - 10].filter(v => v > 0 && v !== ans),
    unit: '%',
    why: `처음 고른 문이 정답일 확률은 여전히 ${Math.round(100 / n)}%입니다 — 진행자가 문을 열어도 그 사실은 바뀌지 않습니다. 나머지 ${n - 1}개에 정답이 있을 확률 ${ans}%가 <b>남은 한 문에 그대로 몰립니다</b>. 진행자는 정답을 알고 빈 문만 골라 열었기 때문입니다. 문이 둘 남았다고 반반이 아닙니다.`,
  };
}

// ===== 물병 붓기 (탐색) =====
function genJug() {
  const gcd = (x, y) => y ? gcd(y, x % y) : x;
  const a = pick([3, 4, 5]), b = pick([5, 7, 8, 9]);
  if (a >= b || gcd(a, b) !== 1) return genJug();
  const target = ri(1, b - 1);
  // 최소 조작 횟수를 너비 우선 탐색으로 구한다 (채우기·비우기·옮기기 = 각 1번)
  const seen = new Set(['0,0']);
  let frontier = [[0, 0]], steps = 0, found = -1;
  while (frontier.length && steps < 20 && found < 0) {
    steps++;
    const nextF = [];
    for (const [x, y] of frontier) {
      const move = Math.min(x, b - y), move2 = Math.min(y, a - x);
      for (const s of [[a, y], [x, b], [0, y], [x, 0], [x - move, y + move], [x + move2, y - move2]]) {
        const k = s.join(',');
        if (seen.has(k)) continue;
        seen.add(k);
        if (s[0] === target || s[1] === target) { found = steps; break; }
        nextF.push(s);
      }
      if (found > 0) break;
    }
    frontier = nextF;
  }
  if (found < 2) return genJug();
  return {
    q: `눈금 없는 ${a}L 물병과 ${b}L 물병만 있습니다. 물은 얼마든지 쓸 수 있고 <b>채우기·비우기·옮기기</b>가 각각 한 번의 조작입니다. 정확히 ${target}L를 만들려면 최소 몇 번의 조작이 필요할까요?`,
    ans: found, trap: found + 2, alts: [found - 1, a + b, target * 2].filter(v => v > 0 && v !== found),
    unit: '번',
    why: `물병에 눈금이 없어도 두 병을 오가며 <b>차이</b>를 만들면 됩니다. ${a}L와 ${b}L는 서로 나누어떨어지지 않아서 1L 단위까지 모두 만들 수 있고, ${target}L는 최소 ${found}번이면 됩니다. 무작정 붓기 전에 "몇 번 만에 되는가"를 세어 보면 훨씬 짧은 길이 보입니다.`,
  };
}

// ===== 기사와 거짓말쟁이 =====
function genKnights() {
  const n = ri(2, 5) * 2;   // 짝수라야 답이 딱 떨어진다
  return {
    q: `${n}명이 한 명씩 말했습니다. 1번은 "우리 중 거짓말쟁이가 <b>1명 이상</b>이다", 2번은 "2명 이상이다", … ${n}번은 "${n}명 이상이다"라고 했습니다. 정직한 사람은 <b>항상 참</b>만, 거짓말쟁이는 <b>항상 거짓</b>만 말합니다. 정직한 사람은 몇 명일까요?`,
    ans: n / 2, trap: 1, alts: [n - 1, n / 2 + 1, 0].filter(v => v > 0 && v !== n / 2), unit: '명',
    why: `거짓말쟁이가 L명이라 하면 "L명 이상이다"까지는 참이고 그 뒤는 거짓입니다. 정직한 사람은 참을 말했으니 앞쪽 L명 안에 있고, 거짓말쟁이는 거짓을 말했으니 <b>뒤쪽 ${n} − L명이 전부 거짓말쟁이</b>여야 합니다. 즉 L = ${n} − L이므로 L = ${n / 2}, 정직한 사람도 ${n / 2}명입니다.`,
  };
}

// [가족, 필요 레벨]. 레벨 = (레이팅-1000)/200
// 랭크가 오를수록 새 가족이 열려서, 익숙해질 때쯤 처음 보는 문제가 나온다.
const FAMILIES = [
  ['pigeon', 0, genPigeon],
  ['batball', 0, genBatBall],
  ['lily', 0, genLily],
  ['machine', 0, genMachine],
  ['fence', 0, genFence],
  ['log', 0, genLog],
  ['tournament', 0, genTournament],
  ['area', 0, genArea],
  ['clock', 1, genClock],
  ['snail', 1, genSnail],
  ['handshake', 1, genHandshake],
  ['work', 1, genWork],
  ['speed', 2, genSpeed],
  ['scale', 2, genScale],
  ['discount', 2, genDiscount],
  ['average', 2, genAverage],
  ['age', 3, genAge],
  ['train', 3, genTrain],
  ['stair', 3, genStair],
  ['cube', 3, genCube],
  ['angle', 4, genAngle],
  ['mix', 4, genMix],
  ['ratio', 4, genRatio],
  ['coin', 4, genCoin],
  // --- 여기서부터는 "계산"이 아니라 다른 종류의 생각을 요구한다 ---
  ['venn', 1, genVenn],            // 포함과 배제
  ['hanoi', 2, genHanoi],          // 재귀
  ['balance', 3, genBalance],      // 비례의 연쇄
  ['lastdigit', 3, genLastDigit],  // 주기
  ['gold', 4, genGold],            // 이진 분할 (최적화)
  ['order', 4, genOrder],          // 연역 추론
  ['bridge', 5, genBridge],        // 최적화 — 욕심쟁이 전략이 최선이 아니다
  ['bulbs', 5, genBulbs],          // 불변량 (약수의 홀짝)
  ['remainder', 5, genRemainder],  // 나머지
  ['monty', 5, genMonty],          // 조건부 확률
  ['jug', 6, genJug],              // 상태 탐색
  ['knights', 6, genKnights],      // 자기참조 논리
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
    // 가족별로 지금까지 몇 번 만났는지 (판을 넘어 이어진다)
    const seen = ctx.state.trapSeen || (ctx.state.trapSeen = {});
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
      // 이번 판에 안 나온 가족 중에서, 그중에서도 지금까지 가장 적게 본 것부터 뽑는다.
      // 이러면 모든 가족을 한 바퀴 돈 뒤에야 같은 가족이 다시 나온다 —
      // "또 그 문제네" 하는 순간이 최대한 뒤로 밀린다.
      const cands = pool.filter(([fam]) => !used.has(fam));
      const from = cands.length ? cands : pool;
      const least = Math.min(...from.map(([fam]) => seen[fam] || 0));
      const [fam, , gen] = pick(from.filter(([f]) => (seen[f] || 0) === least));
      used.add(fam);
      seen[fam] = (seen[fam] || 0) + 1;
      ctx.persist();
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
