// 스도쿠 생성기 / 솔버 (9×9, 6×6 공용)
// 후보를 비트마스크로 들고 다니며 최소후보 칸부터 파고든다.

export const SPEC9 = { n: 9, br: 3, bc: 3 };   // 3×3 박스
export const SPEC6 = { n: 6, br: 2, bc: 3 };   // 2행×3열 박스

export function boxOf(spec, r, c) {
  const perRow = spec.n / spec.bc;
  return Math.floor(r / spec.br) * perRow + Math.floor(c / spec.bc);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// grid: Int8Array(n*n), 0 = 빈칸
function makeMasks(spec, grid) {
  const { n } = spec;
  const row = new Int32Array(n), col = new Int32Array(n), box = new Int32Array(n);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const v = grid[r * n + c];
      if (!v) continue;
      const bit = 1 << (v - 1);
      row[r] |= bit; col[c] |= bit; box[boxOf(spec, r, c)] |= bit;
    }
  }
  return { row, col, box };
}

// 해의 개수를 limit까지만 센다 (유일해 판정용이라 2면 충분)
export function countSolutions(spec, grid, limit = 2) {
  const { n } = spec;
  const g = Int8Array.from(grid);
  const m = makeMasks(spec, g);
  const full = (1 << n) - 1;
  let found = 0;

  function rec() {
    let best = -1, bestCand = 0, bestCount = 99;
    for (let i = 0; i < n * n; i++) {
      if (g[i]) continue;
      const r = (i / n) | 0, c = i % n;
      const used = m.row[r] | m.col[c] | m.box[boxOf(spec, r, c)];
      const cand = full & ~used;
      if (cand === 0) return false;          // 막힘
      let cnt = 0, x = cand;
      while (x) { cnt += x & 1; x >>= 1; }
      if (cnt < bestCount) { bestCount = cnt; best = i; bestCand = cand; if (cnt === 1) break; }
    }
    if (best === -1) { found++; return found >= limit; }

    const r = (best / n) | 0, c = best % n, b = boxOf(spec, r, c);
    for (let v = 1; v <= n; v++) {
      const bit = 1 << (v - 1);
      if (!(bestCand & bit)) continue;
      g[best] = v; m.row[r] |= bit; m.col[c] |= bit; m.box[b] |= bit;
      const stop = rec();
      g[best] = 0; m.row[r] &= ~bit; m.col[c] &= ~bit; m.box[b] &= ~bit;
      if (stop) return true;
    }
    return false;
  }
  rec();
  return found;
}

export function solve(spec, grid) {
  const { n } = spec;
  const g = Int8Array.from(grid);
  const m = makeMasks(spec, g);
  const full = (1 << n) - 1;

  function rec() {
    let best = -1, bestCand = 0, bestCount = 99;
    for (let i = 0; i < n * n; i++) {
      if (g[i]) continue;
      const r = (i / n) | 0, c = i % n;
      const cand = full & ~(m.row[r] | m.col[c] | m.box[boxOf(spec, r, c)]);
      if (cand === 0) return false;
      let cnt = 0, x = cand;
      while (x) { cnt += x & 1; x >>= 1; }
      if (cnt < bestCount) { bestCount = cnt; best = i; bestCand = cand; if (cnt === 1) break; }
    }
    if (best === -1) return true;
    const r = (best / n) | 0, c = best % n, b = boxOf(spec, r, c);
    const vals = shuffle([...Array(n)].map((_, k) => k + 1));
    for (const v of vals) {
      const bit = 1 << (v - 1);
      if (!(bestCand & bit)) continue;
      g[best] = v; m.row[r] |= bit; m.col[c] |= bit; m.box[b] |= bit;
      if (rec()) return true;
      g[best] = 0; m.row[r] &= ~bit; m.col[c] &= ~bit; m.box[b] &= ~bit;
    }
    return false;
  }
  return rec() ? g : null;
}

export function fullGrid(spec) {
  return solve(spec, new Int8Array(spec.n * spec.n));
}

