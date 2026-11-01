#!/usr/bin/env node
// Run on checked-out repository. Patches the canonical Rev50 files; preserves all newer supporting passages.
import fs from 'node:fs';
const root=new URL('./manuscript/',import.meta.url);
const patch=JSON.parse(fs.readFileSync(new URL('./REVISION_56_FIRST_WEEK_EDITORIAL_PATCH.json',import.meta.url),'utf8')).repairs;
const kjv=JSON.parse(fs.readFileSync(new URL('./REVISION_51_VERIFIED_MAIN_KJV_PATCH.json',import.meta.url),'utf8')).patches;
const changes=new Map();
for(const p of patch){const a=changes.get(p.day)||[];a.push({field:p.field,value:p.replacement});changes.set(p.day,a)}
for(const p of kjv){const a=changes.get(p.day)||[];a.push({field:'main_kjv_passage.excerpt',value:p.corrected_verse,reference:p.reference});changes.set(p.day,a)}
let modified=0,days=0,files=0;
for(const filename of fs.readdirSync(root).filter(f=>/^revision-50-days-\d{4}-\d{4}\.jsonl$/.test(f)).sort()){
 const file=new URL(filename,root);const raw=fs.readFileSync(file,'utf8');const lines=raw.trimEnd().split('\n');let changed=false;
 const updated=lines.map(line=>{const d=JSON.parse(line);days++;const updates=changes.get(d.day_number);if(!updates)return line;
 for(const u of updates){if(u.reference&&d.main_kjv_passage.reference!==u.reference)throw Error('Reference mismatch day '+d.day_number);
 let target=d;const parts=u.field.split('.');for(const part of parts.slice(0,-1)){if(!target[part])throw Error('Missing field '+u.field+' day '+d.day_number);target=target[part]}target[parts.at(-1)]=u.value;
 }
 d.revision_57={applied_to:'canonical_revision50',changes:updates.map(x=>x.field),preserved_existing_supporting_kjv:true};d.publication_ready=false;modified++;changed=true;return JSON.stringify(d)});
 if(changed){fs.writeFileSync(file,updated.join('\n')+'\n');files++}
}
if(days!==1826||modified!==7)throw Error('Unexpected total: '+JSON.stringify({days,modified,files}));
console.log(JSON.stringify({days,modified,files,publicationApproved:false},null,2));
