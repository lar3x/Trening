// Service worker: aplikacija dela brez interneta.
// Ob vsaki spremembi kode dvigni CACHE, sicer telefon servira staro različico.
// Vsako novo datoteko dopiši v FILES.
const CACHE = 'trening-v6';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/store.js',
  './js/theme.js',
  './js/icons.js',
  './js/ui.js',
  './js/chart.js',
  './js/settings.js',
  './js/strava.js',
  './js/screens/training.js',
  './js/screens/archive.js',
  './js/screens/cardio.js',
  './js/screens/body.js',
  './js/screens/progress.js',
  './js/screens/exercise-stats.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Najprej predpomnilnik (hitro in brez povezave), sicer omrežje.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
