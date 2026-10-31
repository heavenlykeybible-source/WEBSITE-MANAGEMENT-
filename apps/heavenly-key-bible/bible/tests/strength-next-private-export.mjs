// Offline-only conversion of original legacy data into unapproved editorial drafts.
// Usage: node strength-next-private-export.mjs /private/empty/output-directory
// Never write to the public web root or overwrite any existing file.
import {readFileSync,readdirSync,writeFileSync,realpathSync,statSync} from 'node:fs';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {migrateLegacyBatch} from './strength-next-migration.mjs';
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible'));
const targetArg=process.argv[2];
if(!targetArg)throw Error('Provide a private, existing, empty output directory');
const out=realpathSync(resolve(targetArg));
if(out===root||out.startsWith(root+sep)||root.startsWith(out+sep))throw Error('Output must be isolated from the public website');
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
const payload={schemaVersion:2,publicationStatus:'editorial-hold',generatedFor:'private-editorial-review-only',entries:converted};
writeFileSync(join(out,'strength-next-private-drafts.json'),JSON.stringify(payload,null,2),{encoding:'utf8',flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PRIVATE_DRAFTS_ONLY',days:converted.length,output:'strength-next-private-drafts.json',publication:'BLOCKED'},null,2));
