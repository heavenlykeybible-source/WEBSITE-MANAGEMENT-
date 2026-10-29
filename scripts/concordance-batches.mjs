/** Validate original AI-authored intake against repository KJV and all saved drafts.
 * node scripts/concordance-batches.mjs validate canon.json batch.json [...]
 * A smaller checkpoint is accepted and reported honestly. No content generation,
 * source mutation, automatic human approval, or publication occurs here.
 */
import fs from 'node:fs';
import {loadCanon,loadDrafts,validateEntries} from './concordance-core.mjs';
const [command,canonPath,...paths]=process.argv.slice(2);
if(command!=='validate'||!canonPath||!paths.length){console.error('Usage: validate canon.json batch.json [...]');process.exit(2)}
const {canon,byRef}=loadCanon();
const supplied=JSON.parse(fs.readFileSync(canonPath,'utf8'));
if(JSON.stringify(supplied)!==JSON.stringify(canon))throw Error('Input canon differs from repository KJV');
const incoming=paths.flatMap(p=>{const x=JSON.parse(fs.readFileSync(p,'utf8'));if(!Array.isArray(x))throw Error('Expected array '+p);return x});
if(!incoming.length||incoming.length>1000)throw Error('Intake must contain 1–1000 records');
const {entries}=loadDrafts(),existing=new Set(entries.map(e=>e.ref));
const result=validateEntries(incoming,byRef,{strict:true});
for(const e of incoming)if(existing.has(e.ref))result.errors.push(e.ref+': already saved; refusing duplicate intake');
// Also compare new explanations with existing explanations.
const combined=validateEntries([...entries,...incoming],byRef);
result.errors=[...new Set([...result.errors,...combined.errors])];
console.log(JSON.stringify({submitted:incoming.length,target:500,partialCheckpoint:incoming.length<500,pending:incoming.filter(e=>e.reviewStatus==='pending').length,reviewFlags:incoming.filter(e=>e.reviewFlags?.length).map(e=>({ref:e.ref,flags:e.reviewFlags})),...result,passed:!result.errors.length,limitations:'Reference existence and text binding are automated. Relevance, history, originality against external works and doctrinal correctness require human review.'},null,2));
if(result.errors.length)process.exitCode=1;
