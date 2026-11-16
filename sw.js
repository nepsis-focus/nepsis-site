// Nepsis Service Worker — lightweight, update-friendly
// Version bump this string when you want to force cache refresh
const CACHE_VERSION = 'nepsis-v9';
const CACHE_NAME = `nepsis-static-${CACHE_VERSION}`;

// Paths are relative to this script so the same list works on GitHub Pages
// (/nepsis-site/) and on hosts that serve the site at /.
const ROOT = new URL('./', self.location);
const asset = (path) => new URL(path, ROOT).href;

// Core static assets to cache (adjust paths as needed)
const CORE_ASSETS = [
  asset('./'),
  asset('index.html'),
  asset('practice.html'),
  asset('about.html'),
  asset('how.html'),
  asset('faq.html'),
  asset('library.html'),
  asset('premium.html'),
  asset('privacy.html'),
  asset('terms.html'),
  asset('reset.html'),
  asset('manifest.json'),
  asset('icons/icon-192.png'),
  asset('icons/icon-512.png'),
  asset('assets/brand/nepsis-mark.svg'),
  asset('assets/brand/nepsis-og.png')
];

// Install: cache core assets, then skip waiting so new SW activates quickly
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => console.warn('SW install cache failed (non-critical):', err))
      .then(() => self.skipWaiting())
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
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(asset('./'))))
    );
    return;
  }

  // Refresh app code on each visit; use cache only when offline.
  if (/\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(new Request(request, { cache: 'reload' }))
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

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
