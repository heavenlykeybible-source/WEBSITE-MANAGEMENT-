/* Only reviewed public shell assets are cached. Bible books and recordings are
 * saved separately by an explicit download action. No member/API cache. */
const RELEASE='account5-install-guide-offline-v2'; // stamped from the deployed Git commit during build
const CACHE='heavenly-key-app-shell-v11-'+RELEASE;
const SHELL=['/icons/walk-with-god-192.png','/icons/walk-with-god-512.png','/icons/daily-reading-192.png','/icons/daily-reading-512.png','/icons/bible-study-portal-192.png','/icons/bible-study-portal-512.png','/icons/hymns-192.png','/icons/hymns-512.png','/icons/public-assistant-192.png','/icons/public-assistant-512.png','/icons/eternity-in-view-192.png','/icons/eternity-in-view-512.png','/icons/bible-reader-192.png','/icons/bible-reader-512.png','/icons/audio-hymns-192.png','/icons/audio-hymns-512.png','/app-switcher.css','/icons/walk-with-god.svg','/icons/daily-reading.svg','/icons/bible-study-portal.svg','/icons/hymns.svg','/icons/public-assistant.svg','/icons/eternity-in-view.svg','/icons/bible-reader.svg','/icons/audio-hymns.svg','/hk-approved-footer.js','/hk-approved-footer.css',"/manifests/public-assistant.webmanifest","/manifests/walk-with-god.webmanifest","/manifests/eternity-in-view.webmanifest","/manifests/bible-study-portal.webmanifest","/manifests/bible-reader.webmanifest","/manifests/audio-bible.webmanifest","/manifests/hymns.webmanifest","/manifests/audio-hymns.webmanifest","/manifests/daily-reading.webmanifest","/manifests/all-in-one.webmanifest",'/app-downloads.json','/app-device-guide.js','/download/android/index.html','/download/iphone/index.html','/download/ipad/index.html','/download/windows/index.html','/download/mac/index.html','/assets/ministry/apps-laptop-approved.webp','/app-pages.css','/app-pages.js','/qr/android.svg','/qr/iphone.svg','/qr/ipad.svg','/qr/windows.svg','/qr/mac.svg','/premium-share.js','/premium-home.css','/premium-family-nav.js','/premium-download-options.js','/window-controls.js','/experience.html','/downloads.html','/assets/ministry/logo.png','/assets/ministry/hero-people-laptop.jpg','/assets/ministry/global-community-network.svg','/assets/ministry/rotating-world-land.svg',"/download/android/hk-approved-page-style-android-index.css","/download/hk-approved-page-style-download-index.css","/download/ipad/hk-approved-page-style-ipad-index.css","/download/iphone/hk-approved-page-style-iphone-index.css","/download/mac/hk-approved-page-style-mac-index.css","/download/windows/hk-approved-page-style-windows-index.css","/hk-approved-page-style-public-index.css","/cms-runtime-20261015.js","/cms-runtime-20261015.css",'/','/index.html','/styles.css','/app.js','/hk-standard-footer.js','/hk-standard-footer.css','/site-sync.js','/member.js','/platform.js','/install-app.js','/icon.svg','/manifest.webmanifest',
 '/icons/icon-192.svg','/icons/icon-512.svg','/icons/apple-touch-icon.svg',
 '/bible.html','/devotional.html','/hymns.html','/audio-bible.html','/audio-hymns.html',
 '/study-library.js','/study-library.css','/faith-content.js','/bible-catalog.js','/bible-mobile-controls.js','/kjv-manifest.json','/daily-reading-excerpts.json','/KJV-SOURCE-LICENSE.txt',
 '/audio-bible.js','/audio-bible-catalog.js','/audio-bible-manifest.json','/audio-background-catalog.js','/audio-background-manifest.json','/audio-playlist.js',
 '/audio-hymn-catalog.js','/audio-hymn-manifest.json','/audio-hymns.js','/audio-hymns.css','/featured-main-hymn.js','/lock-screen-media.js','/walk-offline.html','/walk-offline.js','/walk-offline-content.js','/offline-vault.js','/offline-status.js','/creation-to-eternity.html','/walk-offline.css','/creation-to-eternity.js','/creation-to-eternity.css','/offline-noscript.css'];
const PUBLIC=new Set(SHELL),READING=new Set(['/bible.html','/audio-bible.html']);
// Optional assets may be temporarily missing during deployment; never break the entire install.
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(async cache=>{
  const core=['/index.html','/app.js','/styles.css','/manifest.webmanifest'];
  for(const path of core){
   try{
    const response=await fetch(path,{cache:'no-store',credentials:'omit'});
    if(response.ok && response.type==='basic' && !/(?:private|no-store)/i.test(response.headers.get('cache-control')||'')) await cache.put(path,response);
   }catch{}
  }
  for(const path of SHELL.filter(path=>!core.includes(path))){
   try{
   const response=await fetch(path,{cache:'no-store',credentials:'omit'});
   if(response.ok && response.type==='basic' && !/(?:private|no-store)/i.test(response.headers.get('cache-control')||'')) await cache.put(path,response);
   }catch{}
  }
 }));
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_REVIEWED_SHELL')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('heavenly-key-app-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 const guide=/^\/download\/(?:android|iphone|ipad|windows|mac)\/$/.test(url.pathname);
 const cachePath=guide?url.pathname+'index.html':url.pathname;
 if(request.method!=='GET'||url.origin!==self.location.origin||!PUBLIC.has(cachePath)||request.headers.has('Authorization'))return;
 if(url.search && !( /^\/download\/(?:android|iphone|ipad|windows|mac)\/index\.html$/.test(cachePath) &&
   [...url.searchParams.keys()].every(key=>key==='app') && url.searchParams.getAll('app').length===1 && /^[a-z0-9-]{1,64}$/.test(url.searchParams.get('app')) )){
  if(!READING.has(url.pathname)||[...url.searchParams.keys()].some(key=>!['book','chapter'].includes(key))||
    url.searchParams.getAll('book').length>1||url.searchParams.getAll('chapter').length>1||
    url.searchParams.has('book')&&!/^[a-zA-Z0-9 -]{1,40}$/.test(url.searchParams.get('book'))||
    url.searchParams.has('chapter')&&!/^(?:[1-9]\d?|1[0-4]\d|150)$/.test(url.searchParams.get('chapter')))return;
 }
 const key=url.origin+cachePath;
 event.respondWith(fetch(request,{cache:"no-cache"}).then(response=>{
  if(response.ok && response.type==='basic' && !/(?:private|no-store)/i.test(response.headers.get('cache-control')||''))event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,response.clone())));
  return response;
 }).catch(async()=>{
  const cached=await caches.match(key);if(cached)return cached;
  if(request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html'))return(await caches.match('/index.html'))||Response.error();
  if(request.mode==='navigate' && /^\/download\/(?:android|iphone|ipad|windows|mac)\/?$/.test(url.pathname)) return (await caches.match(url.pathname.replace(/\/$/,'')+'/index.html')) || Response.error();
  return Response.error();
 }));
});

