// STRENGTH FOR TODAY — five-year conservative doctrinal/editorial audit.
// Usage: node apps/heavenly-key-bible/bible/tests/audit-strength-five-years.mjs
// Read-only; never changes publication approval or data files.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../heavenly-key-website/bible');
const names = readdirSync(root).filter(n => /^strength-devotionals-(2026|2027|year[1-5])(?:-batch\d+)?\.json$/.test(n)).sort();
const entries = names.flatMap(name => {
 const data=JSON.parse(readFileSync(resolve(root,name),'utf8'));
 if(!Array.isArray(data.entries))throw Error('Missing entries: '+name);
 return data.entries.map(entry=>({...entry,_file:name}));
}).sort((a,b)=>a.date.localeCompare(b.date));
const norm = value => String(value??'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const normalizeLead = value => norm(value).split(' ').slice(0,12).join(' ');
const topicNames=['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Salvation & Repentance','Faith & Trust','The Holy Spirit','Evangelism & Soul Winning','Love & Christian Unity','The Word & Obedience','Wisdom & Discernment','End-time & Rapture Readiness'];
const flags=[];
const flag=(date,code,details)=>flags.push({date,code,details});
const days=new Set();const refl=new Map();const pray=new Map();const lead=new Map();
const references=Array.from({length:12},()=>new Set());
let topicCount=0;let approved=0;
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 if(days.has(e.date))flag(e.date,'DUPLICATE_DATE',e._file); days.add(e.date);
 if(i&&Date.parse(e.date)-Date.parse(entries[i-1].date)!==86400000)flag(e.date,'DATE_GAP','Previous: '+entries[i-1].date);
 if(e.status==='approved-for-publication')approved++;
 if(!Array.isArray(e.topics)||e.topics.length!==12){flag(e.date,'TOPIC_COUNT','Expected 12');continue;}
 if(e.status!=='draft-not-published')flag(e.date,'PUBLICATION_STATUS','Requires separate documented editorial approval');
 for(let j=0;j<12;j++){
  const t=e.topics[j];topicCount++;
  if(t.topic!==topicNames[j])flag(e.date,'TOPIC_ORDER',String(j));
  if(!t.reference||!t.bibleText||!t.reflection||!t.prayer)flag(e.date,'INCOMPLETE',t.topic);
  references[j].add(t.reference);
  if(t.reflection?.length>280||t.prayer?.length>160)flag(e.date,'LENGTH_LIMIT',t.topic);
  if(t.reviewStatus!=='draft-original-editorial-and-doctrinal-approval-pending')flag(e.date,'REVIEW_STATUS',t.topic);
  for(const [field,value,dict] of [['reflection',t.reflection,refl],['prayer',t.prayer,pray]]){
   const key=norm(value);
   if(dict.has(key))flag(e.date,'EXACT_DUPLICATE_'+field.toUpperCase(),t.topic+' first '+dict.get(key));
   else dict.set(key,e.date+' '+t.topic);
  }
  const key=t.topic+'|'+normalizeLead(t.reflection);
  if(lead.has(key))flag(e.date,'REPEATED_REFLECTION_OPENING',t.topic+' first '+lead.get(key));
  else lead.set(key,e.date);
  if(/(guarantee|certainly) (your )?(instant|immediate|financial|physical) (healing|miracle|wealth)/i.test(t.reflection+' '+t.prayer))flag(e.date,'UNSUPPORTED_PROMISE',t.topic);
  if(/(date|day|month|year) (of|for) (the )?(rapture|second coming)/i.test(t.reflection))flag(e.date,'END_TIME_DATE_SETTING',t.topic);
 }
}
const manifest=JSON.parse(readFileSync(resolve(root,'strength-publication-status.json'),'utf8'));
if(manifest.publicationStatus!=='editorial-hold'||manifest.publishedBatchFiles.length)flag('GLOBAL','RELEASE_GATE','Publication must stay on editorial hold during review');
const doctrine=[
 'Scripture as final authority','Trinity and Christ’s virgin birth, atonement and resurrection',
 'Human sinfulness, repentance, justification by faith','Restitution','Water baptism and Lord’s Supper',
 'Entire sanctification as definite grace subsequent to new birth','Holy Ghost baptism and gifts: purity before power',
 'Healing: handle claims sensitively and avoid guaranteed individual outcomes','Personal evangelism',
 'Marriage doctrine: requires pastoral context and sensitivity','Pre-tribulation rapture and watchfulness without date-setting',
 'Resurrection, Great Tribulation, Second Coming, Millennium, Judgment, New Heaven and Earth, Hell'
];
const result={
 title:'STRENGTH FOR TODAY — Five-year editorial audit (automated, not doctrinal approval)',
 sources:{primary:'https://heavenlykey.org/what-we-believe/',comparison:['https://dclm.org/about/what-we-believe/','https://mountainoffire.org/']},
 note:'Comparison sources guide doctrine and tone, not copying of their devotional text. An automated check cannot verify the theological accuracy or originality of each passage.',
 files:names.length,days:entries.length,range:[entries[0]?.date,entries.at(-1)?.date],topicEntries:topicCount,
 approvedDays:approved,publicationStatus:manifest.publicationStatus,publishedBatches:manifest.publishedBatchFiles.length,
 uniqueScriptureReferencesPerTopic:Object.fromEntries(topicNames.map((n,j)=>[n,references[j].size])),
 flagsByType:flags.reduce((o,f)=>(o[f.code]=(o[f.code]||0)+1,o),{}),
 sampleFlags:flags.slice(0,100),
 manualReviewRequirements:[
  'Every devotional requires Scripture quotation verified against the KJV and contextual reading',
  'Compare meaning to Heavenly Key’s full 22-point Statement of Faith, not just topic labels',
  'Review for genuine insight, prayer specificity, originality, compassion and doctrinal balance',
  'Review Deeper Life doctrine/Daily Manna and MFM teachings as reference standards without reproducing their prose',
  'Document reviewer, version, review date and sign-off for each day before any publication',
  'Block future-dated JSON access at server boundary, not only hide it in the interface'
 ],doctrinalCoverageChecklist:doctrine,
 publicationReady:false
};
console.log(JSON.stringify(result,null,2));
if(entries.length!==1826||topicCount!==21912||flags.some(f=>['DUPLICATE_DATE','DATE_GAP','INCOMPLETE','TOPIC_COUNT','RELEASE_GATE'].includes(f.code)))process.exitCode=1;
