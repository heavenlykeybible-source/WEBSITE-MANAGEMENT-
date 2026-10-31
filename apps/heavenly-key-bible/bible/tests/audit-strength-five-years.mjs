// OUR DAILY MANNA — STRENGTH FOR TODAY: five-year conservative editorial audit.
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
const sectionDefinitions=[
 ['todays-topic',"Today's Topic"],['bible-reading','Bible Reading'],['hymn-of-the-day','Hymn of the Day'],['bible-story','Bible Story'],['world-stories','Life Stories Around the World'],['eternity-in-view','Eternity in View'],['destiny-decision','Destiny Decision & Action'],['warfare-prayer','Warfare Prayer'],['prophetic-prayer','Prophetic Prayer'],['health-wellness-prayer','Health & Wellness Prayer'],['salvation-prayer','Salvation Prayer'],['kingdom-challenges','Kingdom Challenges']
];
const flags=[];
const flag=(date,code,details)=>flags.push({date,code,details});
const days=new Set();const refl=new Map();const pray=new Map();const lead=new Map();
const verseTextByReference=new Map();
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
 !Number.isNaN(Date.parse(value)) && new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const references=Array.from({length:12},()=>new Set());
let topicCount=0;let approved=0;
for(let i=0;i<entries.length;i++){
 const e=entries[i];
 if(!validDate(e.date))flag(e.date,'INVALID_DATE',e._file);
 if(days.has(e.date))flag(e.date,'DUPLICATE_DATE',e._file); days.add(e.date);
 if(i&&Date.parse(e.date)-Date.parse(entries[i-1].date)!==86400000)flag(e.date,'DATE_GAP','Previous: '+entries[i-1].date);
 if(e.status==='approved-for-publication')approved++;
 if(typeof e.centralMessage!=='string'||e.centralMessage.trim().length<8)flag(e.date,'MISSING_CENTRAL_MESSAGE','Daily edition requires its own central message');
 if(typeof e.spiritualFocus!=='string'||e.spiritualFocus.trim().length<8)flag(e.date,'MISSING_SPIRITUAL_FOCUS','Daily edition requires its own spiritual focus');
 if(!Array.isArray(e.sections)||e.sections.length!==12)flag(e.date,'DAILY_SECTION_COUNT','Expected all twelve daily sections');
 else{
  if(!e.sections.every((section,index)=>section&&section.id===sectionDefinitions[index][0]&&section.title===sectionDefinitions[index][1]&&section.reviewStatus==='approved'&&typeof section.content==='string'&&section.content.trim().length>=20))flag(e.date,'DAILY_SECTION_REVIEW','Sections must be complete, correctly ordered and individually approved');
  const reading=e.sections[1],passages=reading?.passages;
  if(!Array.isArray(passages)||passages.length!==6||!passages.every(p=>p&&p.translation==='KJV'&&p.reference&&p.text&&p.reviewStatus==='approved')||passages.filter(p=>p.testament==='old').length!==3||passages.filter(p=>p.testament==='new').length!==3)flag(e.date,'BIBLE_READING_STRUCTURE','Require six approved KJV passages: three Old Testament and three New Testament');
  const hymn=e.sections[2];
  if(!hymn?.hymnTitle||!hymn?.hymnbookReference||hymn.verificationStatus!=='verified')flag(e.date,'HYMN_VERIFICATION','Hymn must be verified against the Heavenly Key hymnbook');
  const bibleStory=e.sections[3];
  if(!bibleStory?.scriptureReference||bibleStory.scriptureTranslation!=='KJV'||bibleStory.scriptureVerification!=='verified'||bibleStory.verificationStatus!=='verified'||bibleStory.topicAlignmentReview!=='approved')flag(e.date,'BIBLE_STORY_VERIFICATION','Bible story requires KJV-verified Scripture and topic-alignment review');
  const worldStory=e.sections[4];
  if(typeof worldStory?.sourceUrl!=='string'||!/^https:\/\//i.test(worldStory.sourceUrl)||!worldStory.sourcePublisher||!worldStory.sourceDate||worldStory.verificationStatus!=='verified'||worldStory.topicAlignmentReview!=='approved')flag(e.date,'WORLD_STORY_VERIFICATION','Contemporary story requires a dated credible source and approved topic alignment');
  const warfareRefs=Array.isArray(e.sections[7]?.scriptureReferences)?e.sections[7].scriptureReferences.map(x=>String(x).toLowerCase()):[];
  if(!warfareRefs.includes('matthew 11:12')||!warfareRefs.includes('luke 18:1'))flag(e.date,'WARFARE_SCRIPTURES','Warfare Prayer must include Matthew 11:12 and Luke 18:1');
  if(e.sections[9]?.medicalDisclaimer!==true)flag(e.date,'HEALTH_DISCLAIMER','Health and Wellness Prayer must not replace professional care');
  const challenges=e.sections[11]?.challenges;
  if(!Array.isArray(challenges)||challenges.length!==12||!challenges.every((x,index)=>x&&x.topic===e.topics?.[index]?.topic&&typeof x.text==='string'&&x.text.trim().length>=8&&x.reviewStatus==='approved'))flag(e.date,'KINGDOM_CHALLENGES','Require twelve approved practical challenges, one mapped to each daily theme');
 }
 if(!Array.isArray(e.topics)||e.topics.length!==12){flag(e.date,'TOPIC_COUNT','Expected 12');continue;}
 if(e.status!=='draft-not-published')flag(e.date,'PUBLICATION_STATUS','Requires separate documented editorial approval');
 for(let j=0;j<12;j++){
  const t=e.topics[j];topicCount++;
  if(t.topic!==topicNames[j])flag(e.date,'TOPIC_ORDER',String(j));
  if(!t.reference||!t.bibleText||!t.reflection||!t.prayer)flag(e.date,'INCOMPLETE',t.topic);
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
if(manifest.publicationStatus!=='editorial-hold'||manifest.publishedBatchFiles.length)flag('GLOBAL','RELEASE_GATE','Publication must stay on editorial hold during review');
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
 if(!e.scripture||!e.title||!e.reflection||!e.prayer)flag(e.date,'INCOMPLETE_DAILY_ENTRY',e._file);
 if(norm(e.reflection).split(' ').length<16)flag(e.date,'THIN_DAILY_REFLECTION',e._file);
 if(i&&e.title===entries[i-1].title&&e.scripture===entries[i-1].scripture)
  flag(e.date,'CONSECUTIVE_REUSED_THEME',e.title);
 for(const t of e.topics||[]){
  if(/consider how this truth shapes|on \d{1,2}\/\d{1,2}|let this teaching guide your response/i.test(t.reflection||''))
   flag(e.date,'TEMPLATE_LANGUAGE',t.topic);
 }
}
const requestedDayTarget=1828;
const expectedStartDate='2026-10-30';
const expectedEndDate='2031-10-31';
if(entries[0]?.date!==expectedStartDate)flag('GLOBAL','DATE_RANGE','Expected start '+expectedStartDate);
if(entries.at(-1)?.date!==expectedEndDate)flag('GLOBAL','DATE_RANGE','Expected end '+expectedEndDate);
const daysNeededToMeetRequest=Math.max(0,requestedDayTarget-entries.length);


// Publication quality gate: automate completeness and originality checks without claiming theological approval.
const qualityBlockingCodes=new Set([
 'DUPLICATE_DATE','DATE_GAP','INCOMPLETE','TOPIC_COUNT','TOPIC_ORDER',
 'INCOMPLETE_DAILY_ENTRY','MISSING_DAY_TITLE','MISSING_DAY_REFLECTION',
 'MISSING_DAY_PRAYER','DUPLICATE_DAY_TITLE','DUPLICATE_DAY_REFLECTION','DUPLICATE_DAY_PRAYER',
 'EXACT_DUPLICATE_REFLECTION','EXACT_DUPLICATE_PRAYER','REPEATED_REFLECTION_OPENING',
 'INCONSISTENT_VERSE_TEXT','INVALID_DATE','DATE_RANGE','CONSECUTIVE_REUSED_THEME',
 'UNSUPPORTED_PROMISE','END_TIME_DATE_SETTING',
 'PUBLICATION_STATUS','REVIEW_STATUS','LENGTH_LIMIT',
 'THIN_DAILY_REFLECTION','TEMPLATE_LANGUAGE','RELEASE_GATE',
 'MISSING_CENTRAL_MESSAGE','MISSING_SPIRITUAL_FOCUS','DAILY_SECTION_COUNT','DAILY_SECTION_REVIEW',
 'BIBLE_READING_STRUCTURE','HYMN_VERIFICATION','BIBLE_STORY_VERIFICATION','WORLD_STORY_VERIFICATION',
 'WARFARE_SCRIPTURES','HEALTH_DISCLAIMER','KINGDOM_CHALLENGES'
]);
const qualityBlockingFlags=flags.filter(f=>qualityBlockingCodes.has(f.code));
const automatedQualityPassed=qualityBlockingFlags.length===0 &&
 entries.length===requestedDayTarget &&
 topicCount===requestedDayTarget*12 &&
 entries.every(e=>e.status==='draft-not-published') &&
 manifest.publicationStatus==='editorial-hold' && manifest.publishedBatchFiles.length===0;

const result={
 title:'OUR DAILY MANNA — STRENGTH FOR TODAY: five-year editorial audit (automated, not doctrinal approval)',
 sources:{primary:'https://heavenlykey.org/what-we-believe/',comparison:['https://dclm.org/about/what-we-believe/','https://mountainoffire.org/']},
 note:'Comparison sources guide doctrine and tone, not copying of their devotional text. An automated check cannot verify the theological accuracy or originality of each passage.',
 files:names.length,days:entries.length,requestedDayTarget,daysNeededToMeetRequest,uniqueDayTitles:titleOccurrences.size,uniqueDayReflections:dailyReflections.size,uniqueDayPrayers:dailyPrayers.size,consistentVerseReferences:verseTextByReference.size,expectedStartDate,expectedEndDate,automatedQualityPassed,qualityBlockingFlagCount:qualityBlockingFlags.length,releaseRecommendation:'BLOCK_PENDING_INDEPENDENT_EDITORIAL_AND_SECURITY_APPROVAL',range:[entries[0]?.date,entries.at(-1)?.date],topicEntries:topicCount,
 approvedDays:approved,publicationStatus:manifest.publicationStatus,publishedBatches:manifest.publishedBatchFiles.length,
 uniqueScriptureReferencesPerTopic:Object.fromEntries(topicNames.map((n,j)=>[n,references[j].size])),
 entriesWithCentralMessage:entries.filter(e=>typeof e.centralMessage==='string'&&e.centralMessage.trim()).length,
 entriesWithSpiritualFocus:entries.filter(e=>typeof e.spiritualFocus==='string'&&e.spiritualFocus.trim()).length,
 entriesWithTwelveSections:entries.filter(e=>Array.isArray(e.sections)&&e.sections.length===12).length,
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
