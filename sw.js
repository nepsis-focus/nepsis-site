// Nepsis Service Worker — lightweight, update-friendly
// Version bump this string when you want to force cache refresh
const CACHE_VERSION = 'nepsis-v2';
const CACHE_NAME = `nepsis-static-${CACHE_VERSION}`;

// Core static assets to cache (adjust paths as needed)
const CORE_ASSETS = [
  '/nepsis-site/',
  '/nepsis-site/index.html',
  '/nepsis-site/practice.html',
  '/nepsis-site/about.html',
  '/nepsis-site/how.html',
  '/nepsis-site/faq.html',
  '/nepsis-site/library.html',
  '/nepsis-site/premium.html',
  '/nepsis-site/privacy.html',
  '/nepsis-site/terms.html',
  '/nepsis-site/reset.html',
  '/nepsis-site/manifest.json',
  '/nepsis-site/icons/icon-192.png',
  '/nepsis-site/icons/icon-512.png',
  '/nepsis-site/assets/brand/nepsis-mark.svg',
  '/nepsis-site/assets/brand/nepsis-og.png'
];

// Install: cache core assets, then skip waiting so new SW activates quickly
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('SW install cache failed (non-critical):', err))
  );
});

// Activate: clean old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('nepsis-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML (so updates appear immediately),
// cache-first for static assets, fallback to cache if offline
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET and same-origin
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations / HTML
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/nepsis-site/')))
    );
    return;
  }

  // Cache-first for other static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
        }
        return response;
      }).catch(() => cached);
    })
  );
});
