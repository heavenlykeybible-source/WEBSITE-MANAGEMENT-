import assert from 'node:assert/strict';
import fs from 'node:fs';
const b='heavenly-key-website/bible/';
const source=fs.readFileSync(b+'study-extensions.js','utf8');
const glossary=JSON.parse(fs.readFileSync(b+'original-language-guide.json','utf8'));
const books=JSON.parse(fs.readFileSync(b+'data/kjv/manifest.json','utf8')).books;
assert(source.includes('Find English word in KJV'));
assert(source.includes('These are independent English KJV searches'));
assert(source.includes('Read example KJV verse'));
for(const item of glossary){
 const match=/^(.+?) (\d+):(\d+)$/.exec(item.reference);
 assert(match,item.english);
 const book=books.find(b=>b.name===match[1]);assert(book,item.reference);
 const data=JSON.parse(fs.readFileSync(b+'data/kjv/'+book.code+'.json','utf8'));
 assert((data.chapters[match[2]]||[]).some(v=>String(v.number)===match[3]),item.reference);
}
console.log('PASS: all '+glossary.length+' original-language guide examples resolve to KJV and link to English concordance');
