import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadCanon,loadDrafts,validateEntries,expandReference,hash} from './concordance-core.mjs';
const {canon,byRef,books,chapters}=loadCanon(),{entries}=loadDrafts();
const tests=[];
function check(name,fn){fn();tests.push(name)}
const sample=entries.find(e=>e.kjvTextHash&&!e.publicationHold);
check('66 books, 1189 chapters, 31102 contiguous verse records',()=>{assert.equal(books.length,66);assert.equal(chapters,1189);assert.equal(canon.length,31102)});
check('all saved draft references, cross-references, duplicate text and bundle fields',()=>assert.deepEqual(validateEntries(entries,byRef).errors,[]));
check('valid new record meets strict intake schema',()=>assert.deepEqual(validateEntries([sample],byRef,{strict:true}).errors,[]));
for(const [name,patch] of [
 ['reject wrong verse',{ref:'Genesis 46:99'}],
 ['reject mismatched KJV text',{kjvText:'Altered verse'}],
 ['reject mismatched hash',{kjvTextHash:hash('Altered verse')}],
 ['reject nonexistent cross-reference',{crossReferences:['Genesis 2:26']}],
 ['reject empty explanation',{explanation:''}],
 ['reject missing historical context',{historicalContext:''}],
 ['reject automatic approval',{reviewStatus:'approved'}],
 ['reject obsolete rejected status',{reviewStatus:'rejected'}],
 ['require hold for review flags',{reviewFlags:['Needs human review'],publicationHold:false}]
])check(name,()=>assert.ok(validateEntries([{...sample,...patch}],byRef,{strict:true}).errors.length));
check('reject duplicated record',()=>assert.ok(validateEntries([sample,sample],byRef).errors.some(e=>e.includes('duplicate verse'))));
check('reject normalized duplicate explanation',()=>assert.ok(validateEntries([sample,{...sample,ref:'Genesis 48:1',explanation:' '+sample.explanation.toUpperCase()+' '}],byRef).errors.some(e=>e.includes('identical explanation'))));
check('expand real KJV same-chapter ranges and Psalm alias',()=>assert.deepEqual(expandReference('Psalm 23:1–3',byRef),['Psalms 23:1','Psalms 23:2','Psalms 23:3']));
check('reject invalid and descending ranges',()=>{assert.equal(expandReference('Genesis 2:25-26',byRef),null);assert.equal(expandReference('Genesis 2:3-1',byRef),null)});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'concordance-test-'));
try{
 check('500-verse missing-only resumable packets start at next missing, no duplicates',()=>{
  const r=spawnSync(process.execPath,['scripts/concordance-prepare-queue.mjs','--out',temp],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const m=JSON.parse(fs.readFileSync(path.join(temp,'manifest.json'))),saved=new Set(entries.map(e=>e.ref));
  const queued=m.packets.flatMap(p=>JSON.parse(fs.readFileSync(path.join(temp,p.file))));
  assert.equal(m.packetSize,500);assert.equal(m.packets[0].verses,500);
  assert.equal(queued.length,31102-saved.size-m.legacyAudit.length);
  assert.equal(new Set(queued.map(e=>e.ref)).size,queued.length);
  assert.ok(queued.every(e=>!saved.has(e.ref)&&byRef.get(e.ref).text===e.text));
  assert.equal(queued[0].ref,canon.find(e=>!saved.has(e.ref)&&!m.legacyAudit.includes(e.ref)).ref);
 });
 check('1000-verse scaling requires explicit reliability override',()=>assert.notEqual(spawnSync(process.execPath,['scripts/concordance-prepare-queue.mjs','--size','1000','--out',temp]).status,0));
 check('intake refuses an already-saved batch',()=>{
  fs.writeFileSync(path.join(temp,'duplicate.json'),JSON.stringify([sample]));
  const r=spawnSync(process.execPath,['scripts/concordance-batches.mjs','validate',path.join(temp,'canon.json'),path.join(temp,'duplicate.json')],{encoding:'utf8'});
  assert.equal(r.status,1);assert.match(r.stdout,/already saved/);
 });
}finally{fs.rmSync(temp,{recursive:true,force:true})}
console.log(JSON.stringify({passed:tests.length,failed:0,tests},null,2));
