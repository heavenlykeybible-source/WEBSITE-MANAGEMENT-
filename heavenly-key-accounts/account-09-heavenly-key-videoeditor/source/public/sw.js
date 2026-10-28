'use strict';
// Cache only public editor code and brand assets. Account data and API
// responses must never enter CacheStorage.
const VERSION='hk-account9-offline-v9';
const CORE=['/','/index.html','/integrations.js','/offline-status.js','/ai-tools.js','/gateway-ui.js','/voice-enhance.js','/timeline.js','/voice-studio.js','/hk-approved-footer.js','/hk-approved-footer.css','/manifest.json','/assets/favicon.png','/assets/logo-256.png','/assets/logo-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hk-account9-offline-')&&k!==VERSION).map(k=>caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.search||request.headers?.has('authorization')||request.headers?.has('cookie')||url.pathname==='/api'||url.pathname.startsWith('/api/'))return;
  // Only the public editor entry point is safe to save as offline HTML.
  if(request.mode==='navigate'){
    if((url.pathname!=='/'&&url.pathname!=='/index.html')||url.search)return;
    event.respondWith(fetch(request).then(response=>{
      if(response.ok&&response.type!=='opaque'&&!response.headers.has('set-cookie')&&!/private|no-store/i.test(response.headers.get('cache-control')||'')){
        const copy=response.clone();
        event.waitUntil(caches.open(VERSION).then(cache=>cache.put('/index.html',copy)));
      }
      return response;
    }).catch(async()=>{
      const cache=await caches.open(VERSION);
      return (await cache.match('/index.html'))||Response.error();
    }));
    return;
  }
  if(!CORE.includes(url.pathname))return;
  event.respondWith(caches.open(VERSION).then(async cache=>{
    const cached=await cache.match(request);
    const fresh=fetch(request).then(response=>{
      if(response.ok&&response.type!=='opaque'&&!response.headers.has('set-cookie')&&!/private|no-store/i.test(response.headers.get('cache-control')||''))event.waitUntil(cache.put(request,response.clone()));
      return response;
    }).catch(()=>null);
    if(cached){event.waitUntil(fresh);return cached}
    return (await fresh)||Response.error();
  }));
});
