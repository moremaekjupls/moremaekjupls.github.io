// Service worker, generated at build time so every deploy gets a new cache
// version and the previous one is dropped on activate.
//
// Strategy
//   pages          network first → cached copy → /offline/
//   /_astro/, fonts cache first (file names are content-hashed or never change)
//   other same-origin files  stale-while-revalidate
//   video, cross-origin      not touched (range requests, third parties)
//
// Network-first for HTML matters on an experimental site: when online you
// always see the latest deploy, the cache is only a fallback.
const VERSION = Date.now().toString(36);

const PRECACHE = [
  '/', '/blog/', '/history/', '/about/', '/offline/',
  '/hero-frame.jpg',
  '/fonts/geist-sans-latin-400-normal.woff2',
  '/fonts/geist-sans-latin-500-normal.woff2',
  '/fonts/geist-sans-latin-600-normal.woff2',
];

const source = `
const CACHE = 'site-${VERSION}';
const PRECACHE = ${JSON.stringify(PRECACHE)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('/offline/'));
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\\.(mp4|webm)$/.test(url.pathname) || req.headers.has('range')) return;

  if (req.mode === 'navigate') return event.respondWith(networkFirst(req));
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/fonts/')) {
    return event.respondWith(cacheFirst(req));
  }
  event.respondWith(staleWhileRevalidate(req, event));
});
`;

export function GET() {
  return new Response(source.trim() + '\n', {
    headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
  });
}
