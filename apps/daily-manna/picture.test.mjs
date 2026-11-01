import assert from 'node:assert/strict';
import worker from './worker.mjs';
const pictureRows=new Map(),objects=new Map(),audits=[];
const DB={prepare(sql){
 let args=[];
 return {bind(...v){args=v;return this},async first(){
  if(sql.includes('FROM manna_post_images')){const d=sql.includes("image_date=''")?'':args[0];return pictureRows.get(d)||null}
  return null
 },async run(){
  if(sql.startsWith('INSERT INTO manna_post_images')){pictureRows.set(args[0],{object_key:args[1],content_type:args[2]});return {meta:{changes:1}}}
  if(sql.startsWith('INSERT INTO manna_audit')){audits.push(args);return {meta:{changes:1}}}
  throw Error('Unexpected SQL '+sql)
 }};
}};
const MANNA_IMAGES={
 async put(k,bytes){objects.set(k,new Uint8Array(bytes))},
 async get(k){const b=objects.get(k);return b?{body:b}:null},
 async delete(k){objects.delete(k)}
};
const env={DB,MANNA_IMAGES,EDITOR_TOKEN:'secret'};
const png=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3]);
const upload=(date,bytes=png,headers={})=>worker.fetch(new Request('https://example.test/api/picture/'+date,{method:'PUT',headers:{authorization:'Bearer secret','content-type':'image/png',...headers},body:bytes}),env);
assert.equal((await upload('default')).status,200);
assert.equal(pictureRows.size,1);
assert.equal(audits.length,1);
let res=await worker.fetch(new Request('https://example.test/api/picture/default'),env);
assert.equal(res.status,200);
assert.equal(res.headers.get('content-type'),'image/png');
assert.deepEqual(new Uint8Array(await res.arrayBuffer()),png);
assert.equal((await upload('default',Uint8Array.from([1,2,3]))).status,400,'reject forged image');
assert.equal((await upload('default',png,{'content-type':'image/svg+xml'})).status,415,'reject SVG');
assert.equal((await worker.fetch(new Request('https://example.test/api/picture/default',{method:'PUT',headers:{'content-type':'image/png'},body:png}),env)).status,401,'no owner token');
const yesterday='2026-10-31';
assert.equal((await upload(yesterday)).status,200);
res=await worker.fetch(new Request('https://example.test/api/picture/'+yesterday),env);
assert.equal(res.status,200);
assert.equal((await worker.fetch(new Request('https://example.test/api/picture/2099-01-01'),env)).status,404,'future day pictures are private');
assert.equal((await upload('default')).status,200,'default can be replaced');
assert.equal(pictureRows.size,2);
console.log('PASS image upload, validation, default replacement, future privacy and delivery');
