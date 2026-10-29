/** Read-only full-canon, draft and bundle audit. No theological certification. */
import fs from 'node:fs';
import vm from 'node:vm';
import {study,loadCanon,loadDrafts,validateEntries} from './concordance-core.mjs';
const {canon,byRef,books,chapters}=loadCanon(),{entries}=loadDrafts();
const result=validateEntries(entries,byRef);
// Preserve older records; enforce the new schema only where text binding was added.
for(const e of entries.filter(e=>'kjvTextHash' in e))result.errors.push(...validateEntries([e],byRef,{strict:true}).errors);
const registered={},sandbox={window:{registerConcordanceStudyNotes:notes=>Object.assign(registered,notes)}};
vm.runInNewContext(fs.readFileSync(study+'study-notes-genesis-drafts.js','utf8'),sandbox,{timeout:5000});
if(Object.keys(registered).length!==entries.length)result.errors.push('Bundle count differs');
for(const e of entries){const b=registered[e.ref];for(const [key,value] of Object.entries({explanation:e.explanation,context:e.context,application:e.application,references:e.crossReferences.join('; '),reviewStatus:e.reviewStatus,historicalContext:e.historicalContext,reviewFlags:e.reviewFlags,publicationHold:e.publicationHold}))if(JSON.stringify(b?.[key])!==JSON.stringify(value))result.errors.push(e.ref+': bundle mismatch '+key)}
if(!fs.readFileSync(study+'index.html','utf8').includes('study-notes-genesis-drafts.js'))result.errors.push('Missing bundle script');
const refs=new Set(entries.map(e=>e.ref));
console.log(JSON.stringify({canonicalVerses:canon.length,books:books.length,chapters,drafts:entries.length,uniqueVerses:refs.size,pendingReview:entries.filter(e=>e.reviewStatus==='pending').length,remainingOutsideDraftSet:canon.length-refs.size,nextMissing:canon.find(v=>!refs.has(v.ref)&&!['Genesis 1:1','Genesis 1:2','Genesis 1:3'].includes(v.ref))?.ref,legacyAudit:['Genesis 1:1','Genesis 1:2','Genesis 1:3'].filter(r=>!refs.has(r)),errors:result.errors,legacySchemaWarnings:result.warnings.length,flaggedEntries:entries.filter(e=>e.reviewFlags?.length).map(e=>({ref:e.ref,flags:e.reviewFlags})),passed:!result.errors.length,limitations:'Validates local data structure, numbering, reference existence, exact duplicates, new text binding and bundle parity. Does not certify semantic relevance, historical truth, absence of plagiarism, doctrine, or human approval. Legacy schema warnings remain unresolved.'},null,2));
if(result.errors.length)process.exitCode=1;
