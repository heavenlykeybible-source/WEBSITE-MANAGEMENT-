import assert from 'node:assert/strict';
import {assertPrivateImportPublishable} from '../scripts/account4-import-publish-gate.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const key='private-imports/7/'+id;
const actor={authenticated:true,id:7,role:'owner',canPublish:true};
const good={owner_id:7,state:'private-awaiting-review',object_key:key,
 size_bytes:123,verdict:'clean',scanned_key:key,scanned_size:123,
 scanned_sha256:'a'.repeat(64),approved_sha256:'a'.repeat(64),scanned_version:'version-123456',scanned_etag:'a'.repeat(32),
 approved_by:7,approved_at:'2026-10-31T12:00:00Z',scanned_at:'2026-10-31T11:00:00Z'};
let row={...good};
const db={prepare(sql){assert.match(sql,/owner_id=\?/);return {bind(...args){
 assert.deepEqual(args,[id,7]);return {async first(){return row}};
}}}};
let live={key,size:123,version:'version-123456',etag:'a'.repeat(32)};
let headCount=0;
const bucket={async head(givenKey){assert.equal(givenKey,key);headCount++;return live;}};
const check=()=>assertPrivateImportPublishable(db,bucket,actor,id);
assert.deepEqual(await check(),{id,state:'cleared-for-publication',version:'version-123456',key,size:123,etag:'a'.repeat(32)});
for(const [field,value] of Object.entries({
 state:'completing',verdict:'pending',object_key:'private-imports/7/../danger',
 scanned_key:'private-imports/7/other',scanned_size:122,approved_by:null,
 approved_at:null,scanned_at:null,scanned_sha256:null,scanned_etag:null,approved_sha256:'b'.repeat(64),
 owner_id:8,approved_by:8,size_bytes:-1
})){
 row={...good,[field]:value};
 await assert.rejects(check(),/not cleared/);
}
for(const invalid of [{scanned_at:'nonsense'},{approved_at:'nonsense'},
 {approved_at:'2026-10-31T10:00:00Z'},
 {scanned_sha256:'A'.repeat(64)},{approved_sha256:'b'.repeat(64)}]) {
 row={...good,...invalid}; await assert.rejects(check(),/not cleared/);
}
row={...good,object_key:'private-imports/7/123e4567-e89b-42d3-a456-426614174001',scanned_key:'private-imports/7/123e4567-e89b-42d3-a456-426614174001'};
await assert.rejects(check(),/not cleared/,'A different valid private key must not be approved for this session');
row={...good};
for(const invalidLive of [null,{key,size:123,version:'version-replaced',etag:'a'.repeat(32)},
 {key,size:124,version:'version-123456',etag:'a'.repeat(32)},
 {key:'private-imports/7/another',size:123,version:'version-123456',etag:'a'.repeat(32)},
 {key,size:123,version:'version-123456',etag:'b'.repeat(32)}]) {
 live=invalidLive; await assert.rejects(check(),/not cleared/);
}
live={key,size:123,version:'version-123456',etag:'a'.repeat(32)};
row={...good,scanned_etag:'a'.repeat(32)+'-103'};
live={key,size:123,version:'version-123456',etag:row.scanned_etag};
assert.equal((await check()).etag,row.scanned_etag);
for(const invalidEtag of ['a'.repeat(31), 'a'.repeat(32)+'-0', 'a'.repeat(32)+'-1000', 'z'.repeat(32)]) {
  row={...good,scanned_etag:invalidEtag};
  await assert.rejects(check(),/not cleared/);
}
live={key,size:123,version:'version-123456',etag:'a'.repeat(32)};
row=null;await assert.rejects(check(),/not cleared/);
row={...good};
for(const bad of [{...actor,canPublish:false},{...actor,role:'admin'},{...actor,role:undefined},{...actor,authenticated:false},{...actor,id:0}])
 await assert.rejects(assertPrivateImportPublishable(db,bucket,bad,id),/permission required/);
await assert.rejects(assertPrivateImportPublishable(db,bucket,actor,'../bad'),/Invalid import identifier/);
console.log('PASS Account 4 fail-closed publication gate');
