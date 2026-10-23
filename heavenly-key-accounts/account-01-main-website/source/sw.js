/* Heavenly Key: offline public-shell cache. Never cache private or authenticated responses. */
const CACHE='hk-public-shell-v8-footer';
const SHELL=['/','/index.html','/css/home-renewal.css','/js/home-renewal.js','/assets/ministry/logo.png','/offline.html'];
const PUBLIC_PAGES=new Set(['/','/index.html','/offline.html','/pages/about.html','/pages/ministries.html','/pages/contact.html','/pages/resources.html','/pages/radio.html']);
const MAX_ENTRIES=90;
async function store(cache,req,res){await cache.put(req,res);const keys=await cache.keys();if(keys.length>MAX_ENTRIES)await cache.delete(keys[0]);}
const BLOCK=/(?:\/api\/|\/admin(?:\/|\b)|\/studio(?:\/|\b)|\/control(?:\/|\b)|\/login(?:\/|\b)|\/auth(?:\/|\b)|\/account(?:\/|\b)|\/profile(?:\/|\b)|\/messages?(?:\/|\b)|\/checkout(?:\/|\b))/i;
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE);await Promise.allSettled(SHELL.map(async path=>{const res=await fetch(path,{cache:'reload',credentials:'omit'});if(res.ok&&res.type==='basic')await store(cache,path,res)}));await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if((key.startsWith('hk-public-shell-')||/^hk-v[0-9]+/.test(key))&&key!==CACHE)await caches.delete(key);await self.clients.claim()})())});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||BLOCK.test(url.pathname)||req.headers.has('authorization')||req.headers.has('range')||req.credentials==='include'&&/(?:\/api\/|\/user\/)/.test(url.pathname))return;
 if(req.mode==='navigate'){
  if(!PUBLIC_PAGES.has(url.pathname))return;
  event.respondWith((async()=>{try{const res=await fetch(req);if(res.ok&&res.type==='basic'&&!res.headers.has('set-cookie')&&!/private|no-store/i.test(res.headers.get('cache-control')||'')){const cache=await caches.open(CACHE);await store(cache,req,res.clone())}return res}catch{return (await caches.match(req))||(await caches.match('/offline.html'))||Response.error()}})());return;
 }
 if(!/\.(?:css|js|png|jpg|jpeg|webp|svg|woff2?|ico)$/i.test(url.pathname))return;
 event.respondWith((async()=>{const cached=await caches.match(req);if(cached)return cached;try{const res=await fetch(req);if(res.ok&&res.type==='basic'&&!res.headers.has('set-cookie')&&!/private|no-store/i.test(res.headers.get('cache-control')||'')){const cache=await caches.open(CACHE);await cache.put(req,res.clone())}return res}catch{return Response.error()}})());
});

