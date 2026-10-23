import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {repairStudioSource} from '../scripts/radio/studio-repairs.mjs';
const sourcePath=process.argv[2];
if(!sourcePath)throw Error('Pass the deployed Studio module path.');
const context=vm.createContext({crypto,Request,Response,Headers,URL,TextEncoder,TextDecoder,AbortSignal,console,btoa,atob,fetch:()=>{throw Error('External calls are disabled during studio fixture checks')},setTimeout,clearTimeout});
const repaired=repairStudioSource(fs.readFileSync(sourcePath,'utf8'));
assert.equal(repairStudioSource(repaired.source).source,repaired.source,'Repairs must be safe to rerun');
const module=new vm.SourceTextModule(repaired.source+'\nexport {engine,assets};',{context});
await module.link(()=>{throw Error('Unexpected external source module')});await module.evaluate();
const {assets,engine}=module.namespace,worker=module.namespace.default;
const db=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('heavenly-key-accounts/account-02-studio-radio-tv-media/source/migrations').sort())db.exec(fs.readFileSync('heavenly-key-accounts/account-02-studio-radio-tv-media/source/migrations/'+file,'utf8'));
const kv=new Map();
const objects=new Map(),transfers=new Map();
const env={ADMIN_USERNAME:'fixture-owner',ADMIN_PASSWORD:'fixture-password',MEDIA_ENGINE_SHARED_SECRET:'fixture-secret-only-for-local-tests',LIVE_STATUS_KV:{get:async key=>kv.get(key)||null,put:async(key,value)=>kv.set(key,value),delete:async key=>kv.delete(key)},DB:{prepare(sql){let args=[];const query={bind(...values){args=values;return query},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {success:true,meta:{changes:result.changes,last_row_id:Number(result.lastInsertRowid)}}}};return query}},MEDIA_R2:{head:async()=>null,get:async()=>null}};
env.MEDIA_R2={
 async list(){return {objects:[...objects.keys()].map(key=>({key}))}},
 async head(key){return objects.get(key)||null},
 async get(key,options){const saved=objects.get(key);if(!saved)return null;const match=/bytes=(\d+)-(\d*)/.exec(options?.range?.get('Range')||'');if(match){const offset=Number(match[1]),length=Math.min(saved.size-offset,match[2]?Number(match[2])-offset+1:saved.size-offset);return {...saved,body:saved.body.slice(offset,offset+length),range:{offset,length}}}return saved},
 async createMultipartUpload(key){const uploadId='fixture-'+transfers.size;transfers.set(uploadId,{key,parts:new Map()});return {uploadId}},
 resumeMultipartUpload(key,id){const state=transfers.get(id);return {async uploadPart(part,bytes){state.parts.set(part,new Uint8Array(bytes));return {etag:'fixture-etag-'+part}},async complete(){const bytes=[...state.parts.values()].flatMap(x=>[...x]);objects.set(key,{size:bytes.length,body:new Uint8Array(bytes),httpEtag:'"fixture-etag"'})},async abort(){transfers.delete(id)}}}
};
const origin='https://studio.example';
async function request(path,{method='GET',body,cookie,originHeader,raw}={}){const headers={};if(body!==undefined)headers['Content-Type']=raw?'audio/mpeg':'application/json';if(cookie)headers.cookie=cookie;if(originHeader)headers.origin=originHeader;return worker.fetch(new Request(origin+path,{method,headers,...(body!==undefined?{body:raw?body:JSON.stringify(body)}:{})}),env,{});}
let response=await request('/');assert.equal(response.status,200);assert.match(await response.text(),/Sign in|Welcome back/);
response=await request('/pages/admin');assert.equal(response.status,303);assert.equal(response.headers.get('location'),origin+'/#live');
assert.equal((await request('/api/media-engine/capabilities')).status,401);
assert.equal((await request('/auth/password',{method:'POST',body:{user:'fixture-owner',pass:'fixture-password'},originHeader:'https://attacker.example'})).status,403);
assert.equal((await request('/auth/password',{method:'POST',body:{user:'fixture-owner',pass:'wrong'},originHeader:origin})).status,401);
response=await request('/auth/password',{method:'POST',body:{user:'fixture-owner',pass:'fixture-password'},originHeader:origin});assert.equal(response.status,303);
const cookie=response.headers.getSetCookie().find(x=>x.startsWith('__Host-hk-studio=')).split(';')[0];
assert.equal((await request('/api/studio/me',{cookie})).status,200);
response=await request('/',{cookie});const html=await response.text();assert.equal(response.status,200);assert.ok(!html.includes('<title>Sign in'));
const results=[];
for(const path of ['/api/media-engine/capabilities','/api/media-engine/studio/capabilities','/api/media-engine/diagnostics','/api/broadcast/settings','/api/broadcast/playlist-order','/api/media-engine/studio/preferences','/api/media','/api/playout','/api/broadcast/live','/api/media-engine/restream']){
 response=await request(path,{cookie});assert.equal(response.status,200,path);results.push({path,status:response.status});
}
response=await request('/api/broadcast/settings',{method:'POST',cookie,originHeader:origin,body:{channel:'radio',enabled:false}});assert.equal(response.status,200);
response=await request('/api/broadcast/settings',{method:'POST',cookie,originHeader:'https://attacker.example',body:{channel:'radio',enabled:true}});assert.equal(response.status,403);
response=await engine.fetch(new Request(origin+'/api/broadcast/programme?channel=radio',{headers:{'X-Heavenly-Key-Internal':'media-engine-public-v1'}}),env);assert.equal(response.status,200);assert.equal((await response.json()).mode,'offline');
const auth={cookie,originHeader:origin};
response=await request('/api/media',{method:'POST',...auth,body:{object_key:'uploads/fixture.mp3',media_type:'audio',mime_type:'audio/mpeg',size_bytes:1024,keep_media:true}});assert.equal(response.status,201);const id=(await response.json()).media_id;
assert.equal((await request(`/api/media/${id}/multipart`,{method:'POST',...auth,body:{}})).status,201);
assert.equal((await request(`/api/media/${id}/multipart/part/1`,{method:'PUT',...auth,body:new Uint8Array(1024),raw:true})).status,200);
assert.equal((await request(`/api/media/${id}/multipart/status`,{cookie})).status,200);
assert.equal((await request(`/api/media/${id}/multipart/complete`,{method:'POST',...auth,body:{}})).status,200);
assert.equal((await request(`/api/media/${id}/preview`,{cookie})).status,200);
assert.equal((await request(`/api/media/${id}/publish`,{method:'POST',...auth,body:{published:true}})).status,200);
assert.equal((await request(`/api/media/${id}/keep`,{method:'POST',...auth,body:{keep:false}})).status,409,'Published audio retention must be protected');
assert.equal((await request('/api/broadcast/settings',{method:'POST',...auth,body:{channel:'radio',enabled:true}})).status,200);
response=await engine.fetch(new Request(origin+'/api/broadcast/programme?channel=radio',{headers:{'X-Heavenly-Key-Internal':'media-engine-public-v1'}}),env);assert.equal((await response.json()).items[0].mediaId,id);
response=await engine.fetch(new Request(origin+`/api/broadcast/media/${id}/object`,{headers:{'X-Heavenly-Key-Internal':'media-engine-public-v1',Range:'bytes=0-99'}}),env);assert.equal(response.status,206);assert.equal((await response.arrayBuffer()).byteLength,100);
const apiLine=assets['/js/studio-app.js'].content.match(/const api=\(path,method='GET',data\)=>request\([^\n]+/)[0];
const apiContext=vm.createContext({request:(path)=>path});assert.equal(vm.runInContext(apiLine+'\napi("capabilities")',apiContext),'/api/media-engine/studio/capabilities');
const assetErrors=[];let scripts=0;
for(const [path,item]of Object.entries(assets))if(path.endsWith('.js')){scripts++;try{new vm.SourceTextModule(item.content,{context})}catch(e){assetErrors.push({path,error:e.message})}}
assert.deepEqual(assetErrors,[],'Every embedded studio script must parse');
assert.equal((await request('/auth/logout',{method:'POST',cookie,originHeader:origin})).status,204);
assert.equal((await request('/api/studio/me',{cookie})).status,401);
console.log(JSON.stringify({login:'passed',session:'passed',csrf:'passed',playlistSwitch:'passed',offlineProgramme:'passed',resumableUpload:'passed',preview:'passed',publish:'passed',retentionProtection:'passed',mediaRanges:'passed',frontendApiMapping:'passed',logout:'passed',scriptsChecked:scripts,apiResults:results},null,2));
db.close();
