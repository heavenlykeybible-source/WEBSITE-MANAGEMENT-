import assert from 'node:assert/strict';
import {beginPrivateImport,uploadPrivatePart,completePrivateImport,abortPrivateImport} from '../scripts/account4-r2-multipart.mjs';
const actor={id:7,authenticated:true,canImport:true},other={...actor,id:8};
const uploads=[];\nlet completedSize=11;\nconst deleted=[];
const bucket={
 async createMultipartUpload(key){uploads.push(key);return {uploadId:'u1'}},
 resumeMultipartUpload(key,id){assert.equal(id,'u1');assert.equal(key,uploads.at(-1));return {
  async uploadPart(partNumber,bytes){return {partNumber,etag:'abc123'}},
  async complete(parts){return {size:completedSize}},
  async abort(){}
 }}
};
bucket.delete=async key=>{deleted.push(key)};
const session=await beginPrivateImport(bucket,actor,{name:'backup.zip',size:11});
assert.equal(session.state,'uploading');
await assert.rejects(uploadPrivatePart(bucket,other,session,1,new Uint8Array(11)));
assert.deepEqual(await uploadPrivatePart(bucket,actor,session,1,new Uint8Array(11)),{partNumber:1,etag:'abc123'});
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
completedSize=10;\nawait assert.rejects(completePrivateImport(bucket,actor,session,[{partNumber:1,etag:'abc123'}]),/size mismatch/);\nassert.deepEqual(deleted,[session.key]);\nconsole.log('PASS owner-scoped private multipart R2 adapter');
