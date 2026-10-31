import assert from 'node:assert/strict';
import {startPersistedPrivateImport} from '../scripts/account4-import-workflow.mjs';
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
