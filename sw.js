// VoidCapture Service Worker v14.1 — Intelligent per-resource caching
const CACHE_NAME = 'vc-v16.0';
const SHELL_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

// ── Install: Pre-cache shell ──
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

// ── Activate: Clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// ── Fetch: Per-resource strategy ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Network-only: API calls (never cache dynamic data)
  if (url.pathname.match(/^\/(status|auth|command|playlist|analytics|disconnect|ws)/)) return;

  // Cache-first: Fonts and icons (rarely change)
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

  // Stale-while-revalidate: App shell (serve fast, update in background)
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.json')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(resp => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default: Network with cache fallback
  e.respondWith(
    fetch(e.request).then(resp => {
      const clone = resp.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      return resp;
    }).catch(() => caches.match(e.request))
  );
});
