import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../scripts/account4-large-upload-runtime.mjs',import.meta.url),'utf8');
const settings=new Map(),uploads=new Map(),objects=new Map();
const bucket={
 async createMultipartUpload(key){
  const uploadId='u'+uploads.size;
  uploads.set(uploadId,{key,parts:new Map(),aborted:false});
  return {uploadId};
 },
 resumeMultipartUpload(key,id){
  const item=uploads.get(id);
  if(!item||item.key!==key||item.aborted)throw Error('Unknown upload');
  return {
   async uploadPart(n,bytes){item.parts.set(n,new Uint8Array(bytes));return {partNumber:n,etag:'etag-'+n};},
   async complete(parts){assert.equal(parts.length,item.parts.size);const size=[...item.parts.values()].reduce((n,v)=>n+v.byteLength,0);objects.set(key,{size});return {size,httpEtag:'test-etag'};},
   async abort(){item.aborted=true;},
  };
 },
 async delete(key){objects.delete(key);}
};
const db={prepare(sql){return{bind(...args){return {
 async all(){if(sql.includes('WHERE key LIKE'))return {results:[...settings].filter(([k])=>k.startsWith(String(args[0]).slice(0,-1))).map(([key,value_json])=>({key,value_json}))};throw Error('Unexpected all query');},
 async first(){return settings.has(args[0])?{value_json:settings.get(args[0])}:null;},
 async run(){if(sql.includes('INSERT INTO settings'))settings.set(args[0],args[1]);else if(sql.includes('UPDATE settings'))settings.set(args[1],args[0]);else throw Error('Unexpected mutation');return {success:true};}
 };}};}};
const ctx={crypto:webcrypto,env:{FILES:bucket,DB:db},Date,Number,Array,Object,String,Math,JSON,Set,Map,Uint8Array,console,
 json:(payload)=>payload,fail:(msg,status)=>{throw Object.assign(Error(msg),{status});},
 body:async req=>req.payload,readLimited:async req=>req.bytes,
 withOperationLock:async(_env,_key,fn)=>fn(),audit:async()=>{}};
vm.runInNewContext(source+'\nthis.route=account4MultipartRoutes;',ctx);
const owner={id:4,role:'owner',kind:'staff'},member={id:5,role:'viewer',kind:'member'};
const dispatch=(who,sub,method,payload,bytes)=>ctx.route({url:'https://local/api/owner/'+sub,payload,bytes,headers:new Headers({'content-type':'application/octet-stream'})},ctx.env,who,sub,method);
await assert.rejects(()=>dispatch(member,'multipart/create','POST',{name:'sample.bin',size:1024}),/owner/);
await assert.rejects(()=>dispatch(owner,'multipart/create','POST',{name:'large.bin',size:1024*1024*1024+1}),/1 GiB/);
await assert.rejects(()=>dispatch(owner,'multipart/create','POST',{name:'../bad',size:100}),/safe filename/);
const size=8*1024*1024+2048;
const session=await dispatch(owner,'multipart/create','POST',{name:'sample.bin',size});
assert.equal(session.parts,2);assert.equal(session.part_size,8*1024*1024);
await assert.rejects(()=>dispatch(member,'multipart/'+session.id+'/status','GET'),/owner/);
await dispatch(owner,'multipart/'+session.id+'/part/1','PUT',null,new Uint8Array(8*1024*1024));
await assert.rejects(()=>dispatch(owner,'multipart/'+session.id+'/finish','POST'),/Every upload part/);
await assert.rejects(()=>dispatch(owner,'multipart/'+session.id+'/part/2','PUT',null,new Uint8Array(2047)),/Incorrect chunk size/);
await dispatch(owner,'multipart/'+session.id+'/part/2','PUT',null,new Uint8Array(2048));
const status=await dispatch(owner,'multipart/'+session.id+'/status','GET');
assert.deepEqual(Array.from(status.received),[1,2]);
const result=await dispatch(owner,'multipart/'+session.id+'/finish','POST');
assert.equal(result.status,'staged');assert.equal(result.size,size);
await assert.rejects(()=>dispatch(owner,'multipart/'+session.id+'/part/1','PUT',null,new Uint8Array(8*1024*1024)),/no longer accepting/);
const another=await dispatch(owner,'multipart/create','POST',{name:'cancel.bin',size:4096});
const cancelled=await dispatch(owner,'multipart/'+another.id+'/abort','POST');
assert.equal(cancelled.status,'aborted');
assert.equal(objects.size,1);
console.log('PASS simulated multipart create, authorization, oversize, chunk integrity, resume, finish and abort');
