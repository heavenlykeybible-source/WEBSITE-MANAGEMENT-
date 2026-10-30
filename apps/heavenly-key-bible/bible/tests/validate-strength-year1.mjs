import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const names=['strength-devotionals-2026.json','strength-devotionals-2027-batch01.json','strength-devotionals-year1-batch02.json','strength-devotionals-year1-batch03.json','strength-devotionals-year1-batch04.json'];
const docs=names.map(n=>JSON.parse(readFileSync(resolve(root,n),'utf8')));
const entries=docs.flatMap(d=>d.entries).sort((a,b)=>a.date.localeCompare(b.date));
assert.equal(entries.length,365);
assert.equal(entries[0].date,'2026-10-30');
assert.equal(entries.at(-1).date,'2027-10-29');
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 assert.equal(e.topics.length,12,e.date);
 assert.equal(e.status,'draft-not-published',e.date);
 if(i)assert.equal(Date.parse(e.date)-Date.parse(entries[i-1].date),86400000);
 for(let j=0;j<12;j++){
  const t=e.topics[j];
  assert.equal(t.topic,docs[0].topics[j]);
  assert(t.reference&&t.bibleText&&t.reflection&&t.prayer);
  assert(t.reflection.length<=280&&t.prayer.length<=160);
 }
}
console.log('First-year drafts structurally valid:',entries.length,'days');
