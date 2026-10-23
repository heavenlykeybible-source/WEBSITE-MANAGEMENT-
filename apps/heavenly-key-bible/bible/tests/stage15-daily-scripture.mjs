import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='heavenly-key-website/bible/';
const topics=JSON.parse(fs.readFileSync(base+'daily-topics.json','utf8'));
const books=JSON.parse(fs.readFileSync(base+'data/kjv/manifest.json','utf8')).books;
for(const [topic,[reference]] of Object.entries(topics)){
 const m=/^(.+?) (\d+):(\d+)$/.exec(reference);
 assert(m,topic+' invalid ref');
 const book=books.find(x=>x.name===m[1]);
 assert(book,topic+' unknown book');
 const data=JSON.parse(fs.readFileSync(base+'data/kjv/'+book.code+'.json','utf8'));
 assert((data.chapters[m[2]]||[]).some(v=>String(v.number)===m[3]),topic+' missing verse');
}
const js=fs.readFileSync(base+'study-extensions.js','utf8');
const html=fs.readFileSync(base+'study-extensions.html','utf8');
assert(js.includes('showDailyScripture(content[0])'));
assert(js.includes('verseText.textContent=entry.text'));
assert(html.includes('id="daily-scripture"'));
console.log('PASS: all '+Object.keys(topics).length+' daily topics resolve to real KJV verses and are displayed as text');
