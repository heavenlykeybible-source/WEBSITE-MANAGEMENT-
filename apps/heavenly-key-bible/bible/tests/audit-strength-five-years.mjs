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
 return data.entries.map((entry,index)=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry))throw Error('Invalid entry in '+name+' at index '+index);
  if(typeof entry.date!=='string')throw Error('Missing or invalid date in '+name+' at index '+index);
  return {...entry,_file:name};
 });
}).sort((a,b)=>a.date.localeCompare(b.date));
const norm = value => String(value??'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
const normalizeLead = value => norm(value).split(' ').slice(0,12).join(' ');
const topicNames=['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Salvation & Repentance','Faith & Trust','The Holy Spirit','Evangelism & Soul Winning','Love & Christian Unity','The Word & Obedience','Wisdom & Discernment','End-time & Rapture Readiness'];
const flags=[];
const flag=(date,code,details)=>flags.push({date,code,details});
const days=new Set();const refl=new Map();const pray=new Map();const lead=new Map();
const verseTextByReference=new Map();
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
 !Number.isNaN(Date.parse(value+'T00:00:00Z')) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const references=Array.from({length:12},()=>new Set());
let topicCount=0;let approved=0;
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 if(!validDate(e.date))flag(e.date,'INVALID_DATE',e._file);
 if(!Array.isArray(e.topics))flag(e.date,'INVALID_TOPICS_TYPE',e._file);
 if(days.has(e.date))flag(e.date,'DUPLICATE_DATE',e._file); days.add(e.date);
 if(i&&Date.parse(e.date)-Date.parse(entries[i-1].date)!==86400000)flag(e.date,'DATE_GAP','Previous: '+entries[i-1].date);
 if(e.status==='approved-for-publication')approved++;
 if(!Array.isArray(e.topics)||e.topics.length!==12){flag(e.date,'TOPIC_COUNT','Expected 12');continue;}
 if(e.status!=='draft-not-published')flag(e.date,'PUBLICATION_STATUS','Requires separate documented editorial approval');
 for(let j=0;j<12;j++){
  const t=e.topics[j];topicCount++;
  if(!t||typeof t!=='object'||Array.isArray(t)){flag(e.date,'INCOMPLETE','Invalid topic object at '+j);continue;}
  if(t.topic!==topicNames[j])flag(e.date,'TOPIC_ORDER',String(j));
  if(![t.reference,t.bibleText,t.reflection,t.prayer].every(v=>typeof v==='string'&&v.trim()))flag(e.date,'INCOMPLETE',t.topic);
  references[j].add(t.reference);
  const keyRef=norm(t.reference);
  const keyVerse=norm(t.bibleText);
  if(keyRef&&keyVerse){
   if(verseTextByReference.has(keyRef)&&verseTextByReference.get(keyRef)!==keyVerse)
    flag(e.date,'INCONSISTENT_VERSE_TEXT',t.reference+' differs between devotional entries');
   else verseTextByReference.set(keyRef,keyVerse);
  }
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
if(manifest.publicationStatus!=='editorial-hold'||!Array.isArray(manifest.publishedBatchFiles)||manifest.publishedBatchFiles.length)flag('GLOBAL','RELEASE_GATE','Publication must stay on editorial hold with an empty approved-file list during review');
const doctrine=[
 'Scripture as final authority','Trinity and Christ’s virgin birth, atonement and resurrection',
 'Human sinfulness, repentance, justification by faith','Restitution','Water baptism and Lord’s Supper',
 'Entire sanctification as definite grace subsequent to new birth','Holy Ghost baptism and gifts: purity before power',
 'Healing: handle claims sensitively and avoid guaranteed individual outcomes','Personal evangelism',
 'Marriage doctrine: requires pastoral context and sensitivity','Pre-tribulation rapture and watchfulness without date-setting',
 'Resurrection, Great Tribulation, Second Coming, Millennium, Judgment, New Heaven and Earth, Hell'
];

// Whole-library triage: flags for human reviewers, never automatic doctrinal approval.
const titleOccurrences=new Map(), dailyReflections=new Map(), dailyPrayers=new Map();
const keepFirst=(map,value,e,kind)=>{
 const key=norm(value);
 if(!key){flag(e.date,'MISSING_'+kind,e._file);return;}
 if(map.has(key))flag(e.date,'DUPLICATE_'+kind,'First occurrence '+map.get(key));
 else map.set(key,e.date);
};
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 keepFirst(titleOccurrences,e.title,e,'DAY_TITLE');
 keepFirst(dailyReflections,e.reflection,e,'DAY_REFLECTION');
 keepFirst(dailyPrayers,e.prayer,e,'DAY_PRAYER');
 if(![e.scripture,e.title,e.reflection,e.prayer].every(v=>typeof v==='string'&&v.trim()))flag(e.date,'INCOMPLETE_DAILY_ENTRY',e._file);
 if(norm(e.reflection).split(' ').length<16)flag(e.date,'THIN_DAILY_REFLECTION',e._file);
 if(i&&e.title===entries[i-1].title&&e.scripture===entries[i-1].scripture)
  flag(e.date,'CONSECUTIVE_REUSED_THEME',e.title);
 for(const t of e.topics||[]){
  if(/consider\s+.{4,140}\s+in the light of this truth/i.test(t.reflection||'')) flag(e.date,'MECHANICAL_REFLECTION_FORMULA',t.topic);
  if(/\bas i face\s+(?:a|an|the)\s+.{2,70}\byou (?:have|are|will)\b/i.test(t.prayer||'')) flag(e.date,'INCONSISTENT_PRAYER_PERSON',t.topic);
  if(/consider how this truth shapes|on \d{1,2}\/\d{1,2}|let this teaching guide your response/i.test(t.reflection||''))
   flag(e.date,'TEMPLATE_LANGUAGE',t.topic);
 }
}
const requestedDayTarget=1828;
// Calendar target must agree with the declared inclusive date range.
const expectedCalendarDays=Math.round((Date.parse('2031-10-31')-Date.parse('2026-10-30'))/86400000)+1;
if(expectedCalendarDays!==requestedDayTarget)flag('GLOBAL','CALENDAR_TARGET_MISMATCH','Target '+requestedDayTarget+' vs inclusive dates '+expectedCalendarDays);
const expectedStartDate='2026-10-30';
const expectedEndDate='2031-10-31';
if(entries[0]?.date!==expectedStartDate)flag('GLOBAL','DATE_RANGE','Expected start '+expectedStartDate);
if(entries.at(-1)?.date!==expectedEndDate)flag('GLOBAL','DATE_RANGE','Expected end '+expectedEndDate);
const daysNeededToMeetRequest=Math.max(0,requestedDayTarget-entries.length);


// Publication quality gate: automate completeness and originality checks without claiming theological approval.
const qualityBlockingCodes=new Set([
 'DUPLICATE_DATE','DATE_GAP','INCOMPLETE','TOPIC_COUNT','TOPIC_ORDER','INVALID_TOPICS_TYPE',
 'INCOMPLETE_DAILY_ENTRY','MISSING_DAY_TITLE','MISSING_DAY_REFLECTION',
 'MISSING_DAY_PRAYER','DUPLICATE_DAY_TITLE','DUPLICATE_DAY_REFLECTION','DUPLICATE_DAY_PRAYER',
 'EXACT_DUPLICATE_REFLECTION','EXACT_DUPLICATE_PRAYER','REPEATED_REFLECTION_OPENING',
 'INCONSISTENT_VERSE_TEXT','INVALID_DATE','DATE_RANGE','CALENDAR_TARGET_MISMATCH','CONSECUTIVE_REUSED_THEME',
 'UNSUPPORTED_PROMISE','END_TIME_DATE_SETTING',
 'PUBLICATION_STATUS','REVIEW_STATUS','LENGTH_LIMIT',
 'THIN_DAILY_REFLECTION','TEMPLATE_LANGUAGE','MECHANICAL_REFLECTION_FORMULA','INCONSISTENT_PRAYER_PERSON','RELEASE_GATE'
]);
const qualityBlockingFlags=flags.filter(f=>qualityBlockingCodes.has(f.code));
const automatedQualityPassed=qualityBlockingFlags.length===0 &&
 entries.length===requestedDayTarget &&
 topicCount===requestedDayTarget*12 &&
 entries.every(e=>e.status==='draft-not-published') &&
 manifest.publicationStatus==='editorial-hold' && Array.isArray(manifest.publishedBatchFiles) && manifest.publishedBatchFiles.length===0;

const result={
 title:'STRENGTH FOR TODAY — Five-year editorial audit (automated, not doctrinal approval)',
 sources:{primary:'https://heavenlykey.org/what-we-believe/',comparison:['https://dclm.org/about/what-we-believe/','https://mountainoffire.org/']},
 note:'Comparison sources guide doctrine and tone, not copying of their devotional text. An automated check cannot verify the theological accuracy or originality of each passage.',
 files:names.length,days:entries.length,requestedDayTarget,daysNeededToMeetRequest,uniqueDayTitles:titleOccurrences.size,uniqueDayReflections:dailyReflections.size,uniqueDayPrayers:dailyPrayers.size,consistentVerseReferences:verseTextByReference.size,expectedStartDate,expectedEndDate,automatedQualityPassed,qualityBlockingFlagCount:qualityBlockingFlags.length,releaseRecommendation:'BLOCK_PENDING_INDEPENDENT_EDITORIAL_AND_SECURITY_APPROVAL',range:[entries[0]?.date,entries.at(-1)?.date],topicEntries:topicCount,
 approvedDays:approved,publicationStatus:manifest.publicationStatus,publishedBatches:Array.isArray(manifest.publishedBatchFiles)?manifest.publishedBatchFiles.length:null,
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
if(!automatedQualityPassed) {
 console.error('EDITORIAL QUALITY BLOCKED: unresolved duplicates, templated copy, incomplete data or missing requested dates. Human doctrinal and KJV approval still required.');
 process.exitCode=1;
}
