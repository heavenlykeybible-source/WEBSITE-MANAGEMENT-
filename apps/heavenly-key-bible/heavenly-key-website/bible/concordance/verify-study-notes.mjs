// Run from any directory: node path/to/concordance/verify-study-notes.mjs
// Offline audit only. Does not publish or deploy commentary.
import {readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const dir=dirname(fileURLToPath(import.meta.url));
const bible=join(dir,'..');
const manifest=JSON.parse(readFileSync(join(bible,'data/kjv/manifest.json'),'utf8'));
const bookByName=new Map(manifest.books.map(b=>[b.name,b]));
const cache=new Map();
const errors=[],warnings=[],seen=new Map(),registered=[];
const page=readFileSync(join(dir,'index.html'),'utf8');
const files=[...page.matchAll(/<script\s+src="\.\/(study-notes-[^"]+\.js)"/g)].map(m=>m[1]);
const context=vm.createContext({window:{registerConcordanceStudyNotes(notes){registered.push(notes)}},Object,Array});
for(const filename of files){
 const path=join(dir,filename);
 if(!existsSync(path)){errors.push('Missing script '+filename);continue}
 try{vm.runInContext(readFileSync(path,'utf8'),context,{filename,timeout:3000})}
 catch(e){errors.push(filename+': '+e.message)}
}
function validReference(ref){
 const m=/^(.+?) (\d+):(\d+)(?:[–-](\d+))?$/.exec(ref);
 if(!m)return false;
 const b=bookByName.get(m[1]);if(!b)return false;
 let book=cache.get(b.code);
 if(!book){const file=join(bible,'data/kjv',b.code+'.json');if(!existsSync(file))return false;book=JSON.parse(readFileSync(file,'utf8'));cache.set(b.code,book)}
 const verses=book.chapters[m[2]];
 return !!verses&&verses.some(v=>v.number===Number(m[3]))&&(!m[4]||verses.some(v=>v.number===Number(m[4])&&Number(m[4])>=Number(m[3])));
}
let count=0,shortExplanations=0,shortContexts=0;
for(const group of registered){
 for(const [ref,note] of Object.entries(group)){
  count++;
  if(seen.has(ref))warnings.push('Duplicate '+ref+' in '+seen.get(ref)+' and a later file');
  seen.set(ref,'study-note scripts');
  if(!validReference(ref))errors.push('Invalid note reference '+ref);
  for(const key of ['explanation','context','references']){
   if(typeof note[key]!=='string'||note[key].trim().length<12)errors.push('Missing or too short '+key+' for '+ref);
  }
  if(note.reviewStatus!=='approved')warnings.push('Pending editorial review: '+ref);
  if(typeof note.explanation==='string'&&note.explanation.trim().split(/\s+/).length<30)shortExplanations++;
  if(typeof note.context==='string'&&note.context.trim().split(/\s+/).length<20)shortContexts++;
  if(typeof note.references==='string'){
   for(const related of note.references.split(/\s*;\s*/).filter(Boolean)){
    if(!validReference(related))errors.push('Invalid cross-reference '+related+' in '+ref);
   }
  }
 }
}
console.log(JSON.stringify({files:files.length,registeredNotes:count,uniqueNotes:seen.size,shortExplanations,shortContexts,versesInCanon:manifest.books.reduce((sum,b)=>sum+b.verses,0),errors:errors.length,warnings:warnings.length,errorExamples:errors.slice(0,100),warningExamples:warnings.filter(x=>!x.startsWith('Pending editorial review')).slice(0,30)},null,2));
if(errors.length)process.exitCode=1;
