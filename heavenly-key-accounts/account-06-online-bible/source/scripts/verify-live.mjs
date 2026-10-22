import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const base=new URL(process.argv[2]||"");
assert.equal(base.protocol,"https:","Pass the verified HTTPS Bible Worker URL.");
const requireMedia=process.argv.includes("--require-media");
async function get(path){const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(20000)});assert(response.ok,path+" returned HTTP "+response.status);return response;}
const html=await(await get("./index.html")).text();assert(html.includes("<title>HEAVENLY KEY BIBLE</title>"));
for(const path of ["./app.js","./study-tools.js","./style.css","./sw.js","./manifest.webmanifest","./icon-192.png","./icon-512.png"]){assert((await(await get(path)).arrayBuffer()).byteLength>0);}
const health=await(await get("./health")).json();assert.equal(health.product,"HEAVENLY KEY BIBLE");
const manifest=await(await get("./data/kjv/manifest.json")).json();assert.equal(manifest.translation,"KJV");assert.equal(manifest.books.length,66);assert.equal(manifest.totalVerses,31102);
let chapterCount=0,verseCount=0;
for(let start=0;start<66;start+=4){
 await Promise.all(manifest.books.slice(start,start+4).map(async book=>{
  const buffer=Buffer.from(await(await get("./data/kjv/"+book.code+".json")).arrayBuffer());
  assert.equal(createHash("sha256").update(buffer).digest("hex"),book.sha256,book.name+" live checksum");
  const data=JSON.parse(buffer);assert.equal(data.book,book.name);assert.equal(Object.keys(data.chapters).length,book.chapters);
  for(const verses of Object.values(data.chapters)){chapterCount++;verseCount+=verses.length;verses.forEach((v,i)=>{assert.equal(v.number,i+1);assert.equal(v.isPlaceholder,false);assert(v.text);});}
 }));
}
assert.equal(chapterCount,1189);assert.equal(verseCount,31102);
const chapterApi=await(await get("./api/bible/John/3")).json();assert.equal(chapterApi.translation,"KJV");assert(chapterApi.verses[15].text.includes("For God so loved the world"));
const classics=await(await get("./data/hymns.json")).json();assert.equal(classics.items.length,3);
const hymns=await(await get("./api/hymns")).json(),gospel=await(await get("./api/media?topic=gospel-music")).json();
assert.equal(hymns.success,true);assert.equal(gospel.success,true);
assert(Array.isArray(hymns.items)&&Array.isArray(gospel.items));
for(const path of ["./api/auth/profile","./api/admin/media"]){const response=await fetch(new URL(path,base));assert.equal(response.status,404,"Private route must not be exposed");}
if(requireMedia){assert(hymns.items.some(x=>x.playbackUrl),"No published hymn recordings");assert(gospel.items.some(x=>["audio","video"].includes(x.file_type)),"No published gospel recordings");}
console.log("LIVE CHECK PASSED: Bible assets, all scripture checksums, classic hymns, public APIs and private route exclusion.");
console.log("Published ministry collections: "+hymns.items.length+" hymn(s), "+gospel.items.length+" gospel item(s).");
if(!requireMedia)console.log("Media population was reported, not required. Use --require-media before claiming a populated media launch.");
