import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const source=await readFile(new URL("../worker.js",import.meta.url),"utf8");
const worker=(await import("data:text/javascript;base64,"+Buffer.from(source).toString("base64"))).default;
const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({success:true,items:[]});};
const env={ASSETS:{fetch:async request=>{
 const path=new URL(request.url).pathname;
 try{return new Response(await readFile(new URL("../../heavenly-key-website/bible/"+(path==="/"?"index.html":path.slice(1)),import.meta.url)));}catch{return new Response("Not found",{status:404});}
}}};
assert.equal((await worker.fetch(new Request("https://bible.test/health"),env)).status,200);
assert.equal((await worker.fetch(new Request("https://bible.test/"),env)).status,200);
for(const path of ["/api/auth/profile","/api/admin/media","/api/media?topic=private","/api/bible/audio?chapterId=-1","/api/bible/%2Fadmin/1"]){assert.equal((await worker.fetch(new Request("https://bible.test"+path),env)).status,404);}
assert.equal((await worker.fetch(new Request("https://bible.test/api/hymns",{method:"POST"}),env)).status,405);
await worker.fetch(new Request("https://bible.test/api/hymns",{headers:{Cookie:"private-session",Authorization:"Bearer secret"}}),env);
assert.equal(calls.at(-1).url,"https://heavenlykey.alldaywow247.workers.dev/api/hymns");
assert.equal(calls.at(-1).options.headers.has("Cookie"),false);assert.equal(calls.at(-1).options.headers.has("Authorization"),false);
await worker.fetch(new Request("https://bible.test/api/media/3/object",{headers:{Range:"bytes=0-20"}}),env);
assert.equal(calls.at(-1).options.headers.get("Range"),"bytes=0-20");
assert.equal((await worker.fetch(new Request("https://bible.test/api/media/3/object",{method:"HEAD"}),env)).body,null);
const chapter=await(await worker.fetch(new Request("https://bible.test/api/bible/John/3"),env)).json();
assert.equal(chapter.translation,"KJV");assert(chapter.verses[15].text.includes("For God so loved the world"));
assert.equal((await worker.fetch(new Request("https://bible.test/api/bible/John/22"),env)).status,404);
assert.equal((await worker.fetch(new Request("https://bible.test/api/bible/John/3",{method:"HEAD"}),env)).body,null);
globalThis.fetch=async()=>Response.json({success:true,items:[{sourceLabel:"KJV",playbackUrl:"/api/media/1/object"},{sourceLabel:"NKJV"},{sourceLabel:"KJV and NIV"},{sourceLabel:"Ministry audio"},{sourceLabel:"KJV",translation:"NIV"},{sourceLabel:"King James (Authorized) Version"}]});
const audio=await(await worker.fetch(new Request("https://bible.test/api/bible/audio?chapterId=1"),env)).json();
assert.equal(audio.items.length,2);assert(audio.items.every(item=>item.translation==="KJV"));
globalThis.fetch=async()=>{throw Error("Media unavailable");};
const standalone=await(await worker.fetch(new Request("https://bible.test/api/bible/John/3?metadata=1"),env)).json();assert.equal(standalone.success,true);assert.equal(standalone.translation,"KJV");
assert.equal((await worker.fetch(new Request("https://bible.test/api/hymns"),env)).status,502);
console.log("PASS: Bible Worker assets, health, public allowlist, write rejection, credential isolation, range/HEAD forwarding, KJV-only chapter/audio responses and upstream failures.");

assert.equal((await worker.fetch(new Request("https://bible.test/health",{method:"HEAD"}),env)).body,null);
for(const path of ["/health","/","/index.html"]){const response=await worker.fetch(new Request("https://bible.test"+path,{method:"POST"}),env);assert.equal(response.status,405);assert.equal(response.headers.get("Allow"),"GET, HEAD");}
let configuredUrl;
globalThis.fetch=async url=>{configuredUrl=url;return Response.json({success:true,items:[]});};
await worker.fetch(new Request("https://bible.test/api/hymns"),{...env,MINISTRY_PUBLIC_API_ORIGIN:"https://central.example"});
assert.equal(configuredUrl,"https://central.example/api/hymns");
for(const origin of ["http://central.example","https://user:pass@central.example","https://central.example/private","https://central.example/?secret=1"]){configuredUrl=null;assert.equal((await worker.fetch(new Request("https://bible.test/api/hymns"),{...env,MINISTRY_PUBLIC_API_ORIGIN:origin})).status,502);assert.equal(configuredUrl,null);}
console.log("PASS: read-only methods, health HEAD and validated migration-ready public media origin.");
