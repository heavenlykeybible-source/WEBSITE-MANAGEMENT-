// Offline-only conversion of original legacy data into unapproved editorial drafts.
// Usage: node strength-next-private-export.mjs /private/empty/output-directory
// Never write to the public web root or overwrite any existing file.
import {readFileSync,readdirSync,writeFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {migrateLegacyBatch} from './strength-next-migration.mjs';
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible'));
const repositoryRoot=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../../..'));
const targetArg=process.argv[2];
if(!targetArg)throw Error('Provide a private, existing, empty output directory');
const out=realpathSync(resolve(targetArg));
if(out===repositoryRoot||out.startsWith(repositoryRoot+sep)||repositoryRoot.startsWith(out+sep))throw Error('Private export must be outside the repository and its ancestors');
if(!statSync(out).isDirectory()||readdirSync(out).length)throw Error('Output directory must exist and be empty');
const files=readdirSync(root).filter(n=>/^strength-devotionals-(2026|2027|year[1-5])(?:-batch\d+)?\.json$/.test(n)).sort();
if(!files.length)throw Error('No source batches found');
const converted=[];const dates=new Set();
for(const name of files){
 const drafts=migrateLegacyBatch(JSON.parse(readFileSync(join(root,name),'utf8')));
 for(const draft of drafts){
  if(dates.has(draft.date))throw Error('Duplicate date across batches: '+draft.date);
  dates.add(draft.date);
  if(draft.status!=='draft'||draft.review.doctrinalApproved||draft.review.sourcesVerified)throw Error('Unsafe editorial state');
  converted.push(draft);
 }
}
const expectedStart='2026-10-30', expectedEnd='2031-10-31';
const missingDates=[];
for(let t=Date.parse(expectedStart+'T00:00:00Z');t<=Date.parse(expectedEnd+'T00:00:00Z');t+=86400000){const date=new Date(t).toISOString().slice(0,10);if(!dates.has(date))missingDates.push(date)}
const missingSectionCounts={hymn:0,bibleStory:0,worldStory:0,eternity:0,decision:0,propheticPrayer:0,healthPrayer:0,salvation:0};
const incompleteReadingDays={oldTestament:0,newTestament:0};
let incompleteWarfareDays=0;
for(const entry of converted){
 if(entry.sections.bibleReading.oldTestament.length!==3)incompleteReadingDays.oldTestament++;
 if(entry.sections.bibleReading.newTestament.length!==3)incompleteReadingDays.newTestament++;
 if(entry.sections.warfare.prayerPoints.length!==3)incompleteWarfareDays++;
}
for(const entry of converted)for(const key of Object.keys(missingSectionCounts))if(entry.sections[key]===null)missingSectionCounts[key]++;
const missingDayDrafts=missingDates.map(date=>({date,status:'draft',review:{doctrinalApproved:false,sourcesVerified:false},provenance:{format:'missing-legacy-date',requiresOriginalEditorialContent:true},sections:{topic:null,bibleReading:{oldTestament:[],newTestament:[]},hymn:null,bibleStory:null,worldStory:null,eternity:null,decision:null,warfare:{permanentReferences:['Matthew 11:12','Luke 18:1'],prayerPoints:[]},propheticPrayer:null,healthPrayer:null,salvation:null,challenges:[]}}));
const payload={schemaVersion:2,publicationStatus:'editorial-hold',generatedFor:'private-editorial-review-only',coverage:{start:expectedStart,end:expectedEnd,sourceDays:converted.length,missingDates,complete:false,missingSectionCounts,incompleteReadingDays,incompleteWarfareDays,editorialApprovalRequired:true},missingDayDrafts,entries:converted};
writeFileSync(join(out,'strength-next-private-drafts.json'),JSON.stringify(payload,null,2),{encoding:'utf8',flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PRIVATE_DRAFTS_ONLY',days:converted.length,incompleteReadingDays,incompleteWarfareDays,missingDates,missingDayDrafts:missingDayDrafts.length,output:'strength-next-private-drafts.json',publication:'BLOCKED'},null,2));
