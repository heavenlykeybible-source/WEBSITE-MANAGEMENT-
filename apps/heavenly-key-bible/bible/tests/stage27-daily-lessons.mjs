import assert from 'node:assert/strict';
import fs from 'node:fs';
const dir='heavenly-key-website/bible/';
const lessons=JSON.parse(fs.readFileSync(dir+'daily-lessons.json','utf8'));
const topics=JSON.parse(fs.readFileSync(dir+'daily-topics.json','utf8'));
assert.equal(Object.keys(lessons).length,53);
for(const [topic,entry] of Object.entries(lessons)){
 assert(topics[topic],topic+' missing topic');
 assert.equal(entry.scripture,topics[topic][0]);
 assert(entry.explanation.length>80,topic+' explanation too short');
}
const js=fs.readFileSync(dir+'study-extensions.js','utf8');
const sw=fs.readFileSync(dir+'sw.js','utf8');
assert(js.includes("state.lessons?.[selected]?.explanation"));
assert(sw.includes('./daily-lessons.json'));
console.log('PASS: 53 original plain-language lessons connected to the daily routine and cached offline');
