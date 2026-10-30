// Manual release gate: node apps/heavenly-key-bible/bible/tests/strength-publication-gate.mjs
// Deliberately fails until every dated devotional passes editorial approval and uniqueness checks.
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const names=['strength-devotionals-2026.json','strength-devotionals-2027-batch01.json','strength-devotionals-year1-batch02.json','strength-devotionals-year1-batch03.json','strength-devotionals-year1-batch04.json','strength-devotionals-year2-batch01.json','strength-devotionals-year2-batch02.json','strength-devotionals-year2-batch03.json','strength-devotionals-year2-batch04.json','strength-devotionals-year3-batch01.json','strength-devotionals-year3-batch02.json','strength-devotionals-year3-batch03.json','strength-devotionals-year3-batch04.json','strength-devotionals-year4-batch01.json','strength-devotionals-year4-batch02.json','strength-devotionals-year4-batch03.json','strength-devotionals-year4-batch04.json','strength-devotionals-year5-batch01.json','strength-devotionals-year5-batch02.json','strength-devotionals-year5-batch03.json','strength-devotionals-year5-batch04.json'];
const normalize=t=>String(t||'').trim().toLowerCase().replace(/\s+/g,' ');
let entries=[];
for(const name of names){
 const doc=JSON.parse(readFileSync(resolve(root,name),'utf8'));
 if(doc.timezone!=='Africa/Lagos'||!Array.isArray(doc.entries))throw Error('Invalid content library '+name);
 entries.push(...doc.entries);
}
const unpublished=entries.filter(e=>e.status!=='approved-for-publication');
const unreviewed=entries.filter(e=>!Array.isArray(e.topics)||e.topics.length!==12||e.topics.some(t=>t.reviewStatus!=='approved'));
const reflections=entries.flatMap(e=>e.topics||[]).map(t=>normalize(t.reflection));
const prayers=entries.flatMap(e=>e.topics||[]).map(t=>normalize(t.prayer));
const duplicateReflections=reflections.length-new Set(reflections).size;
const duplicatePrayers=prayers.length-new Set(prayers).size;
console.log(JSON.stringify({days:entries.length,unpublishedDays:unpublished.length,unreviewedDays:unreviewed.length,duplicateReflections,duplicatePrayers},null,2));
if(unpublished.length||unreviewed.length||duplicateReflections||duplicatePrayers){
 console.error('RELEASE BLOCKED: Unapproved or repetitive devotional content. Verify Scripture text, originality and doctrine before approving release.');
 process.exitCode=1;
}else console.log('Content-level checks passed. Full security and browser audits are still required.');
