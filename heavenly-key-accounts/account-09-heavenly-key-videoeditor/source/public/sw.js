'use strict';
// Cache only public editor code and brand assets. Account data and API
// responses must never enter CacheStorage.
const VERSION='hk-account9-offline-v1';
const CORE=['/','/index.html','/integrations.js','/ai-tools.js','/gateway-ui.js','/voice-enhance.js','/timeline.js','/voice-studio.js','/manifest.json','/assets/favicon.png','/assets/logo-256.png','/assets/logo-512.png'];
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
  if(url.origin!==self.location.origin||url.pathname==='/api'||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(async()=>{
      const cache=await caches.open(VERSION);
      return (await cache.match('/index.html'))||Response.error();
    }));
    return;
  }
  if(!CORE.includes(url.pathname))return;
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
});
