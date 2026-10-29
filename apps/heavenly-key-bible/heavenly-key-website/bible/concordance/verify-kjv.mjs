// Run from any working directory: node apps/heavenly-key-bible/heavenly-key-website/bible/concordance/verify-kjv.mjs
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('../data/kjv/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',base),'utf8'));
const codes=manifest.books.map(b=>b.code);
const failures=[];let chapterCount=0,verseCount=0;
for(const code of codes){
 try{
  const data=JSON.parse(await readFile(new URL(code+'.json',base),'utf8'));
  const chapters=Object.entries(data.chapters||{});
  if(!chapters.length)throw Error('no chapters');
  const expected=manifest.books.find(b=>b.code===code);
  if(chapters.length!==expected.chapters)throw Error('chapter count mismatch');
  let bookVerses=0;
  for(let c=0;c<chapters.length;c++){
   const [number,verses]=chapters[c];if(Number(number)!==c+1||!Array.isArray(verses)||!verses.length)throw Error('invalid chapter '+number);
   for(let v=0;v<verses.length;v++){const item=verses[v];if(item.number!==v+1||typeof item.text!=='string'||!item.text.trim()||item.isPlaceholder)throw Error('missing/placeholder '+number+':'+(v+1));verseCount++;bookVerses++}
   chapterCount++;
  }
  if(bookVerses!==expected.verses)throw Error('verse count mismatch: '+bookVerses+' vs '+expected.verses);
 }catch(error){failures.push(code+': '+error.message)}
}
console.log(JSON.stringify({booksChecked:codes.length,chaptersChecked:chapterCount,versesChecked:verseCount,failures},null,2));
if(failures.length||chapterCount!==1189||verseCount!==31102)process.exitCode=1;
