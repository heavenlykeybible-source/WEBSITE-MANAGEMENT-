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
const seen=new Set();
for(const entry of data.entries){
 assert.match(entry.date,/^\d{4}-\d{2}-\d{2}$/);
 assert(!seen.has(entry.date),'Duplicate date: '+entry.date);seen.add(entry.date);
 assert.equal(entry.topics.length,12,'Wrong topic count: '+entry.date);
 entry.topics.forEach((topic,i)=>{
  assert.equal(topic.topic,expected[i],entry.date+' topic '+i);
  assert.equal(topic.reference,refs[i],entry.date+' reference '+i);
  assert(topic.reflection?.trim() && topic.reflection.length<=280,entry.date+' reflection '+i);
  assert(topic.prayer?.trim() && topic.prayer.length<=160,entry.date+' prayer '+i);
  assert(topic.reviewStatus?.startsWith('draft-'),entry.date+' approval status '+i);
 });
}
console.log('PASS: '+data.entries.length+' dated entries, '+data.entries.length*12+' short topic drafts, matching Scripture references.');
const missing=data.entries.flatMap(e=>e.topics.filter(t=>!t.bibleText?.trim()));
console.log('NOT READY: '+missing.length+' KJV text fields missing. Publication must remain blocked until verified.');
