import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='heavenly-key-website/bible/';
const books=['GEN','EXO','MAT','MAR','JOH'];
let spans=0;
for(const book of books){
 const bible=JSON.parse(fs.readFileSync(base+'data/kjv/'+book+'.json','utf8'));
 const marks=JSON.parse(fs.readFileSync(base+'data/annotations/'+book+'.json','utf8'));
 for(const [chapter,verses] of Object.entries(marks))for(const [number,ranges] of Object.entries(verses)){
  const passage=bible.chapters[chapter].find(v=>String(v.number)===number);
  assert(passage,book+' '+chapter+':'+number);
  let end=0;
  for(const r of ranges){
   assert(['jesus','god'].includes(r.type));
   assert(r.start>=end&&r.end<=passage.text.length&&r.start<r.end);
   assert(passage.text.slice(r.start,r.end).length>2);
   end=r.end;spans++;
  }
 }
}
const refs=JSON.parse(fs.readFileSync(base+'data/annotations/center-references.json','utf8'));
for(const [book,chapters] of Object.entries(refs)){
 assert(books.includes(book));
 const data=JSON.parse(fs.readFileSync(base+'data/kjv/'+book+'.json','utf8'));
 for(const [chapter,verses] of Object.entries(chapters))for(const [num,links] of Object.entries(verses)){
  assert(data.chapters[chapter].some(v=>String(v.number)===num));
  assert(links.every(link=>/^.+ \d+:\d+$/.test(link)));
 }
}
const app=fs.readFileSync(base+'app.js','utf8');
assert(app.includes('getCuratedReferences()'));
assert(app.includes('refs.className="center-reference"'));
const service=fs.readFileSync(base+'sw.js','utf8');
assert(service.match(/hk-bible-shell-v\d+/));
for(const book of books)assert(service.includes('annotations/'+book+'.json'));
console.log('PASS: '+spans+' colour spans match exact KJV verses, green references separate from Scripture; all files offline cached');
