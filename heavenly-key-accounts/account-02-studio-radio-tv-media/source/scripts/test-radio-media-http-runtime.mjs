import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(resolve(root,p),'utf8');
const compile=p=>ts.transpileModule(read(p).replace(/^import .*;\s*$/gm,'').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const combined=['src/radio-byte-range.ts','src/radio-http-validators.ts','src/public-broadcast.ts'].map(compile).join('\n');
const runtime=runInNewContext(combined+';({serveBroadcastMedia})',{Response,Request,Headers,URL,console});
const media={media_id:11,object_key:'radio/approved.mp3',media_type:'audio',mime_type:'audio/mpeg',status:'published'};
let current=media,reads=0,heads=0;
const bytes=new Uint8Array(100).map((_,i)=>i);
const env={
 DB:{prepare:()=>({bind(){return this},async first(){return current}})},
 MEDIA_R2:{
  async head(){heads++;return {size:bytes.length,httpEtag:'"record-v1"'}},
  async get(_key,options){reads++;const start=options?.range?.offset??0;const end=start+(options?.range?.length??bytes.length);return {body:new Response(bytes.slice(start,end)).body}}
 }
};
const request=(method='GET',headers={})=>new Request('https://radio.example/api/broadcast/media/11/object',{method,headers});
const serve=(method,headers)=>runtime.serveBroadcastMedia(request(method,headers),env,11);
let r=await serve('GET');
assert.equal(r.status,200);assert.equal(r.headers.get('Content-Length'),'100');assert.equal((await r.arrayBuffer()).byteLength,100);
r=await serve('GET',{Range:'bytes=10-19'});
assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 10-19/100');
assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[10,11,12,13,14,15,16,17,18,19]);
r=await serve('HEAD',{Range:'bytes=-5'});
assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 95-99/100');assert.equal(r.headers.get('Content-Length'),'5');
r=await serve('GET',{Range:'bytes=100-'});
assert.equal(r.status,416);assert.equal(r.headers.get('Content-Range'),'bytes */100');
const before=reads;
r=await serve('GET',{'If-None-Match':'W/"record-v1"'});
assert.equal(r.status,304);assert.equal(reads,before,'304 must not read R2 body');
r=await serve('GET',{Range:'bytes=4-8','If-Range':'W/"record-v1"'});
assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,100,'Weak If-Range must receive full audio');
r=await serve('GET',{Range:'bytes=4-8','If-Range':'"record-v1"'});
assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,5,'Strong matching If-Range must resume audio');
current=null;const count=heads;
r=await serve('GET');assert.equal(r.status,404);assert.equal(heads,count,'Unavailable media must not access storage');
current={...media,media_type:'video'};r=await serve('GET');assert.equal(r.status,423,'TV video must remain locked');
console.log('Account 2 actual radio HTTP handler tested: full, ranged, HEAD, 304, 416, resume, unpublished, TV lock');
