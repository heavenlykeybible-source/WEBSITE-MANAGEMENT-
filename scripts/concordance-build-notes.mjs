/** Deterministically rebuild the existing browser bundle from chapter JSON. */
import fs from 'node:fs';
import {study,loadDrafts} from './concordance-core.mjs';
const {entries}=loadDrafts(),notes={};
for(const {ref,explanation,context,crossReferences,application,reviewStatus,historicalContext,reviewFlags,publicationHold} of entries){
 if(notes[ref])throw Error('Duplicate '+ref);
 notes[ref]={explanation,context,references:crossReferences.join('; '),application,reviewStatus};
 if(historicalContext)notes[ref].historicalContext=historicalContext;
 if(reviewFlags)notes[ref].reviewFlags=reviewFlags;
 if(publicationHold)notes[ref].publicationHold=true;
}
const content="'use strict';\n// Generated from drafts/*.json. Pending means unreviewed, never approved.\n(function(){\nconst notes="+JSON.stringify(notes,null,2)+";\nif(typeof window.registerConcordanceStudyNotes==='function')window.registerConcordanceStudyNotes(notes);\n})();\n";
if(process.argv.includes('--check')){if(fs.readFileSync(study+'study-notes-genesis-drafts.js','utf8')!==content)throw Error('Browser bundle stale')}else fs.writeFileSync(study+'study-notes-genesis-drafts.js',content);
console.log(JSON.stringify({registeredDrafts:entries.length,mode:process.argv.includes('--check')?'check':'build'}));
