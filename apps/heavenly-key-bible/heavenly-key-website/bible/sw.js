"use strict";
const SHELL = "hk-bible-shell-v41";
const SCRIPTURE = "hk-bible-kjv-ae1f46af-v1";
const PREFIX = new URL("./", self.location.href).pathname;
const SHELL_ASSETS = ["./index.html", "./ministry-logo.jpeg", "./style.css", "./reader-design.css", "./reader-design.js", "./shared/hk-standard-footer.css", "./fonts/NimbusRoman-Regular.otf", "./fonts/NimbusRoman-Bold.otf", "./fonts/NimbusRoman-Italic.otf", "./fonts/NimbusRoman-BoldItalic.otf", "./app.js", "./study-tools.js", "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png", "./data/hymns.json", "./study-extensions.html", "./study-extensions.js", "./dictionary.json", "./daily-topics.json", "./daily-lessons.json", "./original-language-guide.json", "./read-pray-reminder.js", "./read-pray-push.js", "./kingdom-quest.html", "./kingdom-quest.css", "./kingdom-quest.js", "./kingdom-quest-questions.json", "./data/annotations/GEN.json", "./data/annotations/EXO.json", "./data/annotations/MAT.json", "./data/annotations/MAR.json", "./data/annotations/JOH.json", "./data/annotations/center-references.json", "./shared/app-update.js", "./shared/hk-standard-footer.js", "./family-navigation.js", "./install/index.html", "./install/ipad/index.html", "./install/android/index.html", "./install/iphone/index.html", "./install/mac/index.html", "./install/windows/index.html", "./install/ipad/install.js", "./install/android/install.js", "./install/iphone/install.js", "./install/mac/install.js", "./install/windows/install.js"];
const SHELL_PATHS = new Set([PREFIX,...SHELL_ASSETS.map(path=>new URL(path,self.location.href).pathname)]);
self.addEventListener("install", event => {
 event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(SHELL_ASSETS)));
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
 const aliases={"/kingdom-quest":"kingdom-quest.html","/dictionary":"study-extensions.html","/concordance":"study-extensions.html","/study":"study-extensions.html","/daily-routine":"study-extensions.html"};
 const base=PREFIX.endsWith("/")?PREFIX.slice(0,-1):PREFIX;
 const relative=url.pathname.startsWith(base)?url.pathname.slice(base.length):url.pathname;
 const isShell = SHELL_PATHS.has(url.pathname)||Object.hasOwn(aliases,relative);
 if(!isScripture&&!isShell&&!isAnnotation)return;
 event.respondWith((async()=>{
  const cache=await caches.open(isScripture?SCRIPTURE:SHELL);
  // Always check the network for HTML navigation so an old cached page cannot hide updates.
  // Never substitute the Bible reader for Dictionary/Concordance when their page is unavailable.
  const navigation=event.request.mode==="navigate";
  const alias=aliases[relative];
  const fallback=alias?new URL(alias,self.location.href):null;
  const cached=(await cache.match(event.request))||(fallback?await cache.match(fallback):undefined);
  if(cached&&!navigation)return cached;
  try{
   const response=await fetch(event.request);
   if(response.ok&&response.type!=="opaque")await cache.put(event.request,response.clone());
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
 const port=event.ports[0];
 if(download){port?.postMessage({type:"busy"});return;}
 download=(async()=>{
  try{
   const manifest=await timedFetch(new URL("data/kjv/manifest.json",self.location.href),async response=>{
    if(!response.ok)throw new Error("Manifest unavailable");
    return response.json();
   });
   if(manifest.translation!=="KJV"||manifest.books?.length!==66||manifest.totalVerses!==31102||new Set(manifest.books.map(book=>book.code)).size!==66)throw new Error("Invalid scripture manifest");
   const cache=await caches.open(SCRIPTURE);let count=0;
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

self.addEventListener("notificationclick",event=>{event.notification.close();event.waitUntil((async()=>{const url=new URL("study-extensions.html",self.location.href).href;for(const c of await self.clients.matchAll({type:"window",includeUncontrolled:true})){if(c.url.startsWith(new URL("./",self.location.href).href)&&"focus" in c){if("navigate" in c)await c.navigate(url);return c.focus();}}return self.clients.openWindow(url);})());});

// The browser invokes this only when a configured push service sends an event.
self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{payload={};}
 if(payload.type!=='hk-read-pray-daily')return;
 const title='READ & PRAY DAILY ROUTINE';
 const options={body:'Have you prayed today? It’s time to read God’s Word and pray.',tag:'hk-read-pray-daily',icon:'./icon-192.png',data:{url:new URL('study-extensions.html',self.location.href).href}};
 event.waitUntil(self.registration.showNotification(title,options));
});
