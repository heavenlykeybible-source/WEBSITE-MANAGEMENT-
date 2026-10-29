/**
 * Prepare systematic KJV commentary work packets (500–1,000 verses).
 * Read-only with respect to source files; does not generate fake explanations.
 * Usage: node scripts/concordance-prepare-queue.mjs [--size 1000] [--out concordance-work]
 * Node 20+. Packets contain actual KJV verse text and existing draft status.
 * Never mark entries approved automatically. No network/deployment.
 */
import fs from 'node:fs';
import path from 'node:path';
const root='apps/heavenly-key-bible/heavenly-key-website/bible/';
const args=process.argv.slice(2);
const value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const size=Number(value('--size','1000'));
if(!Number.isInteger(size)||size<500||size>1000)throw Error('--size must be an integer from 500 to 1000');
const out=value('--out','concordance-work');
const source=fs.readFileSync(root+'concordance/concordance.js','utf8');
const mapping=source.match(/const books="([^"]+)"\.split\(","\)\.map\(x=>x\.split\(":"\)\)/);
if(!mapping)throw Error('Cannot read the canonical 66-book map from concordance.js');
const matches=mapping[1].split(',').map(pair=>{const [name,code]=pair.split(':');return [null,code,name]});
if(matches.length!==66)throw Error('Expected 66 books, found '+matches.length);
const draftsDir=root+'concordance/drafts/';
const drafts=fs.readdirSync(draftsDir).filter(f=>f.endsWith('.json')).flatMap(f=>JSON.parse(fs.readFileSync(draftsDir+f,'utf8')));
const draftRefs=new Set();
for(const d of drafts){if(draftRefs.has(d.ref))throw Error('Duplicate draft '+d.ref);draftRefs.add(d.ref)}
const canon=[];
for(const [,code,name] of matches){
 const p=root+'data/kjv/'+code+'.json';
 if(!fs.existsSync(p))throw Error('Missing KJV book '+p);
 const book=JSON.parse(fs.readFileSync(p,'utf8'));
 if(book.book!==name)throw Error('Book mismatch '+code+': '+book.book+' vs '+name);
 for(const [chapter,verses] of Object.entries(book.chapters)){
  for(const v of verses){
   if(v.isPlaceholder||!String(v.text||'').trim())throw Error('Missing authentic KJV text '+name+' '+chapter+':'+v.number);
   canon.push({ref:name+' '+chapter+':'+v.number,text:v.text,reviewStatus:draftRefs.has(name+' '+chapter+':'+v.number)?'draft_exists':'not_started'});
  }
 }
}
if(canon.length!==31102)throw Error('Expected exactly 31,102 canonical verses; found '+canon.length);
const unique=new Set(canon.map(v=>v.ref));
if(unique.size!==canon.length)throw Error('Duplicate canonical reference');
const missing=drafts.filter(d=>!unique.has(d.ref));if(missing.length)throw Error('Draft references missing from KJV canon: '+missing.map(v=>v.ref).join(', '));
fs.mkdirSync(out,{recursive:true});
const manifest={canonicalVerses:canon.length,existingDrafts:drafts.length,unwritten:canon.length-drafts.length,packetSize:size,packets:[],notes:'Work queue only: no explanations manufactured, no approval implied. Review historical claims, cross-references, doctrinal alignment and verse-specificity before saving drafts.'};
for(let i=0;i<canon.length;i+=size){
 const slice=canon.slice(i,i+size),filename='kjv-packet-'+String(Math.floor(i/size)+1).padStart(3,'0')+'.json';
 fs.writeFileSync(path.join(out,filename),JSON.stringify(slice,null,2)+'\n');
 manifest.packets.push({file:filename,first:slice[0].ref,last:slice.at(-1).ref,verses:slice.length,unwritten:slice.filter(v=>v.reviewStatus==='not_started').length});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
