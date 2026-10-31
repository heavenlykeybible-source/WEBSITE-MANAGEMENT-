import assert from 'node:assert/strict';
import {startPersistedPrivateImport,uploadPersistedPrivatePart} from '../scripts/account4-import-workflow.mjs';
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
