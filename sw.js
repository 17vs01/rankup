// 오프라인 캐시 서비스워커
const CACHE = 'rankup-v18';
const ASSETS = [
  '.',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/platform.js',
  'js/rating.js',
  'js/storage.js',
  'js/audio.js',
  'js/feedback.js',
  'js/daily.js',
  'js/backup.js',
  'js/rules.js',
  'js/data/vocab.js',
  'js/games/math.js',
  'js/games/lexi.js',
  'js/games/memory.js',
  'js/games/focus.js',
  'js/games/unpredict.js',
  'js/games/chrono.js',
  'js/games/compass.js',
  'js/games/eyeball.js',
  'js/sudoku-core.js',
  'js/games/sudoku.js',
  'js/data/korvocab.js',
  'js/games/t24.js',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
];

// addAll은 하나라도 실패하면 전부 버린다. 파일 하나 때문에 오프라인이 통째로
// 죽지 않도록 개별로 담고, 실패한 것만 넘어간다.
async function precache() {
  const c = await caches.open(CACHE);
  const results = await Promise.all(ASSETS.map(async url => {
    try {
      const res = await fetch(url, { cache: 'reload' });
      if (!res.ok) return url;
      await c.put(url, res);
      return null;
    } catch { return url; }
  }));
  return results.filter(Boolean);   // 실패 목록
}

async function cacheCount() {
  if (!(await caches.has(CACHE))) return 0;
  return (await (await caches.open(CACHE)).keys()).length;
}

self.addEventListener('install', e => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // 캐시가 비어 있으면(저장공간 정리 등으로 밀려났으면) 다시 채운다.
    // 스크립트가 안 바뀌면 install이 다시 돌지 않으므로 여기서 자가 복구한다.
    if (await cacheCount() === 0) await precache();
  })());
});

// 페이지가 캐시 상태를 물어보거나 다시 채워달라고 요청할 수 있게 한다
self.addEventListener('message', e => {
  if (!e.data || e.data.type !== 'ensure-cache') return;
  e.waitUntil((async () => {
    let n = await cacheCount();
    let failed = [];
    if (n === 0) { failed = await precache(); n = await cacheCount(); }
    if (e.source) e.source.postMessage({ type: 'cache-status', cache: CACHE, count: n, failed });
  })());
});

// 네트워크 우선, 실패 시 캐시 (업데이트 반영 + 오프라인 동작)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // 404/500 같은 실패 응답으로 멀쩡한 캐시를 덮어쓰지 않는다
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
