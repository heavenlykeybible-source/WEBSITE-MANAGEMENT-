import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const names=['strength-devotionals-2026.json','strength-devotionals-2027-batch01.json','strength-devotionals-year1-batch02.json','strength-devotionals-year1-batch03.json','strength-devotionals-year1-batch04.json','strength-devotionals-year2-batch01.json','strength-devotionals-year2-batch02.json','strength-devotionals-year2-batch03.json','strength-devotionals-year2-batch04.json','strength-devotionals-year3-batch01.json','strength-devotionals-year3-batch02.json','strength-devotionals-year3-batch03.json','strength-devotionals-year3-batch04.json'];
const docs=names.map(n=>JSON.parse(readFileSync(resolve(root,n),'utf8')));
for(const doc of docs){assert.equal(doc.timezone,'Africa/Lagos');assert.deepEqual(doc.topics,docs[0].topics)}
const entries=docs.flatMap(d=>d.entries).sort((a,b)=>a.date.localeCompare(b.date));
assert.equal(new Set(entries.map(e=>e.date)).size,entries.length,'Duplicate dates');
assert.equal(entries.length,1096);
assert.equal(entries[0].date,'2026-10-30');
assert.equal(entries.at(-1).date,'2029-10-29');
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 assert.match(e.date,/^\d{4}-\d{2}-\d{2}$/);
 const ms=Date.parse(e.date+'T00:00:00Z');
 assert(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===e.date,'Invalid date '+e.date);
 assert.equal(e.topics.length,12,e.date);
 assert(['draft-not-published','approved-for-publication'].includes(e.status),'Invalid status '+e.date);
 if(i)assert.equal(Date.parse(e.date)-Date.parse(entries[i-1].date),86400000);
 for(let j=0;j<12;j++){
  const t=e.topics[j];
  assert.equal(t.topic,docs[0].topics[j]);
  assert.equal(t.reference,docs[0].entries[0].topics[j].reference);
  assert(typeof t.bibleText==='string'&&t.bibleText.trim());
  assert(t.bibleText.length<=1200);
  assert.equal(t.bibleText,docs[0].entries[0].topics[j].bibleText,'Inconsistent Scripture quotation '+e.date+' topic '+j);
  assert(typeof t.reflection==='string'&&t.reflection.trim().length>=30,'Empty or too-short reflection '+e.date);
  assert(typeof t.prayer==='string'&&t.prayer.trim().length>=15,'Empty or too-short prayer '+e.date);
  if(e.status==='approved-for-publication')assert.equal(t.reviewStatus,'approved','Unreviewed approved topic '+e.date);else assert.equal(t.reviewStatus,'draft-original-editorial-and-doctrinal-approval-pending','Unexpected draft review status '+e.date);
  assert(t.reference&&t.bibleText&&t.reflection&&t.prayer);
  assert(t.reflection.length<=280&&t.prayer.length<=160);
 }
}
const all=entries.flatMap(e=>e.topics);
console.log('First three years structurally valid:',entries.length,'days',all.length,'topic entries');
const normalize=value=>value.trim().toLowerCase().replace(/\s+/g,' ');
const uniqueReflections=new Set(all.map(t=>normalize(t.reflection))).size;
const uniquePrayers=new Set(all.map(t=>normalize(t.prayer))).size;
console.log('CONTENT QUALITY REPORT:',JSON.stringify({totalTopicEntries:all.length,uniqueReflections,duplicateReflectionEntries:all.length-uniqueReflections,uniquePrayers,duplicatePrayerEntries:all.length-uniquePrayers}));
const approved=entries.filter(e=>e.status==='approved-for-publication');
for(let j=0;j<12;j++){const reflections=new Set(),prayers=new Set();for(const e of approved){const r=e.topics[j].reflection.trim().toLowerCase(),p=e.topics[j].prayer.trim().toLowerCase();assert(!reflections.has(r),'Repeated approved reflection '+e.date);assert(!prayers.has(p),'Repeated approved prayer '+e.date);reflections.add(r);prayers.add(p);}}
console.log('APPROVED DAYS:',approved.length,'EDITORIAL HOLD:',entries.length-approved.length);
if(approved.length<entries.length||uniqueReflections<all.length||uniquePrayers<all.length)console.warn('NOT READY: Editorial approval and originality editing outstanding.');
// Identical draft passages are reported as editorial blockers, not automatically approved or silently rewritten.
