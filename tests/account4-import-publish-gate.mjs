import assert from 'node:assert/strict';
import {assertPrivateImportPublishable} from '../scripts/account4-import-publish-gate.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const key='private-imports/7/'+id;
const actor={authenticated:true,id:7,canPublish:true};
const good={owner_id:7,state:'private-awaiting-review',object_key:key,
 size_bytes:123,verdict:'clean',scanned_key:key,scanned_size:123,
 scanned_sha256:'a'.repeat(64),approved_sha256:'a'.repeat(64),
 approved_by:7,approved_at:'2026-10-31T12:00:00Z',scanned_at:'2026-10-31T11:00:00Z'};
let row={...good};
const db={prepare(sql){assert.match(sql,/owner_id=\?/);return {bind(...args){
 assert.deepEqual(args,[id,7]);return {async first(){return row}};
}}}};
const check=()=>assertPrivateImportPublishable(db,actor,id);
assert.deepEqual(await check(),{id,state:'cleared-for-publication'});
for(const [field,value] of Object.entries({
 state:'completing',verdict:'pending',object_key:'private-imports/7/../danger',
 scanned_key:'private-imports/7/other',scanned_size:122,approved_by:null,
 approved_at:null,scanned_at:null,scanned_sha256:null,approved_sha256:'b'.repeat(64),
 owner_id:8,size_bytes:-1
})){
 row={...good,[field]:value};
 await assert.rejects(check(),/not cleared/);
}
for(const invalid of [{scanned_at:'nonsense'},{approved_at:'nonsense'},
 {approved_at:'2026-10-31T10:00:00Z'},
 {scanned_sha256:'A'.repeat(64)},{approved_sha256:'b'.repeat(64)}]) {
 row={...good,...invalid}; await assert.rejects(check(),/not cleared/);
}
row=null;await assert.rejects(check(),/not cleared/);
row={...good};
for(const bad of [{...actor,canPublish:false},{...actor,authenticated:false},{...actor,id:0}])
 await assert.rejects(assertPrivateImportPublishable(db,bad,id),/permission required/);
await assert.rejects(assertPrivateImportPublishable(db,actor,'../bad'),/Invalid import identifier/);
console.log('PASS Account 4 fail-closed publication gate');
