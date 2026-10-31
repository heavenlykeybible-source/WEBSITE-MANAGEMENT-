import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {account4PrivateImportRoutes} from '../scripts/account4-private-import-routes.mjs';

const workerSource=readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
assert.ok(workerSource.includes('function privateImportForm()'),'Resumable upload UI must be mounted');
assert.ok(workerSource.includes(String.raw`if(!/\\.zip$/i.test(selected.name)`),'UI must require a .zip filename');
assert.ok(workerSource.includes('10*1024*1024'),'UI must upload in bounded 10 MiB parts');
assert.ok(workerSource.includes('completedPartNumbers'),'UI must resume from server-confirmed completed parts');
assert.ok(workerSource.includes('awaits independent malware scanning'),'UI must not imply that private staging is publication-ready');
const owner={id:7,username:'owner',kind:'staff',role:'owner',status:'active'};
const other={...owner,id:8};
let session=null,parts=[],state='uploading',creates=0,uploaded=0,completed=0,missingSchema=false;
const auditEvents=[];
const bucket={
 async createMultipartUpload(key){creates++;return {uploadId:'r2-upload-1'};},
 resumeMultipartUpload(key,uploadId){assert.equal(uploadId,'r2-upload-1');return {
  async uploadPart(partNumber,bytes){uploaded++;return {partNumber,etag:'abc123'};},
  async complete(){completed++;return {size:11};},
  async abort(){return;}
 };},
 async head(key){return {key,size:11,version:'version-123456',etag:'a'.repeat(32)};}
};
const db={prepare(sql){let args=[];return {bind(...values){args=values;return this;},
 async all(){
  if(sql.includes('sqlite_master'))return {results:missingSchema?[]:[{name:'account4_import_sessions'},{name:'account4_import_parts'}]};
  if(sql.includes('account4_import_parts'))return {results:parts};
  if(sql.includes('SELECT s.id,s.filename'))return {results:session?[{...session,uploaded_parts:parts.length}]:[]};
  return {results:[]};
 },
 async first(){
  if(sql.includes('COUNT(*) AS count'))return {count:state==='uploading'?0:0};
  if(sql.includes('SELECT * FROM account4_import_sessions'))return session&&args[0]===session.id&&args[1]===session.owner_id?session:null;
  if(sql.includes('SELECT s.id,s.filename'))return session&&args[0]===session.id&&args[1]===session.owner_id?{...session,uploaded_parts:parts.length}:null;
  if(sql.includes('SELECT owner_id,object_key'))return session&&args[0]===session.id&&args[1]===session.owner_id?{owner_id:session.owner_id,object_key:session.object_key,size_bytes:session.size_bytes,state:session.state,expires_at_ms:session.expires_at_ms}:null;
  return null;
 },
 async run(){
  if(sql.startsWith('INSERT INTO account4_import_sessions')){session={id:args[0],owner_id:args[1],object_key:args[2],upload_id:args[3],filename:args[4],size_bytes:args[5],part_count:args[6],state:args[7],expires_at_ms:args[8],created_at:'2026-10-31 00:00:00'};state=session.state;return {success:true,meta:{changes:1}};}
  if(sql.startsWith('INSERT INTO account4_import_parts')){parts=[{part_number:args[0],etag:args[1]}];return {success:true,meta:{changes:1}};}
  if(sql.startsWith('UPDATE account4_import_sessions SET state=')){session.state=args[0];state=args[0];return {success:true,meta:{changes:1}};}
  return {success:true,meta:{changes:0}};
 }
};}},env={DB:db,FILES:bucket};
const call=(sub,method='GET',body,actor=owner,headers={})=>account4PrivateImportRoutes(
 new Request('https://control.test/api/owner/'+sub,{method,headers:{...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})}),
 env,actor,sub,method,(key,fn)=>fn(),(event,detail)=>auditEvents.push({event,detail}));

await assert.rejects(call('workspace/imports','GET',undefined,{...owner,role:'admin'}),e=>e.status===403);
await assert.rejects(call('workspace/imports','GET',undefined,{...owner,kind:'member'}),e=>e.status===403);
missingSchema=true;
await assert.rejects(call('workspace/imports','GET'),e=>e.status===503);
missingSchema=false;
await assert.rejects(call('workspace/imports','POST',{name:'backup.zip',size:1073741825}),/1 GiB/);
const startedResponse=await call('workspace/imports','POST',{name:'backup.zip',size:11});
assert.equal(startedResponse.status,201);
const started=await startedResponse.json();
assert.equal(started.state,'uploading');
assert.equal(creates,1);
assert.equal(started.partCount,1);
assert.equal(started.notice.includes('Private staging only'),true);
assert.equal(session.object_key.startsWith('private-imports/7/'),true);
assert.equal(session.state,'uploading');
assert.equal(auditEvents[0].event,'private-import-started');

const partResponse=await account4PrivateImportRoutes(new Request('https://control.test/api/owner/workspace/imports/'+started.id+'/parts/1',{method:'PUT',body:new Uint8Array(11)}),env,owner,'workspace/imports/'+started.id+'/parts/1','PUT');
assert.equal(partResponse.status,200);
assert.deepEqual(await partResponse.json(),{partNumber:1,stored:true});
assert.equal(uploaded,1);
await assert.rejects(account4PrivateImportRoutes(new Request('https://control.test/api/owner/workspace/imports/'+started.id+'/parts/1',{method:'PUT',body:new Uint8Array(10)}),env,owner,'workspace/imports/'+started.id+'/parts/1','PUT'));

const status=await call('workspace/imports/'+started.id);
const statusData=await status.json();
assert.equal(statusData.import.uploadedParts,1);
assert.deepEqual(statusData.import.completedPartNumbers,[1]);
assert.equal(JSON.stringify(statusData).includes('abc123'),false,'R2 ETags must never be exposed to the browser');
const wrongOwner=await call('workspace/imports/'+started.id,'GET',undefined,other);
assert.equal(wrongOwner.status,404);

const completedResponse=await call('workspace/imports/'+started.id+'/complete','POST');
assert.equal(completedResponse.status,200);
assert.equal((await completedResponse.json()).state,'private-awaiting-review');
assert.equal(completed,1);
assert.equal(session.state,'private-awaiting-review');
assert.ok(auditEvents.some(event=>event.event==='private-import-completed'));

const recovery=await call('workspace/imports/'+started.id+'/recovery');
assert.equal((await recovery.json()).matchesExpectedSize,true);
const publish=await call('workspace/imports/'+started.id+'/publish','POST');
assert.equal(publish.status,404,'There must be no direct publication route');
assert.equal(session.state,'private-awaiting-review');
assert.equal(completed,1);
console.log('PASS Account 4 owner-only private import routes, migration gate, bounded chunks, ownership isolation, completion and no-publication invariant');
