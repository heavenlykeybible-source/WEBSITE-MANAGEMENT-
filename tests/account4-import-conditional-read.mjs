import assert from 'node:assert/strict';
import {readApprovedPrivateImport} from '../scripts/account4-import-conditional-read.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const key='private-imports/7/'+id;
const etag='a'.repeat(32);
const actor={authenticated:true,id:7,role:'owner',canPublish:true};
const row={owner_id:7,state:'private-awaiting-review',object_key:key,
 size_bytes:123,verdict:'clean',scanned_key:key,scanned_size:123,
 scanned_sha256:'b'.repeat(64),approved_sha256:'b'.repeat(64),
 scanned_version:'version-123456',scanned_etag:etag,
 approved_by:7,scanned_at:'2026-10-31T11:00:00Z',approved_at:'2026-10-31T12:00:00Z'};
const db={prepare(){return {bind(){return {async first(){return row}}}}}};
const body={private:true};
let result={key,size:123,version:'version-123456',etag,body};
let getCount=0;
const bucket={
 async head(){return {key,size:123,version:'version-123456',etag}},
 async get(requested, options){
   getCount++;
   assert.equal(requested,key);
   assert.deepEqual(options,{onlyIf:{etagMatches:etag}});
   return result;
 }
};
assert.deepEqual(await readApprovedPrivateImport(db,bucket,actor,id),{body,size:123,etag,version:'version-123456'});
for(const bad of [
 {key,size:123,version:'version-123456',etag},
 {key,size:123,version:'new-version',etag,body},
 {key,size:123,version:'version-123456',etag:'c'.repeat(32),body},
 {key,size:122,version:'version-123456',etag,body},
 null
]){
 result=bad;await assert.rejects(readApprovedPrivateImport(db,bucket,actor,id),/changed after security approval/);
}
const before=getCount;
await assert.rejects(readApprovedPrivateImport(db,bucket,{...actor,role:'admin'},id),/permission required/);
assert.equal(getCount,before,'Unauthorized callers must never read object bytes');
console.log('PASS Account 4 private conditional object reads');
