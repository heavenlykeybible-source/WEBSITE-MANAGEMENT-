"use strict";
const SHELL = "hk-bible-shell-v66";
const SCRIPTURE = "hk-bible-kjv-ae1f46af-v1";
const PREFIX = new URL("./", self.location.href).pathname;
const SHELL_ASSETS = ["./index.html", "./strength-for-today.html", "./strength-devotionals-2026.json", "./strength-devotionals-2027-batch01.json", "./strength-devotionals-year1-batch02.json", "./strength-devotionals-year1-batch03.json", "./strength-devotionals-year1-batch04.json", "./strength-devotionals-year2-batch01.json", "./strength-devotionals-year2-batch02.json", "./strength-devotionals-year2-batch03.json", "./strength-devotionals-year2-batch04.json", "./strength-share-studio.js", "./ministry-logo.jpeg", "./style.css", "./reader-design.css", "./reader-design.js", "./shared/hk-standard-footer.css", "./fonts/NimbusRoman-Regular.otf", "./fonts/NimbusRoman-Bold.otf", "./fonts/NimbusRoman-Italic.otf", "./fonts/NimbusRoman-BoldItalic.otf", "./app.js", "./study-tools.js", "./strength-for-today.html", "./strength-share-studio.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./data/hymns.json", "./study-extensions.html", "./study-extensions.js", "./dictionary.json", "./daily-topics.json", "./daily-lessons.json", "./original-language-guide.json", "./read-pray-reminder.js", "./read-pray-push.js", "./data/annotations/GEN.json", "./data/annotations/EXO.json", "./data/annotations/MAT.json", "./data/annotations/MAR.json", "./data/annotations/JOH.json", "./data/annotations/center-references.json", "./shared/app-update.js", "./shared/hk-standard-footer.js", "./family-navigation.js", "./install/index.html", "./install/ipad/index.html", "./install/android/index.html", "./install/iphone/index.html", "./install/mac/index.html", "./install/windows/index.html", "./install/ipad/install.js", "./install/android/install.js", "./install/iphone/install.js", "./install/mac/install.js", "./install/windows/install.js"];
const SHELL_PRECACHE = [...new Set(SHELL_ASSETS.filter(asset=>!/^\.\/strength-devotionals.*\.json$/.test(asset)))];
// An offline install must include the core reader; optional resources can fail independently.
const CORE_OFFLINE = ["./index.html","./strength-for-today.html","./app.js","./style.css"];
const OPTIONAL_OFFLINE = SHELL_PRECACHE.filter(asset=>!CORE_OFFLINE.includes(asset));
const SHELL_PATHS = new Set([PREFIX,...SHELL_ASSETS.map(path=>new URL(path,self.location.href).pathname)]);
async function cachePublicOfflineAsset(cache,asset){
 const url=new URL(asset,self.location.href);
 const response=await fetch(url,{cache:"no-cache",credentials:"omit",redirect:"error"});
 if(!response.ok||response.type==="opaque")throw Error("Public offline asset unavailable");
 const directives=response.headers.get("Cache-Control")||"";
 const varies=response.headers.get("Vary")||"";
 if(/(?:^|,)\s*(?:private|no-store)(?:\s*(?:,|$)|\s*;)/i.test(directives)||/(?:^|,)\s*(?:cookie|authorization|\*)(?:\s*,|\s*$)/i.test(varies))throw Error("Sensitive asset excluded from offline storage");
 await cache.put(url,response);
}
self.addEventListener("install", event => {
 event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  try{
   await Promise.all(CORE_OFFLINE.map(asset=>cachePublicOfflineAsset(cache,asset)));
  }catch(error){
   await caches.delete(SHELL);
   throw new Error("Core Bible pages could not be cached for offline use", {cause:error});
  }
  const results=await Promise.allSettled(OPTIONAL_OFFLINE.map(asset=>cachePublicOfflineAsset(cache,asset)));
  const failed=results.filter(result=>result.status==="rejected");
  if(failed.length)console.warn("Some optional Bible offline resources were not cached:",failed.length);
 })());
});
self.addEventListener("activate", event => {
 event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith("hk-bible-")&&! [SHELL,SCRIPTURE].includes(key))await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener("fetch", event => {
 const url = new URL(event.request.url);
 if(event.request.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(PREFIX))return;
 const isAnnotation = url.pathname.startsWith(PREFIX+"data/annotations/") && ["GEN.json", "EXO.json", "MAT.json", "MAR.json", "JOH.json", "center-references.json"].some(name=>url.pathname===PREFIX+"data/annotations/"+name);
 const isScripture = url.pathname.startsWith(PREFIX+"data/kjv/");
 const isDevotionalDraftLibrary = SHELL_ASSETS.some(asset=>/^\.\/strength-devotionals.*\.json$/.test(asset)&&url.pathname===new URL(asset,self.location.href).pathname);
 const aliases={"/kingdom-quest":"kingdom-quest.html","/dictionary":"study-extensions.html","/concordance":"study-extensions.html","/study":"study-extensions.html","/daily-routine":"study-extensions.html"};
 const base=PREFIX.endsWith("/")?PREFIX.slice(0,-1):PREFIX;
 const relative=url.pathname===base?"/":url.pathname.startsWith(base+"/")?url.pathname.slice(base.length):url.pathname;
 const isShell = SHELL_PATHS.has(url.pathname)||Object.hasOwn(aliases,relative);
 if(!isScripture&&!isShell&&!isAnnotation)return;
 event.respondWith((async()=>{
  const cache=await caches.open(isScripture?SCRIPTURE:SHELL);
  // Always check the network for HTML navigation so an old cached page cannot hide updates.
  // Never substitute the Bible reader for Dictionary/Concordance when their page is unavailable.
  const navigation=event.request.mode==="navigate";
  const alias=aliases[relative];
  const fallback=alias?new URL(alias,self.location.href):null;
  let cached=(await cache.match(event.request))||(fallback?await cache.match(fallback):undefined);
  if(cached&&(isScripture||isAnnotation)&&!navigation)return cached;
  try{
   const response=await fetch(event.request,{cache:"no-cache"});
   // OWASP: Cache API does not honor private/no-store or Vary: Cookie automatically.
   const directives=response.headers.get("Cache-Control")||"";
   const varies=response.headers.get("Vary")||"";
   const sensitive=/(?:^|,)\s*(?:private|no-store)(?:\s*(?:,|$)|\s*;)/i.test(directives)
    ||/(?:^|,)\s*(?:cookie|authorization|\*)(?:\s*,|\s*$)/i.test(varies);
   if(sensitive){cached=undefined;try{await cache.delete(event.request);}catch{console.warn('Unable to remove sensitive cached response');}}

   // Credentialed requests can produce personalized responses even without explicit private headers.
   // Only anonymous runtime requests may populate the shared offline Cache API.
   const anonymousRequest=event.request.credentials==="omit";
   const setsCookie=response.headers.has("Set-Cookie");
   if(response.ok&&response.type!=="opaque"&&!sensitive&&!setsCookie&&anonymousRequest&&url.search===""&&!event.request.headers.has("Authorization")){
    let safeToCache=!isDevotionalDraftLibrary;
    if(isDevotionalDraftLibrary){
     try{
      const library=await response.clone().json();
      safeToCache=Array.isArray(library.entries)&&library.entries.length>0&&library.entries.every(entry=>entry.status==='approved-for-publication'&&Array.isArray(entry.topics)&&entry.topics.length===12&&entry.topics.every(topic=>topic.reviewStatus==='approved'));
     }catch{safeToCache=false;}
    }
    if(safeToCache){try{await cache.put(event.request,response.clone());}catch(cacheError){console.warn('Optional offline cache write failed; serving network response',cacheError);}}
   }
   // An unpublished, withdrawn, or invalid devotional must not be resurrected from offline storage.
   if(isDevotionalDraftLibrary){
    let approved=false;
    if(response.ok&&response.type!=='opaque'){
     try{const library=await response.clone().json();approved=Array.isArray(library.entries)&&library.entries.length>0&&library.entries.every(entry=>entry.status==='approved-for-publication'&&Array.isArray(entry.topics)&&entry.topics.length===12&&entry.topics.every(topic=>topic.reviewStatus==='approved'));}catch{}
    }
    if(!approved){cached=undefined;try{await cache.delete(event.request);}catch{console.warn('Unable to remove withdrawn devotional cache entry');}}
   }
   if(!response.ok&&cached)return cached;
   return response;
  }catch(error){if(cached)return cached;throw error;}
 })());
});
async function timedFetch(input, read) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{return await read(await fetch(input,{signal:controller.signal}));}
 finally{clearTimeout(timer);}
}
let download = null;
self.addEventListener("message", event=>{
 if(event.data?.type!=="SAVE_BIBLE_OFFLINE")return;
 // Accept storage-heavy offline download requests only from a window under this Bible application's scope.
 const source=event.source;
 if(!source||typeof source.url!=='string'||!event.ports?.length)return;
 let sourceUrl;
 try{sourceUrl=new URL(source.url);}catch{return;}
 if(sourceUrl.origin!==self.location.origin||!sourceUrl.pathname.startsWith(PREFIX))return;
 const port=event.ports[0];
 if(download){port?.postMessage({type:"busy"});return;}
 download=(async()=>{
  try{
   const manifest=await timedFetch(new URL("data/kjv/manifest.json",self.location.href),async response=>{
    if(!response.ok)throw new Error("Manifest unavailable");
    return response.json();
   });
   if(manifest.translation!=="KJV"||manifest.books?.length!==66||manifest.totalVerses!==31102||new Set(manifest.books.map(book=>book.code)).size!==66)throw new Error("Invalid scripture manifest");
   const cache=await caches.open(SCRIPTURE);
   const cachedManifest=await cache.match(new URL("data/kjv/manifest.json",self.location.href));
   if(cachedManifest){
    let allPresent=false;
    try{
     const previous=await cachedManifest.json();
     // A complete cached translation is current only when every expected book checksum matches the new manifest.
     allPresent=previous.translation===manifest.translation
      &&previous.totalVerses===manifest.totalVerses
      &&Array.isArray(previous.books)
      &&previous.books.length===manifest.books.length
      &&manifest.books.every((book,i)=>book.code===previous.books[i]?.code&&book.sha256===previous.books[i]?.sha256);
     if(allPresent)for(const book of manifest.books){
      const cachedBook=await cache.match(new URL("data/kjv/"+book.code+".json",self.location.href));
      if(!cachedBook){allPresent=false;break;}
      const buffer=await cachedBook.arrayBuffer();
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)),x=>x.toString(16).padStart(2,"0")).join("");
      if(digest!==book.sha256){allPresent=false;break;}
     }
    }catch{allPresent=false;}
    if(allPresent){port?.postMessage({type:"already-cached",count:66});return;}
   }
   let count=0;
   for(const book of manifest.books){
    if(!/^[A-Z0-9]{3}$/.test(book.code)||!/^[a-f0-9]{64}$/.test(book.sha256))throw new Error("Invalid book metadata");
    const url=new URL("data/kjv/"+book.code+".json",self.location.href);
    const {fetched,buffer}=await timedFetch(url,async fetched=>{
     if(!fetched.ok)throw new Error("Book unavailable");
     return {fetched,buffer:await fetched.clone().arrayBuffer()};
    });
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",buffer)),x=>x.toString(16).padStart(2,"0")).join("");
    if(hash!==book.sha256)throw new Error("Scripture checksum failed");
    await cache.put(url,fetched);port?.postMessage({type:"progress",count:++count,total:66});
   }
   await cache.put(new URL("data/kjv/manifest.json",self.location.href),new Response(JSON.stringify(manifest),{headers:{"Content-Type":"application/json"}}));
   port?.postMessage({type:"complete",count:66});
  }catch{port?.postMessage({type:"error",message:"Offline download could not finish. Check your connection and available storage, then try again."});}
 })().finally(()=>{download=null;});
 event.waitUntil(download);
});

self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL("daily-routine",self.location.href).href;for(const c of await self.clients.matchAll({type:"window",includeUncontrolled:true})){if(c.url.startsWith(new URL("./",self.location.href).href)&&"focus" in c){if("navigate" in c)await c.navigate(url);return c.focus();}}return self.clients.openWindow(url);})());});

// The browser invokes this only when a configured push service sends an event.
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{payload={};}
 if(payload.type!=='hk-read-pray-daily')return;
 const title='READ & PRAY DAILY ROUTINE';
 const options={body:'Have you prayed today? It’s time to read God’s Word and pray.',tag:'hk-read-pray-daily',icon:'./icon-192.png',data:{url:new URL('daily-routine',self.location.href).href}};
 event.waitUntil(self.registration.showNotification(title,options));
});
