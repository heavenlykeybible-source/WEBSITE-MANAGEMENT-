import assert from 'node:assert/strict';
import {startPersistedPrivateImport,uploadPersistedPrivatePart,finishPersistedPrivateImport} from '../scripts/account4-import-workflow.mjs';
const actor={id:7,authenticated:true,canImport:true};
let aborts=0,failSave=false,failAbort=false,creates=0;
const bucket={
  async createMultipartUpload(){creates++;return {uploadId:'u1'}},
  resumeMultipartUpload(){return {async abort(){aborts++;if(failAbort)throw new Error('R2 cleanup failed')}}}
};
const db={prepare(){return {bind(){return {async run(){if(failSave)throw new Error('D1 write failed');return {meta:{changes:1}}}}}}}};
const file={name:'backup.zip',size:11};
const started=await startPersistedPrivateImport(bucket,db,actor,file);
assert.equal(started.state,'uploading');
assert.equal(started.partCount,1);
assert.match(started.id,/^[a-f0-9-]{36}$/i);
assert.equal(aborts,0);
failSave=true;
await assert.rejects(startPersistedPrivateImport(bucket,db,actor,file),/D1 write failed/);
assert.equal(aborts,1,'A failed D1 save must abort its R2 multipart upload');
failAbort=true;
await assert.rejects(startPersistedPrivateImport(bucket,db,actor,file),e=>e instanceof AggregateError && e.errors.length===2);
assert.equal(aborts,2);
const before=creates;
await assert.rejects(startPersistedPrivateImport(bucket,db,{...actor,authenticated:false},file));
assert.equal(creates,before,'Unauthorized requests cannot create R2 multipart uploads');
console.log('PASS Account 4 private import workflow startup rollback');

// Verify no success response is returned if R2 succeeded but D1 receipt write failed.
let failReceipt=false,partUploads=0;
const partBucket={resumeMultipartUpload(){return {async uploadPart(n){partUploads++;return {partNumber:n,etag:'abc123'}}}}};
const expires=Date.now()+3600000;
const persistedRow={owner_id:7,object_key:'private-imports/7/test',upload_id:'u1',filename:'backup.zip',size_bytes:11,part_count:1,state:'uploading',expires_at_ms:expires};
const partDb={prepare(sql){return {bind(){return {
  async first(){return persistedRow},
  async all(){return {results:[]}},
  async run(){return {meta:{changes:failReceipt?0:1}}}
}}}}};
assert.deepEqual(await uploadPersistedPrivatePart(partBucket,partDb,actor,started.id,1,new Uint8Array(11)),{partNumber:1,stored:true});
assert.equal(partUploads,1);
failReceipt=true;
await assert.rejects(uploadPersistedPrivatePart(partBucket,partDb,actor,started.id,1,new Uint8Array(11)),/not persisted/);
assert.equal(partUploads,2);
await assert.rejects(uploadPersistedPrivatePart(partBucket,partDb,{...actor,id:8},started.id,1,new Uint8Array(11)));
assert.equal(partUploads,2,'Unauthorized actor must not upload a part');
console.log('PASS Account 4 durable part receipt acknowledgement');

let failTransition=false,deleteCount=0,completeCount=0;
const completionBucket={
 resumeMultipartUpload(){return {async complete(parts){completeCount++;assert.deepEqual(parts,[{partNumber:1,etag:'abc123'}]);return {size:11}}}},
 async delete(){deleteCount++}
};
const completionDb={prepare(sql){return {bind(){return {
 async first(){return persistedRow},
 async all(){return {results:[{part_number:1,etag:'abc123'}]}},
 async run(){return {meta:{changes:failTransition?0:1}}}
}}}}};
assert.deepEqual(await finishPersistedPrivateImport(completionBucket,completionDb,actor,started.id),{id:started.id,size:11,state:'private-awaiting-review'});
assert.equal(deleteCount,0);
failTransition=true;
await assert.rejects(finishPersistedPrivateImport(completionBucket,completionDb,actor,started.id),/transition denied/);
assert.equal(deleteCount,1,'Failed D1 state transition must delete completed private object');
assert.equal(completeCount,2);
await assert.rejects(finishPersistedPrivateImport(completionBucket,completionDb,{...actor,id:8},started.id));
assert.equal(completeCount,2,'Unauthorized actor cannot complete upload');
console.log('PASS Account 4 private completion D1 rollback');
