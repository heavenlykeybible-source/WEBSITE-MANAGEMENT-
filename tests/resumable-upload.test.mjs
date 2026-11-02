import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chunkPlan,receiveChunk,verifyUpload} from '../project-import/resumable-upload.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
test('chunk limits',()=>{assert.equal(chunkPlan(1073741824).chunks,128);assert.throws(()=>chunkPlan(1073741825));});
test('upload checks each chunk and whole package',async()=>{
 const bytes=new Uint8Array([1,2,3]);
 const session={id:'upload_session_123456',totalBytes:3,sha256:digest(bytes)};
 const store=new Map();
 const part=await receiveChunk({session,index:0,bytes,sha256:digest(bytes),hash:async b=>digest(b),put:async(k,v)=>store.set(k,v)});
 const verified=await verifyUpload({session,parts:[part],hash:async b=>digest(b),read:async k=>store.get(k),hashParts:async parts=>digest(Buffer.concat(parts))});
 assert.equal(verified.readyForRelease,true);
 await assert.rejects(verifyUpload({session,parts:[part],hash:async b=>digest(b),read:async k=>store.get(k),hashParts:async()=>('0'.repeat(64))}));
});
