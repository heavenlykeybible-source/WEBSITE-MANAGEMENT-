import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const names=['strength-devotionals-2026.json','strength-devotionals-2027-batch01.json','strength-devotionals-year1-batch02.json','strength-devotionals-year1-batch03.json','strength-devotionals-year1-batch04.json'];
const docs=names.map(n=>JSON.parse(readFileSync(resolve(root,n),'utf8')));
for(const doc of docs){assert.equal(doc.timezone,'Africa/Lagos');assert.deepEqual(doc.topics,docs[0].topics)}
const entries=docs.flatMap(d=>d.entries).sort((a,b)=>a.date.localeCompare(b.date));
assert.equal(new Set(entries.map(e=>e.date)).size,entries.length,'Duplicate dates');
assert.equal(entries.length,365);
assert.equal(entries[0].date,'2026-10-30');
assert.equal(entries.at(-1).date,'2027-10-29');
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 assert.match(e.date,/^\d{4}-\d{2}-\d{2}$/);
 const ms=Date.parse(e.date+'T00:00:00Z');
 assert(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===e.date,'Invalid date '+e.date);
 assert.equal(e.topics.length,12,e.date);
 assert.equal(e.status,'draft-not-published',e.date);
 if(i)assert.equal(Date.parse(e.date)-Date.parse(entries[i-1].date),86400000);
 for(let j=0;j<12;j++){
  const t=e.topics[j];
  assert.equal(t.topic,docs[0].topics[j]);
  assert.equal(t.reference,docs[0].entries[0].topics[j].reference);
  assert(typeof t.bibleText==='string'&&t.bibleText.trim());
  assert(t.bibleText.length<=1200);
  assert(t.reviewStatus==='approved'||t.reviewStatus?.startsWith('draft-'));
  assert(t.reference&&t.bibleText&&t.reflection&&t.prayer);
  assert(t.reflection.length<=280&&t.prayer.length<=160);
 }
}
const all=entries.flatMap(e=>e.topics);
console.log('First-year drafts structurally valid:',entries.length,'days',all.length,'topic entries');
console.log('Distinct reflections:',new Set(all.map(t=>t.reflection)).size,'distinct prayers:',new Set(all.map(t=>t.prayer)).size);
console.log('EDITORIAL HOLD: none of these drafts are approved for publication.');