// 유일해를 유지하면서 단서를 targetClues까지 걷어낸다.
// 대칭 제거는 하지 않는다 — 낮은 단서 수를 실제로 달성하는 쪽이 난이도에 정직하다.
export function generate(spec, targetClues) {
  const { n } = spec;
  const solution = fullGrid(spec);
  const puzzle = Int8Array.from(solution);
  const order = shuffle([...Array(n * n)].map((_, i) => i));
  let clues = n * n;
  for (const i of order) {
    if (clues <= targetClues) break;
    const saved = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(spec, puzzle, 2) === 1) clues--;
    else puzzle[i] = saved;
  }
  return { puzzle, solution, clues };
}

// 현재 판에서 "값이 하나로 확정되는" 칸을 찾는다.
// naked single(후보가 하나) + hidden single(줄/박스에서 그 값이 놓일 자리가 하나)
export function findSingles(spec, grid) {
  const { n } = spec;
  const m = makeMasks(spec, grid);
  const full = (1 << n) - 1;
  const out = [];
  const taken = new Set();

  // naked single
  for (let i = 0; i < n * n; i++) {
    if (grid[i]) continue;
    const r = (i / n) | 0, c = i % n;
    const cand = full & ~(m.row[r] | m.col[c] | m.box[boxOf(spec, r, c)]);
    if (cand && (cand & (cand - 1)) === 0) {
      out.push({ idx: i, val: Math.log2(cand) + 1 });
      taken.add(i);
    }
  }

  // hidden single (행/열/박스 각 유닛에서 어떤 값이 딱 한 자리만 가능)
  const units = [];
  for (let r = 0; r < n; r++) units.push([...Array(n)].map((_, c) => r * n + c));
  for (let c = 0; c < n; c++) units.push([...Array(n)].map((_, r) => r * n + c));
  const perRow = n / spec.bc;
  for (let b = 0; b < n; b++) {
    const r0 = Math.floor(b / perRow) * spec.br, c0 = (b % perRow) * spec.bc;
    const u = [];
    for (let dr = 0; dr < spec.br; dr++) for (let dc = 0; dc < spec.bc; dc++) u.push((r0 + dr) * n + c0 + dc);
    units.push(u);
  }

  for (const u of units) {
    for (let v = 1; v <= n; v++) {
      const bit = 1 << (v - 1);
      let spot = -1, count = 0, already = false;
      for (const i of u) {
        if (grid[i] === v) { already = true; break; }
        if (grid[i]) continue;
        const r = (i / n) | 0, c = i % n;
        const cand = full & ~(m.row[r] | m.col[c] | m.box[boxOf(spec, r, c)]);
        if (cand & bit) { spot = i; count++; if (count > 1) break; }
      }
      if (!already && count === 1 && !taken.has(spot)) {
        out.push({ idx: spot, val: v });
        taken.add(spot);
      }
    }
  }
  return out;
}

// 빈 칸마다 가능한 후보 목록
export function candidates(spec, grid) {
  const { n } = spec;
  const m = makeMasks(spec, grid);
  const full = (1 << n) - 1;
  const out = [];
  for (let i = 0; i < n * n; i++) {
    if (grid[i]) { out.push(null); continue; }
    const r = (i / n) | 0, c = i % n;
    const cand = full & ~(m.row[r] | m.col[c] | m.box[boxOf(spec, r, c)]);
    const list = [];
    for (let v = 1; v <= n; v++) if (cand & (1 << (v - 1))) list.push(v);
    out.push(list);
  }
  return out;
}

// 해당 칸에 v를 놓을 수 있는지 (규칙 위반 검사)
export function conflicts(spec, grid, idx, v) {
  const { n } = spec;
  if (!v) return [];            // 빈 값은 충돌 대상이 아니다
  const r = (idx / n) | 0, c = idx % n, b = boxOf(spec, r, c);
  const bad = [];
  for (let i = 0; i < n * n; i++) {
    if (i === idx || grid[i] !== v) continue;
    const rr = (i / n) | 0, cc = i % n;
    if (rr === r || cc === c || boxOf(spec, rr, cc) === b) bad.push(i);
  }
  return bad;
}
