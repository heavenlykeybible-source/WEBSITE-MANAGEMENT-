// Run: node apps/heavenly-key-bible/bible/tests/validate-strength-devotionals.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const data=JSON.parse(readFileSync(resolve(root,'strength-devotionals-2026.json'),'utf8'));
const expected=['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Salvation & Repentance','Faith & Trust','The Holy Spirit','Evangelism & Soul Winning','Love & Christian Unity','The Word & Obedience','Wisdom & Discernment','End-time & Rapture Readiness'];
const refs=['Psalm 85:6','1 Peter 1:16','Psalm 46:1','1 Thessalonians 5:17','Acts 3:19','Hebrews 11:6','Acts 1:8','Mark 16:15','John 13:35','James 1:22','James 1:5','Matthew 24:44'];
assert.deepEqual(data.topics,expected);
assert.equal(data.timezone,'Africa/Lagos');
assert.equal(data.format,'twelve-short-devotionals-per-day-v1');
const seen=new Set();
const publicationReady=[];
const editorialHolds=[];
for(const entry of data.entries){
 assert.match(entry.date,/^\d{4}-\d{2}-\d{2}$/);
 const parsedDate=new Date(entry.date+'T00:00:00Z');
 assert(!Number.isNaN(parsedDate.getTime())&&parsedDate.toISOString().slice(0,10)===entry.date,'Invalid calendar date: '+entry.date);
 assert(!seen.has(entry.date),'Duplicate date: '+entry.date);seen.add(entry.date);
 assert(entry.date>='2026-10-30','Unexpected date before editorial start: '+entry.date);
 assert.equal(entry.topics.length,12,'Wrong topic count: '+entry.date);
 assert(['draft-not-published','approved-for-publication'].includes(entry.status),'Invalid publication status: '+entry.date);
 if(entry.status==='approved-for-publication')assert(entry.topics.every(t=>t.reviewStatus==='approved'),'Unapproved topic in published day: '+entry.date);
 if(entry.status==='approved-for-publication')publicationReady.push(entry.date);
 else editorialHolds.push(entry.date);
 entry.topics.forEach((topic,i)=>{
  assert.equal(topic.topic,expected[i],entry.date+' topic '+i);
  assert.equal(topic.reference,refs[i],entry.date+' reference '+i);
  assert(topic.reflection?.trim() && topic.reflection.length<=280,entry.date+' reflection '+i);
  assert(topic.prayer?.trim() && topic.prayer.length<=160,entry.date+' prayer '+i);
  assert(topic.reviewStatus?.startsWith('draft-')||topic.reviewStatus==='approved',entry.date+' approval status '+i);
  assert(topic.bibleText?.trim(),'Missing KJV text: '+entry.date+' topic '+i);
  assert(topic.reference?.trim(),'Missing Bible reference: '+entry.date+' topic '+i);
  assert(topic.bibleText.length<=1200,'Unexpectedly long Bible text: '+entry.date+' topic '+i);
  assert(!topic.bibleText.includes('undefined'),'Invalid KJV text: '+entry.date+' topic '+i);
 });
}
console.log('PASS: '+data.entries.length+' dated entries, '+data.entries.length*12+' short topic drafts, matching Scripture references.');
const approvedEntries=data.entries.filter(e=>e.status==='approved-for-publication');
for(let i=0;i<12;i++){
 const reflectionSeen=new Set();
 const prayerSeen=new Set();
 for(const entry of approvedEntries){
  const topic=entry.topics[i];
  const reflection=topic.reflection.trim().toLowerCase();
  const prayer=topic.prayer.trim().toLowerCase();
  assert(!reflectionSeen.has(reflection),'Repeated approved reflection for '+topic.topic+' on '+entry.date);
  assert(!prayerSeen.has(prayer),'Repeated approved prayer for '+topic.topic+' on '+entry.date);
  reflectionSeen.add(reflection);prayerSeen.add(prayer);
 }
}
const uniqueDraftReflections=new Set(data.entries.flatMap(e=>e.topics.map(t=>t.reflection.trim().toLowerCase()))).size;
const drafts=data.entries.flatMap(e=>e.topics.filter(t=>t.reviewStatus?.startsWith('draft-')));
console.log('APPROVED DATES: '+publicationReady.length+'; EDITORIAL HOLD DATES: '+editorialHolds.length+'.');
console.log('EDITORIAL HOLD TOPICS: '+drafts.length+'. Test validation does not constitute editorial approval.');
if(publicationReady.length===0)console.warn('NOT LAUNCH READY: No approved dated devotionals.');

console.log('CONTENT QUALITY: '+uniqueDraftReflections+' distinct reflections across '+data.entries.length*12+' topic entries. Approved content must not repeat a topic reflection or prayer across days.');
