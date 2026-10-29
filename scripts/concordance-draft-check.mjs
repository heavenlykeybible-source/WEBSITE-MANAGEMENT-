// Node 20+. Read-only validation of saved Genesis drafts and browser bundle.
// Run: node scripts/concordance-draft-check.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root='apps/heavenly-key-bible/heavenly-key-website/bible/concordance/';
const files=['genesis-1-04-18.json','genesis-1-19-31.json','genesis-2-3.json','genesis-4-5.json','genesis-6.json','genesis-7.json','genesis-8.json','genesis-9.json','genesis-10.json','genesis-11.json','genesis-12.json','genesis-13.json','genesis-14.json','genesis-15.json','genesis-16.json','genesis-17.json','genesis-18.json','genesis-19.json','genesis-20.json','genesis-21.json','genesis-22.json','genesis-23.json','genesis-24.json','genesis-25.json'];
const entries=files.flatMap(f=>JSON.parse(fs.readFileSync(root+'drafts/'+f,'utf8')));
const problems=[];const refs=new Set(), explanations=new Map();
for(const e of entries){
 if(refs.has(e.ref))problems.push('duplicate verse '+e.ref);refs.add(e.ref);
 if(!/^Genesis (?:[1-9]|1[0-9]|2[0-5]):[1-9][0-9]*$/.test(e.ref))problems.push('unexpected reference '+e.ref);
 for(const field of ['explanation','context','application'])if(typeof e[field]!=='string'||!e[field].trim())problems.push(e.ref+': missing '+field);
 if(!Array.isArray(e.crossReferences)||!e.crossReferences.length||e.crossReferences.some(r=>typeof r!=='string'||!r.trim()))problems.push(e.ref+': missing cross-references');
 if(e.reviewStatus!=='pending')problems.push(e.ref+': review status changed without documented approval');
 const norm=String(e.explanation||'').trim().toLowerCase().replace(/\\s+/g,' ');
 if(explanations.has(norm))problems.push('identical explanations: '+e.ref+' and '+explanations.get(norm));explanations.set(norm,e.ref);
}
if(entries.length!==690)problems.push('expected 690 saved Genesis drafts, found '+entries.length);
const registered={};const sandbox={window:{registerConcordanceStudyNotes:notes=>Object.assign(registered,notes)}};
vm.runInNewContext(fs.readFileSync(root+'study-notes-genesis-drafts.js','utf8'),sandbox,{timeout:2000});
if(Object.keys(registered).length!==entries.length)problems.push('browser bundle record count differs');
for(const e of entries){const b=registered[e.ref];if(!b||b.explanation!==e.explanation||b.context!==e.context||b.application!==e.application||b.references!==e.crossReferences.join('; ')||b.reviewStatus!==e.reviewStatus)problems.push('browser bundle mismatch: '+e.ref)}
const html=fs.readFileSync(root+'index.html','utf8');if(!html.includes('study-notes-genesis-drafts.js'))problems.push('browser bundle not loaded');
const engine=fs.readFileSync(root+'concordance.js','utf8');if(!engine.includes('pending human doctrinal review'))problems.push('missing draft review warning');
const report={drafts:entries.length,uniqueVerses:refs.size,pendingReview:entries.filter(e=>e.reviewStatus==='pending').length,errors:problems,passed:problems.length===0,limitations:'Checks structure, exact duplicates and bundle parity; does not verify KJV reference validity, biblical accuracy, doctrinal approval or browser behavior.'};
console.log(JSON.stringify(report,null,2));if(problems.length)process.exitCode=1;
