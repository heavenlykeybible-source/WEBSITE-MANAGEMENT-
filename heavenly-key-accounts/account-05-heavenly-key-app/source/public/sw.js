/* Only reviewed public shell assets are cached. Bible books and recordings are
 * saved separately by an explicit download action. No member/API cache. */
const RELEASE='local'; // stamped from the deployed Git commit during build
const CACHE='heavenly-key-app-shell-v10-'+RELEASE;
const SHELL=["/download/android/hk-approved-page-style-android-index.css","/download/hk-approved-page-style-download-index.css","/download/ipad/hk-approved-page-style-ipad-index.css","/download/iphone/hk-approved-page-style-iphone-index.css","/download/mac/hk-approved-page-style-mac-index.css","/download/windows/hk-approved-page-style-windows-index.css","/hk-approved-page-style-public-index.css","/cms-runtime-20261015.js","/cms-runtime-20261015.css",'/','/index.html','/styles.css','/app.js','/hk-standard-footer.js','/hk-standard-footer.css','/site-sync.js','/member.js','/platform.js','/install-app.js','/icon.svg','/manifest.webmanifest',
 '/icons/icon-192.svg','/icons/icon-512.svg','/icons/apple-touch-icon.svg',
 '/bible.html','/devotional.html','/hymns.html','/audio-bible.html','/audio-hymns.html',
 '/study-library.js','/study-library.css','/faith-content.js','/bible-catalog.js','/bible-mobile-controls.js','/kjv-manifest.json','/daily-reading-excerpts.json','/KJV-SOURCE-LICENSE.txt',
 '/audio-bible.js','/audio-bible-catalog.js','/audio-bible-manifest.json','/audio-background-catalog.js','/audio-background-manifest.json','/audio-playlist.js',
 '/audio-hymn-catalog.js','/audio-hymn-manifest.json','/audio-hymns.js','/audio-hymns.css','/featured-main-hymn.js','/lock-screen-media.js','/walk-offline.html','/walk-offline.js','/walk-offline-content.js','/offline-vault.js','/offline-status.js','/creation-to-eternity.html','/walk-offline.css','/creation-to-eternity.js','/creation-to-eternity.css','/offline-noscript.css'];
const PUBLIC=new Set(SHELL),READING=new Set(['/bible.html','/audio-bible.html']);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_REVIEWED_SHELL')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('heavenly-key-app-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!PUBLIC.has(url.pathname)||request.headers.has('Authorization'))return;
 if(url.search){
  if(!READING.has(url.pathname)||[...url.searchParams.keys()].some(key=>!['book','chapter'].includes(key))||
    url.searchParams.getAll('book').length>1||url.searchParams.getAll('chapter').length>1||
    url.searchParams.has('book')&&!/^[a-zA-Z0-9 -]{1,40}$/.test(url.searchParams.get('book'))||
    url.searchParams.has('chapter')&&!/^(?:[1-9]\d?|1[0-4]\d|150)$/.test(url.searchParams.get('chapter')))return;
 }
 const key=url.origin+url.pathname;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok&&!/(?:private|no-store)/i.test(response.headers.get('cache-control')||''))event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,response.clone())));
  return response;
 }).catch(async()=>{
  const cached=await caches.match(key);if(cached)return cached;
  if(request.mode==='navigate'&&(url.pathname==='/'||url.pathname==='/index.html'))return(await caches.match('/index.html'))||Response.error();
  return Response.error();
 }));
});

