// 오프라인 캐시 서비스워커
const CACHE = 'rankup-v4';
const ASSETS = [
  '.',
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/rating.js',
  'js/storage.js',
  'js/audio.js',
  'js/backup.js',
  'js/data/vocab.js',
  'js/games/math.js',
  'js/games/vocab.js',
  'js/games/memory.js',
  'js/games/focus.js',
  'js/games/unpredict.js',
  'js/games/chrono.js',
  'js/games/compass.js',
  'js/games/eyeball.js',
  'js/sudoku-core.js',
  'js/games/sudoku.js',
  'js/games/chain.js',
  'js/games/calib.js',
  'js/games/metamem.js',
  'js/games/t24.js',
  'manifest.webmanifest',
  'icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 네트워크 우선, 실패 시 캐시 (업데이트 반영 + 오프라인 동작)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
