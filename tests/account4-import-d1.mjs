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
const session={ownerId:7,key:'private-imports/7/abc',uploadId:'u1',name:'backup.zip',size:11,partCount:1,state:'uploading',expiresAt:Date.now()+3600000};
await assert.rejects(saveImportSession(db,actor,{...session,key:'private-imports/8/forged'}));
await assert.rejects(saveImportSession(db,actor,{...session,expiresAt:0}));
await assert.rejects(saveImportSession(db,actor,{...session,size:1073741825}));
await assert.rejects(saveImportSession(db,actor,{...session,partCount:2}));
await assert.rejects(saveImportSession(db,actor,{...session,size:0}));
const id=await saveImportSession(db,actor,session);
assert.match(id,/^[a-f0-9-]{36}$/i);
row={owner_id:7,object_key:session.key,upload_id:'u1',filename:'backup.zip',size_bytes:11,part_count:1,state:'uploading',expires_at_ms:session.expiresAt};
assert.equal((await loadImportSession(db,actor,id)).parts[1],undefined);
await assert.rejects(loadImportSession(db,other,'invalid'));
const originalKey=row.object_key;
row.object_key='private-imports/8/forged';
await assert.rejects(loadImportSession(db,actor,id),/unavailable/);
row.object_key=originalKey;
await assert.rejects(saveImportSession(db,other,session));
await recordImportPart(db,actor,id,{partNumber:1,etag:'abc123'});
assert.ok(statements.at(-1).sql.includes('ON CONFLICT'));
parts=[{part_number:1,etag:'abc123'}];
assert.equal((await loadImportSession(db,actor,id)).parts[1],'abc123');
await assert.rejects(recordImportPart(db,actor,id,{partNumber:2,etag:'abc123'}));
assert.deepEqual(await transitionImportSession(db,actor,id,'uploading','private-awaiting-review'),{id,state:'private-awaiting-review'});
await assert.rejects(transitionImportSession(db,actor,id,'private-awaiting-review','uploading'));
console.log('PASS Account 4 D1 import persistence permission boundaries');
