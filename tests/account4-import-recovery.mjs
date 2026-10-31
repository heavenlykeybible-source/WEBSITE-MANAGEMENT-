import assert from 'node:assert/strict';
import {inspectPrivateImportRecovery} from '../scripts/account4-import-recovery.mjs';
const actor={id:7,authenticated:true,canImport:true};
const id='123e4567-e89b-42d3-a456-426614174000';
const row={owner_id:7,object_key:'private-imports/7/'+id,size_bytes:11,state:'completing'};
let heads=0;
const db={prepare(sql){assert.match(sql,/owner_id=\?/);return {bind(...args){assert.deepEqual(args,[id,7]);return {async first(){return row}}}}}};
const bucket={async head(key){heads++;assert.equal(key,row.object_key);return {size:11}}};
assert.deepEqual(await inspectPrivateImportRecovery(db,bucket,actor,id),{
 id,state:'completing',objectPresent:true,matchesExpectedSize:true,requiresOperatorReview:true
});
row.state='private-awaiting-review';
assert.equal((await inspectPrivateImportRecovery(db,bucket,actor,id)).requiresOperatorReview,false);
bucket.head=async()=>({size:12});
assert.equal((await inspectPrivateImportRecovery(db,bucket,actor,id)).requiresOperatorReview,true);
bucket.head=async()=>null;
assert.equal((await inspectPrivateImportRecovery(db,bucket,actor,id)).objectPresent,false);
const before=heads;
await assert.rejects(inspectPrivateImportRecovery(db,bucket,{...actor,id:8},id));
await assert.rejects(inspectPrivateImportRecovery(db,bucket,{...actor,canImport:false},id));
await assert.rejects(inspectPrivateImportRecovery(db,bucket,actor,'../secret'));
row.object_key='private-imports/7/../8/forged';
await assert.rejects(inspectPrivateImportRecovery(db,bucket,actor,id),/unavailable/);
console.log('PASS Account 4 read-only recovery and owner isolation');
