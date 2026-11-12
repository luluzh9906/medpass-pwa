const CACHE_NAME = 'medpass-pwa-v1.9.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/ai.js',
  './js/db.js',
  './js/seed.js',
  './js/i18n.js',
  './js/qa.js',
  './js/specialties.js',
  './js/codec.js',
  './js/qrcode.js',
  './js/charts.js',
  './js/security.js',
  './js/views-doctor.js',
  './js/views-manage.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          CORE_ASSETS.map((asset) => cache.add(new Request(asset, { cache: 'reload' })))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-First when online so GitHub Pages updates take effect immediately;
  // falls back to offline cache seamlessly when offline.
  const isStaticIcon = url.pathname.includes('/icons/');
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      if (isStaticIcon) {
        const cachedIcon = await cache.match(event.request, { ignoreSearch: true });
        if (cachedIcon) return cachedIcon;
      }
      try {
        const networkRes = await fetch(event.request.url, {
          cache: 'no-cache',
          credentials: 'same-origin'
        });
        if (networkRes && networkRes.ok) {
          cache.put(event.request, networkRes.clone());
        }
        return networkRes;
      } catch {
        const cached = await cache.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return cache.match('./index.html', { ignoreSearch: true });
        }
        return Response.error();
      }
    })
  );
});
