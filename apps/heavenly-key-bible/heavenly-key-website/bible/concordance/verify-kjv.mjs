// Run from any working directory: node apps/heavenly-key-bible/heavenly-key-website/bible/concordance/verify-kjv.mjs
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const base=new URL('../data/kjv/',import.meta.url);
const codes='GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
const failures=[];let chapterCount=0,verseCount=0;
for(const code of codes){
 try{
  const data=JSON.parse(await readFile(new URL(code+'.json',base),'utf8'));
  const chapters=Object.entries(data.chapters||{});
  if(!chapters.length)throw Error('no chapters');
  for(let c=0;c<chapters.length;c++){
   const [number,verses]=chapters[c];if(Number(number)!==c+1||!Array.isArray(verses)||!verses.length)throw Error('invalid chapter '+number);
   for(let v=0;v<verses.length;v++){const item=verses[v];if(item.number!==v+1||typeof item.text!=='string'||!item.text.trim()||item.isPlaceholder)throw Error('missing/placeholder '+number+':'+(v+1));verseCount++}
   chapterCount++;
  }
 }catch(error){failures.push(code+': '+error.message)}
}
console.log(JSON.stringify({booksChecked:codes.length,chaptersChecked:chapterCount,versesChecked:verseCount,failures},null,2));
if(failures.length||chapterCount!==1189||verseCount!==31102)process.exitCode=1;
