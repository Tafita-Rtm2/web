const CACHE_NAME = 'gsi-insight-apk-v11';

// Routes to pre-cache
const ASSETS_TO_CACHE = [
  '/apk/',
  '/apk/index.html',
  '/apk/login/',
  '/apk/login/index.html',
  '/apk/admin/',
  '/apk/admin/index.html',
  '/apk/professor/',
  '/apk/professor/index.html',
  '/apk/schedule/',
  '/apk/schedule/index.html',
  '/apk/subjects/',
  '/apk/subjects/index.html',
  '/apk/library/',
  '/apk/library/index.html',
  '/apk/community/',
  '/apk/community/index.html',
  '/apk/profile/',
  '/apk/profile/index.html',
  '/apk/chat/',
  '/apk/chat/index.html',
  '/apk/performance/',
  '/apk/performance/index.html',
  '/apk/manifest.json',
  '/apk/gsilogo.jpg',
  '/apk/icon-192.png',
  '/apk/icon-512.png',
  'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching core routes');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`SW: Pre-cache failed for ${url}`)))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('SW: Cleaning old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- BYPASS CRITIQUE POUR LES MÉDIAS (PHOTO/VIDEO) ---
  // On ne laisse JAMAIS le Service Worker gérer les appels au proxy api/proxy
  // car Chrome/Safari bloquent le streaming (Range requests) via SW.
  if (url.pathname.includes('/api/proxy')) {
    return; // Laisse le navigateur gérer directement la requête réseau
  }

  // Bypass for Range requests (just in case)
  if (event.request.headers.get('range')) return;

  // Bypass for dynamic DB calls
  if (url.pathname.includes('/db/')) return;

  if (event.request.method !== 'GET') return;

  // STRATEGY: Network First for HTML, Cache First for assets
  const isHtml = event.request.mode === 'navigate' ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(async () => {
          // Robust offline fallback for navigation
          // 1. Check exact match
          const cached = await caches.match(event.request);
          if (cached) return cached;

          // 2. Try folder-based matching
          const urlObj = new URL(event.request.url);
          const path = urlObj.pathname;

          const alternates = [
            path.endsWith('/') ? path : path + '/',
            path.endsWith('/') ? path + 'index.html' : path + '/index.html',
            '/apk/index.html'
          ];

          for (const alt of alternates) {
            const match = await caches.match(alt);
            if (match) return match;
          }

          // 3. Last resort: match any root-level index.html if we are in /apk/
          if (path.startsWith('/apk/')) {
             return caches.match('/apk/index.html');
          }

          return null;
        })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;

        return fetch(event.request).then((res) => {
          if (res && res.status === 200 && (
              url.pathname.includes('_next/static') ||
              url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2|json|pdf)$/)
          )) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        }).catch(() => {
           if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg)$/)) {
             return caches.match('/apk/gsilogo.jpg');
           }
           return null;
        });
      })
    );
  }
});
