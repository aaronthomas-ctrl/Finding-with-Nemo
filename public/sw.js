/* Service worker: an installable, offline-capable app shell. It never touches API calls, Supabase, or any
   cross-origin request, so no private data is cached. Bump VERSION to force a refresh of cached files. */
const VERSION = 'v1';
const CACHE = `nemo-shell-${VERSION}`;
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('nemo-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                       // Supabase, Google, fonts: network only
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/injection-tests/')) return;

  // Page loads: network first so a new deploy shows up, the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/').then((r) => r || new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } }))),
    );
    return;
  }

  // Built files and icons: serve from cache, refresh in the background.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || refresh;
    }),
  );
});
