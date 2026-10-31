import assert from 'node:assert/strict';
import {saveImportSession,loadImportSession,recordImportPart,transitionImportSession} from '../scripts/account4-import-d1.mjs';
const actor={id:7,authenticated:true,canImport:true};
const other={...actor,id:8};
const statements=[];
let row,parts=[];
const db={prepare(sql){return {bind(...args){statements.push({sql,args});return {
 async run(){return {meta:{changes:1}};},
 async first(){return row;},
 async all(){return {results:parts};}
};}}}};
const session={ownerId:7,key:'private-imports/7/123e4567-e89b-42d3-a456-426614174000',uploadId:'u1',name:'backup.zip',size:11,partCount:1,state:'uploading',expiresAt:Date.now()+3600000};
await assert.rejects(saveImportSession(db,actor,{...session,key:'private-imports/8/forged'}));
await assert.rejects(saveImportSession(db,actor,{...session,key:'private-imports/7/../8/forged'}));
await assert.rejects(saveImportSession(db,actor,{...session,key:'private-imports/7/not-a-uuid'}));
await assert.rejects(saveImportSession(db,actor,{...session,expiresAt:0}));
await assert.rejects(saveImportSession(db,actor,{...session,size:1073741825}));
await assert.rejects(saveImportSession(db,actor,{...session,partCount:2}));
await assert.rejects(saveImportSession(db,actor,{...session,size:0}));
for (const name of ['run.sh','config.env','../secrets.zip','a/b.zip',''])
  await assert.rejects(saveImportSession(db,actor,{...session,name}));
await assert.rejects(saveImportSession(db,{...actor,id:0},{...session,ownerId:0}));
const id=await saveImportSession(db,actor,session);
assert.match(id,/^[a-f0-9-]{36}$/i);
const originalPrepare=db.prepare;
db.prepare=()=>({bind:()=>({run:async()=>({meta:{changes:0}})})});
await assert.rejects(saveImportSession(db,actor,session),/not persisted/);
db.prepare=originalPrepare;
row={owner_id:7,object_key:session.key,upload_id:'u1',filename:'backup.zip',size_bytes:11,part_count:1,state:'uploading',expires_at_ms:session.expiresAt};
assert.equal((await loadImportSession(db,actor,id)).parts[1],undefined);
await assert.rejects(loadImportSession(db,other,'invalid'));
const originalKey=row.object_key;
row.object_key='private-imports/8/forged';
await assert.rejects(loadImportSession(db,actor,id),/unavailable/);
row.object_key=originalKey;
for (const [field,bad] of [['size_bytes',0],['size_bytes',1073741825],['part_count',2],['upload_id','']]) {
  const original=row[field];
  row[field]=bad;
  await assert.rejects(loadImportSession(db,actor,id),/unavailable/);
  row[field]=original;
}
await assert.rejects(saveImportSession(db,other,session));
const previousPrepare=db.prepare;
db.prepare=sql=>({bind:()=>({run:async()=>({success:false,meta:{changes:1}}),first:async()=>row,all:async()=>({results:parts})})});
await assert.rejects(recordImportPart(db,actor,id,{partNumber:1,etag:'abc123'}),/not persisted/);
await assert.rejects(transitionImportSession(db,actor,id,'uploading','aborted'),/transition denied/);
db.prepare=previousPrepare;
await recordImportPart(db,actor,id,{partNumber:1,etag:'abc123'});
assert.ok(statements.at(-1).sql.includes('ON CONFLICT'));
assert.ok(statements.at(-1).sql.includes('AND 1=1 ON CONFLICT'), 'SQLite SELECT UPSERT parsing guard must be present');
assert.equal(statements.at(-1).args.length,9,'Receipt statement must bind all nine parameters');
parts=[{part_number:1,etag:'abc123'}];
assert.equal((await loadImportSession(db,actor,id)).parts[1],'abc123');
for (const badParts of [[{part_number:0,etag:'abc123'}],[{part_number:2,etag:'abc123'}],[{part_number:1,etag:''}],[{part_number:1,etag:'abc123'},{part_number:1,etag:'abc123'}]]) {
  const validParts=parts;
  parts=badParts;
  await assert.rejects(loadImportSession(db,actor,id),/Invalid persisted upload receipts/);
  parts=validParts;
}
await assert.rejects(recordImportPart(db,actor,id,{partNumber:2,etag:'abc123'}));
assert.deepEqual(await transitionImportSession(db,actor,id,'completing','private-awaiting-review'),{id,state:'private-awaiting-review'});
assert.match(statements.at(-1).sql,/COUNT\(\*\)/,'Review transition must require complete part receipts');
assert.match(statements.at(-1).sql,/MIN\(part_number\)/,'Review transition must require contiguous parts');
assert.match(statements.at(-1).sql,/MAX\(part_number\)/,'Review transition must reject missing final parts');
assert.equal(statements.at(-1).args.length,7,'Transition must bind review/abort condition safely');
await assert.rejects(transitionImportSession(db,actor,id,'private-awaiting-review','uploading'));
console.log('PASS Account 4 D1 import persistence permission boundaries');
