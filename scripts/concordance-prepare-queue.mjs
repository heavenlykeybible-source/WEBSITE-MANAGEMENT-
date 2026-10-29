/** Prepare only missing verses. Default 500; never manufactures commentary.
 * node scripts/concordance-prepare-queue.mjs --size 500 --out /tmp/concordance-work
 * Genesis 1:1-3 legacy records are held for a separate audit, not counted as drafts.
 */
import fs from 'node:fs';
import path from 'node:path';
import {loadCanon,loadDrafts,hash} from './concordance-core.mjs';
const args=process.argv.slice(2),value=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const size=Number(value('--size','500'));
if(size!==500&&!(size===1000&&args.includes('--allow-1000')))throw Error('Use 500; 1000 additionally requires --allow-1000 after editorial reliability assessment');
const out=value('--out','concordance-work');
const {canon,byRef,books,chapters}=loadCanon(),{entries}=loadDrafts();
const existing=new Set();
for(const e of entries){if(!byRef.has(e.ref)||existing.has(e.ref))throw Error('Invalid/duplicate draft '+e.ref);existing.add(e.ref)}
const legacyAudit=['Genesis 1:1','Genesis 1:2','Genesis 1:3'].filter(r=>!existing.has(r));
const missing=canon.filter(v=>!existing.has(v.ref)&&!legacyAudit.includes(v.ref));
const manifest={canonicalVerses:canon.length,books:books.length,chapters,existingDrafts:existing.size,remainingOutsideDraftSet:canon.length-existing.size,legacyAudit,packetSize:size,canonHash:hash(JSON.stringify(canon)),packets:[],limitations:'Packets are authoring work only. Legacy and other older commentary are not counted as completed drafts. Automation cannot certify historical, semantic, copyright or doctrinal accuracy.'};
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'canon.json'),JSON.stringify(canon,null,2)+'\n');
for(let i=0;i<missing.length;i+=size){
 const packet=missing.slice(i,i+size).map(v=>({...v,kjvTextHash:hash(v.text),reviewStatus:'not_started'}));
 const file='kjv-packet-'+String(i/size+1).padStart(3,'0')+'.json';
 fs.writeFileSync(path.join(out,file),JSON.stringify(packet,null,2)+'\n');
 manifest.packets.push({file,first:packet[0].ref,last:packet.at(-1).ref,verses:packet.length});
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({...manifest,packets:manifest.packets.slice(0,2),packetCount:manifest.packets.length},null,2));
