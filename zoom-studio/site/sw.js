// Cache only public application assets; never persist authenticated or private responses.
const CACHE = 'ls-v3-public-only';
const SHELL = ['/', '/join.html', '/manifest.webmanifest'];
const STATIC_PATH = /^(?:\/bg\/|\/icons\/)/;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
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
      request.mode === 'navigate' && url.pathname !== '/' && url.pathname !== '/join.html') return;
  if (url.pathname.startsWith('/api/') || request.headers.has('authorization') ||
      request.credentials === 'include' && !SHELL.includes(url.pathname)) return;
  const isShell = SHELL.includes(url.pathname);
  const isStatic = STATIC_PATH.test(url.pathname);
  if (!isShell && !isStatic) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (isStatic) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic' &&
          !response.headers.has('set-cookie') &&
          !/private|no-store/i.test(response.headers.get('cache-control') || '')) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});
