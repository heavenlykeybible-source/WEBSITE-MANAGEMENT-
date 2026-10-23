const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),{webcrypto}=require("node:crypto");
async function run(tamper=false,stall=false,invalidManifest=false){
 const listeners={},stores=new Map(),messages=[];let online=true;
 const key=x=>typeof x==="string"?new URL(x,"https://example.test/bible/sw.js").href:x.url||x.href;
 const caches={keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k),open:async name=>{
  if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
  return{match:async x=>store.get(key(x))?.clone(),put:async(x,r)=>{store.set(key(x),r.clone());},addAll:async paths=>{for(const path of paths){const r=await fetcher(new URL(path,"https://example.test/bible/sw.js"));store.set(key(path),r);}}};
 }};
 const fetcher=async (input,options)=>{if(stall&&key(input).endsWith("/GEN.json"))return new Promise((_,reject)=>options.signal.addEventListener("abort",()=>reject(Error("Timed out")),{once:true}));if(!online)throw Error("Offline");const url=new URL(key(input));const path="heavenly-key-website"+url.pathname;let text=fs.readFileSync(path,"utf8");if(tamper&&path.endsWith("/GEN.json"))text=text.replace("In the beginning","Edited beginning");if(invalidManifest&&path.endsWith("manifest.json")){const manifest=JSON.parse(text);manifest.books[1]=manifest.books[0];text=JSON.stringify(manifest);}return new Response(text,{headers:{"Content-Type":path.endsWith(".json")?"application/json":"text/plain"}});};
 const self={location:{href:"https://example.test/bible/sw.js",origin:"https://example.test"},clients:{claim:async()=>{}},addEventListener:(name,handler)=>listeners[name]=handler};
 vm.runInNewContext(fs.readFileSync("heavenly-key-website/bible/sw.js","utf8"),{self,caches,fetch:fetcher,URL,Response,crypto:webcrypto,AbortController,setTimeout:stall?(fn)=>setTimeout(fn,1):setTimeout,clearTimeout});
 let pending;listeners.install({waitUntil:p=>pending=p});await pending;
 listeners.message({data:{type:"SAVE_BIBLE_OFFLINE"},ports:[{postMessage:m=>messages.push(m)}],waitUntil:p=>pending=p});await pending;
 if(tamper||stall||invalidManifest){assert.equal(messages.at(-1).type,"error");assert(!messages.some(m=>m.type==="complete"));tamper=false;stall=false;invalidManifest=false;
 listeners.message({data:{type:"SAVE_BIBLE_OFFLINE"},ports:[{postMessage:m=>messages.push(m)}],waitUntil:p=>pending=p});await pending;
 assert.equal(messages.at(-1).type,"complete","Failed download must allow retry");return;}
 assert.equal(messages.at(-1).type,"complete");assert.equal(messages.filter(m=>m.type==="progress").length,66);
 online=false;let responded;
 listeners.fetch({request:{url:"https://example.test/bible/data/kjv/JOH.json",method:"GET"},respondWith:p=>responded=p});assert.equal(JSON.parse(await(await responded).text()).book,"John");
 responded=undefined;listeners.fetch({request:{url:"https://example.test/api/auth/profile",method:"GET"},respondWith:p=>responded=p});assert.equal(responded,undefined);
 responded=undefined;listeners.fetch({request:{url:"https://another.test/bible/app.js",method:"GET"},respondWith:p=>responded=p});assert.equal(responded,undefined);
 responded=undefined;listeners.fetch({request:{url:"https://example.test/bible/index.html",method:"GET",mode:"navigate"},respondWith:p=>responded=p});assert((await(await responded).text()).includes("HEAVENLY KEY BIBLE"));
}
(async()=>{await run();await run(true);await run(false,true);await run(false,false,true);console.log("PASS: 66-book offline download, checksum rejection, stalled-network recovery, duplicate-manifest rejection, offline chapter/shell recovery and private API exclusion.");})().catch(e=>{console.error(e);process.exitCode=1;});
