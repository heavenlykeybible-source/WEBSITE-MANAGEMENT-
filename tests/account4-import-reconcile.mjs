import assert from 'node:assert/strict';
import {reconcileCompletedPrivateImport} from '../scripts/account4-import-reconcile.mjs';
const id='123e4567-e89b-42d3-a456-426614174000';
const key='private-imports/7/'+id;
const actor={id:7,authenticated:true,role:'owner',canImport:true};
const row={owner_id:7,object_key:key,size_bytes:100,state:'completing'};
let changes=1, writes=0, object={key,size:100};
const db={prepare(sql){return {bind(...args){
 if(sql.startsWith('SELECT')){assert.deepEqual(args,[id,7]);return {async first(){return row}};}
 assert.match(sql,/state='completing'/);
 assert.deepEqual(args,[id,7]);
 return {async run(){writes++;return {meta:{changes}}}};
}}}};
const bucket={async head(requested){assert.equal(requested,key);return object;}};
assert.deepEqual(await reconcileCompletedPrivateImport(db,bucket,actor,id),{
 id,state:'private-awaiting-review',published:false,scanned:false});
assert.equal(writes,1);
row.state='private-awaiting-review';
await assert.rejects(reconcileCompletedPrivateImport(db,bucket,actor,id),/cannot be reconciled/);
row.state='completing';object=null;
await assert.rejects(reconcileCompletedPrivateImport(db,bucket,actor,id),/cannot be reconciled/);
object={key,size:99};
await assert.rejects(reconcileCompletedPrivateImport(db,bucket,actor,id),/cannot be reconciled/);
object={key,size:100};changes=0;
await assert.rejects(reconcileCompletedPrivateImport(db,bucket,actor,id),/reconciliation failed/);
const before=writes;
for(const denied of [{...actor,role:'admin'},{...actor,canImport:false},{...actor,authenticated:false}])
 await assert.rejects(reconcileCompletedPrivateImport(db,bucket,denied,id),/authorization required/);
assert.equal(writes,before,'Unauthorized request must not modify database');
console.log('PASS owner-only private import completion reconciliation');
