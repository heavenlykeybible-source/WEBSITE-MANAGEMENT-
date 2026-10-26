// Public static assets only. Meeting pages, invitations, and credentials are never stored.
const CACHE = 'ls-v4-static-only';
const PRECACHE = ['/manifest.webmanifest'];
const STATIC_PATH = /^(?:\/bg\/|\/icons\/)/;
const PUBLIC_ASSETS = new Set(['/manifest.webmanifest','/studio-theme.css']);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(PRECACHE.map(path => new Request(path,{credentials:'omit'}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith('ls-') && key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      request.mode === 'navigate' || url.search ||
      request.headers.has('authorization') || request.credentials === 'include' ||
      url.pathname.startsWith('/api/')) return;
  if (!STATIC_PATH.test(url.pathname) && !PUBLIC_ASSETS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(url.pathname);
    if (cached) return cached;
    const response = await fetch(new Request(request,{credentials:'omit'}));
    if (response.ok && response.type === 'basic' &&
        !response.headers.has('set-cookie') &&
        !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
      await cache.put(url.pathname, response.clone());
    }
    return response;
  })());
});
