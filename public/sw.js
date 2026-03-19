const CACHE_NAME = 'gsi-web-v4';
const STATIC_ASSETS = [
  '/web/',
  '/web/index.html',
  '/web/login/',
  '/web/admin/',
  '/web/professor/',
  '/web/manifest.json',
  '/web/sw.js',
  '/web/pdf.worker.min.mjs',
  '/web/icon-192.png',
  '/web/icon-512.png',
  '/web/logo.png',
  '/web/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API
  if (url.pathname.includes('/api/')) return;

  // Cache-First for static assets
  if (
    url.pathname.includes('/_next/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|css|js|woff2?|ico)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((res) => {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        });
      })
    );
  } else {
    // Network-First with fallback to index for SPA
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/web/');
          }
        });
      })
    );
  }
});
