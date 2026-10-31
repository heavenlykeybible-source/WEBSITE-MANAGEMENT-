import assert from 'node:assert/strict';
import {beginPrivateImport,uploadPrivatePart,completePrivateImport,abortPrivateImport} from '../scripts/account4-r2-multipart.mjs';
const actor={id:7,authenticated:true,canImport:true},other={...actor,id:8};
const uploads=[];
let completedSize=11;
const deleted=[];
let receiptOverride=null;
const bucket={
 async createMultipartUpload(key){uploads.push(key);return {uploadId:'u1'}},
 resumeMultipartUpload(key,id){assert.equal(id,'u1');assert.equal(key,uploads.at(-1));return {
  async uploadPart(partNumber,bytes){return receiptOverride ?? {partNumber,etag:'abc123'}},
  async complete(parts){return {size:completedSize}},
  async abort(){}
 }}
};
bucket.delete=async key=>{deleted.push(key)};
const session=await beginPrivateImport(bucket,actor,{name:'backup.zip',size:11});
assert.equal(session.state,'uploading');
for (const invalidUploadId of [undefined,'',null,23]) {
  const originalCreate=bucket.createMultipartUpload;
  bucket.createMultipartUpload=async()=>({uploadId:invalidUploadId});
  await assert.rejects(beginPrivateImport(bucket,actor,{name:'backup.zip',size:11}),/valid upload identifier/);
  bucket.createMultipartUpload=originalCreate;
}
for (const invalidActor of [null, {}, {id:7,authenticated:true}, {id:7,canImport:true}, {...actor,id:0}, {...actor,id:-1}, {...actor,id:'7'}]) {
  await assert.rejects(beginPrivateImport(bucket,invalidActor,{name:'backup.zip',size:11}));
  await assert.rejects(uploadPrivatePart(bucket,invalidActor,session,1,new Uint8Array(11)));
  await assert.rejects(completePrivateImport(bucket,invalidActor,session,[{partNumber:1,etag:'abc123'}]));
  await assert.rejects(abortPrivateImport(bucket,invalidActor,session));
}
for (const invalid of [{size:0},{size:1073741825},{size:11,partCount:2},{expiresAt:Infinity},{expiresAt:1.5}]) {
  const bad={...session,...invalid};
  await assert.rejects(uploadPrivatePart(bucket,actor,bad,1,new Uint8Array(11)),/session invalid/);
  await assert.rejects(completePrivateImport(bucket,actor,bad,[{partNumber:1,etag:'abc123'}]),/session invalid/);
}
await assert.rejects(uploadPrivatePart(bucket,other,session,1,new Uint8Array(11)));
assert.deepEqual(await uploadPrivatePart(bucket,actor,session,1,new Uint8Array(11)),{partNumber:1,etag:'abc123'});
for (const badReceipt of [null,{partNumber:2,etag:'abc123'},{partNumber:1,etag:''},{partNumber:1,etag:'bad receipt'},{partNumber:1,etag:33}]) {
  receiptOverride=badReceipt;
  // Explicitly model null as a malformed storage response rather than defaulting.
  if (badReceipt === null) receiptOverride={partNumber:1};
  await assert.rejects(uploadPrivatePart(bucket,actor,session,1,new Uint8Array(11)),/Invalid R2 upload part receipt/);
}
receiptOverride=null;
await assert.rejects(completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'abc123'}]),/server-side upload record/);
session.parts[1]='abc123';
await assert.rejects(completePrivateImport(bucket,actor,session,[]));
assert.deepEqual(await completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'abc123'}]),{key:session.key,size:11,state:'private-awaiting-review'});
assert.deepEqual(await abortPrivateImport(bucket,actor,session),{state:'aborted'});

// An expired or completed session must not allow another part or completion.
await assert.rejects(uploadPrivatePart(bucket,actor,{...session,expiresAt:0},1,new Uint8Array(11)));
await assert.rejects(completePrivateImport(bucket,actor,{...session,state:'private-awaiting-review'},[{partNumber:1,etag:'abc123'}]));
await assert.rejects(completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'forged123'}]),/server-side upload record/);
await assert.rejects(uploadPrivatePart(bucket,actor,{...session,key:'private-imports/8/forged'},1,new Uint8Array(11)));
// All parts must be present exactly once; client-controlled duplicate metadata is rejected.
await assert.rejects(completePrivateImport(bucket,actor,{...session,partCount:2},[{partNumber:1,etag:'abc123'},{partNumber:1,etag:'abc123'}]));
completedSize=10;
await assert.rejects(completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'abc123'}]),/size mismatch/);
assert.deepEqual(deleted,[session.key]);
completedSize=undefined;
await assert.rejects(completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'abc123'}]),/size mismatch/);
assert.equal(deleted.length,2);
completedSize='11';
await assert.rejects(completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'abc123'}]),/size mismatch/);
assert.equal(deleted.length,3);
console.log('PASS owner-scoped private multipart R2 adapter');
