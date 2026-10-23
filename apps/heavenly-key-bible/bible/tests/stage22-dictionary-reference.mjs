import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='heavenly-key-website/bible/';
const dictionary=JSON.parse(fs.readFileSync(base+'dictionary.json','utf8'));
const books=JSON.parse(fs.readFileSync(base+'data/kjv/manifest.json','utf8')).books;
for(const entry of dictionary){
 const m=/^(.+?) (\d+):(\d+)$/.exec(entry.reference);
 assert(m,entry.term+' reference format');
 const book=books.find(x=>x.name===m[1]);assert(book,entry.term+' book name');
 const data=JSON.parse(fs.readFileSync(base+'data/kjv/'+book.code+'.json','utf8'));
 assert((data.chapters[m[2]]||[]).some(v=>String(v.number)===m[3]),entry.term+' existing KJV verse');
}
const script=fs.readFileSync(base+'study-extensions.js','utf8');
assert(script.includes('dict-verse-button'),'Bible dictionary KJV passage viewer');
assert(script.includes("ref.addEventListener('click'"),'tap or click passage toggle');
assert(script.includes('passage.textContent=verse?.text'),'safe DOM text rendering');
console.log('PASS: all '+dictionary.length+' dictionary entries resolve to KJV verses; inline verse viewer wired');
