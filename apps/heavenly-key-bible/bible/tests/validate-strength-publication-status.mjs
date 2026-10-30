// Run: node apps/heavenly-key-bible/bible/tests/validate-strength-publication-status.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const manifest=JSON.parse(readFileSync(resolve(root,'strength-publication-status.json'),'utf8'));
assert.equal(manifest.schemaVersion,1);
assert(Array.isArray(manifest.publishedBatchFiles),'Approved-batch list required');
assert.equal(new Set(manifest.publishedBatchFiles).size,manifest.publishedBatchFiles.length,'Duplicate batch in allowlist');
assert(['editorial-hold','published'].includes(manifest.publicationStatus),'Invalid publication state');
const known=['strength-devotionals-2026.json','strength-devotionals-2027-batch01.json','strength-devotionals-year1-batch02.json','strength-devotionals-year1-batch03.json','strength-devotionals-year1-batch04.json','strength-devotionals-year2-batch01.json','strength-devotionals-year2-batch02.json','strength-devotionals-year2-batch03.json','strength-devotionals-year2-batch04.json','strength-devotionals-year3-batch01.json','strength-devotionals-year3-batch02.json','strength-devotionals-year3-batch03.json','strength-devotionals-year3-batch04.json','strength-devotionals-year4-batch01.json','strength-devotionals-year4-batch02.json','strength-devotionals-year4-batch03.json','strength-devotionals-year4-batch04.json','strength-devotionals-year5-batch01.json','strength-devotionals-year5-batch02.json','strength-devotionals-year5-batch03.json','strength-devotionals-year5-batch04.json'];
for(const file of manifest.publishedBatchFiles){
 assert(known.includes(file),'Unknown or unexpected public devotional batch '+file);
 const batch=JSON.parse(readFileSync(resolve(root,file),'utf8'));
 assert.equal(batch.timezone,'Africa/Lagos',file);
 assert(Array.isArray(batch.entries)&&batch.entries.length>0,'Empty approved batch '+file);
 for(const entry of batch.entries){
  assert.equal(entry.status,'approved-for-publication','Unapproved dated devotional in '+file);
  assert(Array.isArray(entry.topics)&&entry.topics.length===12,'Missing approved topics in '+file);
  assert(entry.topics.every(topic=>topic.reviewStatus==='approved'),'Unreviewed topic in '+file);
 }
}
if(manifest.publicationStatus==='editorial-hold')assert.equal(manifest.publishedBatchFiles.length,0,'Editorial hold cannot expose any batch');
if(manifest.publicationStatus==='published')assert(manifest.publishedBatchFiles.length>0,'Published status requires an approved batch');
console.log('PASS: publication allowlist valid; publicly approved batches:',manifest.publishedBatchFiles.length);
console.log('NOTE: this verifies source files, not CDN or direct static URL access.');
