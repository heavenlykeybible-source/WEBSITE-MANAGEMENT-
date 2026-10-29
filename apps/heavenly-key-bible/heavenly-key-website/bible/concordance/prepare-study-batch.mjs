#!/usr/bin/env node
// Safely package up to 1,000 original, verse-specific study drafts per batch.
// Example: node prepare-study-batch.mjs ./incoming/notes.json exodus-6-20
// Does not generate explanations, modify the site, deploy or approve notes.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const dir=dirname(fileURLToPath(import.meta.url));
const root=resolve(dir,'..');
const [source,slug]=process.argv.slice(2);
if(!source||!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug||'')){
 console.error('Usage: node prepare-study-batch.mjs path/to/notes.json batch-slug');
 process.exit(2);
}
const input=JSON.parse(readFileSync(resolve(source),'utf8'));
if(!Array.isArray(input)||input.length<1||input.length>1000)throw Error('Provide an array of 1–1,000 study notes.');
const manifest=JSON.parse(readFileSync(join(root,'data/kjv/manifest.json'),'utf8'));
const names=new Map(manifest.books.map(b=>[b.name,b]));
names.set('Psalm',names.get('Psalms'));
const bookCache=new Map();
function canonical(ref){
 const m=/^(.+?) (\d+)(?::(\d+))?(?:[–-](\d+))?$/.exec(ref);
 if(!m)return false;
 const book=names.get(m[1]);
 if(!book)return false;
 if(!m[3]&&book.chapters!==1)return false;
 if(!bookCache.has(book.code))bookCache.set(book.code,JSON.parse(readFileSync(join(root,'data/kjv',book.code+'.json'),'utf8')));
 const ch=m[3]?m[2]:'1',verse=Number(m[3]||m[2]);
 const vv=bookCache.get(book.code).chapters[ch];
 return !!vv&&vv.some(v=>v.number===verse)&&(!m[4]||Number(m[4])>=verse&&vv.some(v=>v.number===Number(m[4])));
}
const page=readFileSync(join(dir,'index.html'),'utf8');
const existing=new Set();
const ctx=vm.createContext({window:{registerConcordanceStudyNotes(notes){Object.keys(notes).forEach(k=>existing.add(k))}}});
const legacy=readFileSync(join(dir,'concordance.js'),'utf8');
const cutoff=legacy.indexOf('const studyNotes=');
if(cutoff<0)throw Error('Cannot locate existing inline notes.');
const inline=vm.createContext({});
vm.runInContext(legacy.slice(0,cutoff),inline,{timeout:5000});
Object.keys(vm.runInContext('notes',inline)).forEach(k=>existing.add(k));
for(const [,filename] of page.matchAll(/<script\s+src="\.\/(study-notes-[^"]+\.js)"/g)){
 const p=join(dir,filename);
 if(!existsSync(p))throw Error('Missing existing script '+filename);
 vm.runInContext(readFileSync(p,'utf8'),ctx,{filename,timeout:5000});
}
const errors=[],refs=new Set(),output=[];
const wordCount=s=>s.trim().split(/\s+/).filter(Boolean).length;
for(const [i,entry] of input.entries()){
 const ref=entry?.ref;
 if(typeof ref!=='string'||!canonical(ref)){errors.push('Entry '+i+': invalid canonical verse '+String(ref));continue}
 if(refs.has(ref)||existing.has(ref)){errors.push('Duplicate or existing commentary: '+ref);continue}
 refs.add(ref);
 const explanation=entry.explanation,context=entry.context;
 const references=Array.isArray(entry.references)?entry.references.join('; '):entry.references;
 if(typeof explanation!=='string'||wordCount(explanation)<30)errors.push(ref+': explanation needs at least 30 words');
 if(typeof context!=='string'||wordCount(context)<20)errors.push(ref+': context needs at least 20 words');
 if(typeof references!=='string'||!references.trim())errors.push(ref+': cross-references missing');
 else for(const cross of references.split(/\s*;\s*/).filter(Boolean))if(!canonical(cross))errors.push(ref+': invalid cross-reference '+cross);
 if(entry.reviewStatus==='approved')errors.push(ref+': cannot self-approve batch content');
 output.push({ref,explanation,context,references,reviewStatus:'pending'});
}
if(errors.length){console.error(JSON.stringify({input:input.length,errors:errors.slice(0,100),totalErrors:errors.length},null,2));process.exit(1)}
const filename='study-notes-'+slug+'.js',dest=join(dir,filename);
if(existsSync(dest))throw Error('Refusing to overwrite '+filename);
const script="'use strict';\n// Original draft commentary. Pending independent doctrinal and historical review.\n(()=>{const entries="+JSON.stringify(output)+";window.registerConcordanceStudyNotes?.(Object.fromEntries(entries.map(({ref,...note})=>[ref,note])));})();\n";
writeFileSync(dest,script,'utf8');
console.log(JSON.stringify({created:dest,verses:output.length,reviewStatus:'pending',nextStep:'Review notes and add <script src="./'+filename+'" defer></script> to index.html. Do not deploy without approval.'},null,2));
