// VoidPulse Service Worker v17.1 — Network-first for shell, aggressive cache busting
const CACHE_NAME = 'vp-v17.1';
const SHELL_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// Install: Pre-cache shell + force activate immediately
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

// Activate: Purge ALL old caches aggressively
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Purging old cache:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for app shell, cache-first for static only
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Network-only: API calls
  if (url.pathname.match(/^\/(status|auth|command|playlist|analytics|disconnect|ws)/)) return;

  // Cache-first: Fonts and icons only
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' ||
      url.pathname.endsWith('.png') || url.pathname.endsWith('.ico')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        });
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first: Everything else (index.html, js, json)
  e.respondWith(
    fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});

// Message handler: Force update from app
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'purgeAll') {
    caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  }
});
