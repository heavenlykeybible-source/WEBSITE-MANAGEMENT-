// Keeps the app shell and pictures on the device so it opens fast and works on weak networks.
const C = 'ls-v2-accounts';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(['/', '/join.html', '/manifest.webmanifest'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  const keep = res => { const cp = res.clone(); caches.open(C).then(c => c.put(e.request, cp)); return res; };
  if (u.pathname.startsWith('/bg/') || u.pathname.startsWith('/icons/'))
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(keep)));
  else e.respondWith(fetch(e.request).then(keep).catch(() => caches.match(e.request)));
});
