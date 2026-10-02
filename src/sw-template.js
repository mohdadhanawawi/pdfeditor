/* Service worker: precaches the whole app so it works offline.
 * The version and precache list are filled in at build time (see vite.config.ts). */
const VERSION = __VERSION__;
const CACHE = `pdfeditor-${VERSION}`;
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('pdfeditor-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The page asks us to activate when the user accepts the update prompt.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // App shell: every navigation gets index.html (routing is hash-based).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        return fresh;
      } catch {
        return (await caches.match('./index.html', { cacheName: CACHE })) || (await caches.match('./', { cacheName: CACHE })) || Response.error();
      }
    })());
    return;
  }

  // Hashed assets never change, so cache-first is safe.
  event.respondWith((async () => {
    const cached = await caches.match(req, { cacheName: CACHE, ignoreSearch: true });
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') {
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
    }
    return res;
  })());
});
