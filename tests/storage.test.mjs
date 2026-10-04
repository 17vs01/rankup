// 저장본 검사 — 어떤 저장본이 와도 loadState는 예외 없이 쓸 수 있는 상태를 돌려줘야 한다.
// 손으로 고친 백업 파일, 중간에 끊긴 쓰기, 옛 버전이 실제로 이런 모양을 만든다.
// 여기서 예외가 나면 그 저장본이 남아 있는 한 앱을 열 때마다 죽는다.
import { expose, collector } from './_load.mjs';

export const name = '저장본 방어';

const CASES = {
  '빈 문자열': '',
  '깨진 JSON': '{oops',
  'null': 'null',
  '숫자': '42',
  '배열': '[]',
  'disc 없음': '{"theme":"linen"}',
  'disc가 문자열': '{"disc":"x"}',
  'disc 항목이 null': '{"disc":{"math":null}}',
  'disc 항목이 숫자': '{"disc":{"math":5}}',
  'rating이 문자열': '{"disc":{"math":{"rating":"abc","variants":{"":{"rating":null,"sessions":"3"}}}}}',
  'variants가 배열': '{"disc":{"math":{"rating":1200,"variants":[1,2]}}}',
  'variant가 null': '{"disc":{"math":{"rating":1200,"sessions":4,"variants":{"":null}}}}',
  'variant가 문자열': '{"disc":{"math":{"rating":1200,"variants":{"":"x"}}}}',
  'records가 문자열': '{"disc":{"math":{"rating":1200,"records":"x"}}}',
  'history가 객체': '{"disc":{},"history":{"a":1}}',
  'history 항목이 깨짐': '{"disc":{},"history":[null,5,"x",{"t":1}]}',
  'daily가 문자열': '{"disc":{},"daily":"x"}',
  'daily.ids에 이상한 값': '{"disc":{},"daily":{"day":"2026-10-3","ids":["ghost",null,7],"done":"x"}}',
  'week.key 없음': '{"disc":{},"week":{"pts":50}}',
  'week.pts 문자열': '{"disc":{},"week":{"key":"2026-9-28","pts":"many"}}',
  'sudokuProg 깨짐': '{"disc":{},"sudokuProg":{"unlocked":"many","recs":null,"daily":5,"perfect":"x"}}',
  'sudokuProg.daily 항목 깨짐': '{"disc":{},"sudokuProg":{"daily":{"2026-10-1":null,"2026-10-2":{"sec":"x"}}}}',
  'sudoku 진행판 칸 수 틀림': '{"disc":{},"sudoku":{"level":"쉬움","grid":[1,2,3]}}',
  'sudoku가 문자열': '{"disc":{},"sudoku":"x"}',
  'seenRules·modes 깨짐': '{"disc":{},"seenRules":"x","modes":7,"trapSeen":[1]}',
  'streak null': '{"disc":{},"streak":null,"freeze":99,"totalSessions":"7"}',
  'theme 이상': '{"disc":{},"theme":"<script>"}',
};

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export async function run() {
  const c = collector();
  // storage.js는 rating·platform을 import한다. 저장소는 가짜로, 부식은 0으로 둔다.
  const m = await expose('js/storage.js', ['loadState', '__setRaw'],
    `const START_RATING = 1000; const pendingDecay = () => 0;
     const storage = { get: async () => null, set: async () => {}, remove: async () => {} };
     function __setRaw(v) { raw = v; }`);

  for (const [label, raw] of Object.entries(CASES)) {
    let st;
    try { m.__setRaw(raw); st = m.loadState(); }
    catch (e) { c.note(`"${label}" 저장본에서 예외`, e.message); continue; }

    const bad = [];
    for (const [id, d] of Object.entries(st.disc)) {
      if (!isObj(d) || !Number.isFinite(d.rating)) { bad.push(`${id}.rating`); continue; }
      if (!isObj(d.variants)) bad.push(`${id}.variants 모양`);
      for (const [k, v] of Object.entries(d.variants || {})) {
        if (!isObj(v) || !Number.isFinite(v.rating)) bad.push(`${id}.variants[${k}]`);
      }
    }
    if (!Array.isArray(st.history) || st.history.some(h => !isObj(h) || !Number.isFinite(h.t))) bad.push('history');
    if (!Number.isFinite(st.streak) || !Number.isFinite(st.totalSessions)) bad.push('streak/totalSessions');
    if (st.daily && st.daily.ids.some(x => typeof x !== 'string')) bad.push('daily.ids');
    if (st.week && !Number.isFinite(st.week.pts)) bad.push('week.pts');
    const sp = st.sudokuProg;
    if (!isObj(sp) || !isObj(sp.daily) || !isObj(sp.perfect) || !isObj(sp.recs)) bad.push('sudokuProg 모양');
    else if (Object.values(sp.daily).some(v => !isObj(v) || !Number.isFinite(v.sec))) bad.push('sudokuProg.daily 항목');
    if (st.sudoku != null && !(isObj(st.sudoku) && Array.isArray(st.sudoku.grid) && st.sudoku.grid.length === 81)) bad.push('sudoku 진행판');
    for (const k of ['seenRules', 'modes', 'trapSeen']) if (!isObj(st[k])) bad.push(k);
    if (bad.length) c.note(`"${label}" 저장본을 읽은 뒤에도 깨진 값이 남음`, bad.join(', '));
  }
  return c;
}
