import assert from 'node:assert/strict';
export const SECTION_KEYS=Object.freeze(['topic','bibleReading','hymn','bibleStory','worldStory','eternity','decision','warfare','propheticPrayer','healthPrayer','salvation','challenges']);
export const CHALLENGE_COUNT=12;
export const FAITH_STATEMENT_URL='https://heavenlykey.org/what-we-believe/';
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const validSourceUrl=value=>{if(!nonempty(value)||value.length>2048)return false;try{const u=new URL(value);return u.protocol==='https:'&&Boolean(u.hostname)&&!u.username&&!u.password&&!u.hash&&u.hostname.includes('.')}catch{return false}};
const bibleReference=value=>nonempty(value)&&/^[1-3]?\s?[A-Za-z][A-Za-z ]+\s+\d+:\d+(?:-\d+)?$/.test(value);
export function validateDailyDevotional(entry){
 const errors=[];
 if(!entry||typeof entry!=='object'||Array.isArray(entry))return ['Entry must be an object'];
 if(typeof entry.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)||!Number.isFinite(Date.parse(entry.date))||new Date(entry.date).toISOString().slice(0,10)!==entry.date)errors.push('Invalid ISO date');
 if(entry.status!=='draft'&&entry.status!=='approved-for-publication')errors.push('Invalid publication status');
 if(!entry.sections||typeof entry.sections!=='object'||Array.isArray(entry.sections))return errors.concat('Missing sections');
 const s=entry.sections;
 for(const key of SECTION_KEYS)if(!Object.hasOwn(s,key))errors.push('Missing section: '+key);
 if(!nonempty(s.topic?.title))errors.push('Missing daily topic title');
 if(!Array.isArray(s.bibleReading?.oldTestament)||s.bibleReading.oldTestament.length!==3)errors.push('Require exactly three Old Testament readings');
 if(!Array.isArray(s.bibleReading?.newTestament)||s.bibleReading.newTestament.length!==3)errors.push('Require exactly three New Testament readings');
 for(const group of ['oldTestament','newTestament'])for(const item of (Array.isArray(s.bibleReading?.[group])?s.bibleReading[group]:[])){
  if(!bibleReference(item?.reference)||!nonempty(item?.kjvText))errors.push('Missing reference or displayed KJV text in '+group);
 }
 if(!nonempty(s.hymn?.collection)||!Number.isInteger(s.hymn?.number)||s.hymn.number<1||!nonempty(s.hymn?.title))errors.push('Hymn collection, number and title required');
 if(!bibleReference(s.bibleStory?.reference)||!nonempty(s.bibleStory?.summary))errors.push('Bible story and Scripture source required');
 if(!nonempty(s.worldStory?.summary)||!nonempty(s.worldStory?.sourceUrl)||!validSourceUrl(s.worldStory.sourceUrl))errors.push('World story requires documented HTTPS source');
 if(!nonempty(s.worldStory?.publisher)||s.worldStory.publisher.length>200)errors.push('World story requires named publisher');
 if(!nonempty(s.worldStory?.publishedDate)||!/^\d{4}-\d{2}-\d{2}$/.test(s.worldStory.publishedDate)||!Number.isFinite(Date.parse(s.worldStory.publishedDate))||new Date(s.worldStory.publishedDate).toISOString().slice(0,10)!==s.worldStory.publishedDate)errors.push('World story requires a valid publication date');
 if(typeof entry.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(entry.date)&&typeof s.worldStory?.publishedDate==='string'&&s.worldStory.publishedDate>entry.date)errors.push('World story publication cannot postdate the devotional');
 for(const key of ['eternity','decision','propheticPrayer','healthPrayer','salvation'])if(!nonempty(s[key]?.text))errors.push('Missing '+key+' text');
 if(!Array.isArray(s.warfare?.prayerPoints)||s.warfare.prayerPoints.length!==3||!s.warfare.prayerPoints.every(nonempty))errors.push('Three warfare prayer points required');
 if(!Array.isArray(s.warfare?.permanentReferences)||!['Matthew 11:12','Luke 18:1'].every(ref=>s.warfare.permanentReferences.includes(ref)))errors.push('Permanent warfare references missing');
 if(!Array.isArray(s.challenges)||s.challenges.length!==CHALLENGE_COUNT||!s.challenges.every(c=>nonempty(c?.theme)&&nonempty(c?.text)))errors.push('Twelve named daily challenges required');
 if(Array.isArray(s.challenges)&&s.challenges.length===CHALLENGE_COUNT){const themes=s.challenges.map(c=>typeof c?.theme==='string'?c.theme.trim().toLowerCase():'');if(new Set(themes).size!==CHALLENGE_COUNT)errors.push('Daily challenge themes must be unique');}
 if(entry.status==='approved-for-publication'&&(entry.provenance?.requiresEditorialRewrite===true||entry.provenance?.requiresScriptureVerification===true||entry.provenance?.requiresOriginalEditorialContent===true))errors.push('Unresolved editorial provenance blocks publication');
 if(entry.status==='approved-for-publication'&&(!nonempty(entry.review?.approvedBy)||!nonempty(entry.review?.approvedAt)))errors.push('Publication approval audit details required');
 if(entry.status==='approved-for-publication'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(entry.review?.approvedAt||'')||!Number.isFinite(Date.parse(entry.review.approvedAt))||new Date(entry.review.approvedAt).toISOString()!==entry.review.approvedAt))errors.push('Publication approval timestamp must be valid UTC ISO 8601');
 if(entry.status==='approved-for-publication'&&entry.review?.doctrinalApproved!==true)errors.push('Doctrinal approval required');
 if(entry.status==='approved-for-publication'&&entry.review?.faithStatementUrl!==FAITH_STATEMENT_URL)errors.push('Approval must identify the current Heavenly Key Statement of Faith');
 if(entry.status==='approved-for-publication'&&entry.review?.sourcesVerified!==true)errors.push('Source verification required');
 return errors;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const empty={date:'2026-10-31',status:'draft',sections:{}};
 const errors=validateDailyDevotional(empty);
 assert.ok(errors.includes('Missing section: bibleReading'));
 assert.ok(errors.includes('Missing section: challenges'));
 assert.equal(SECTION_KEYS.length,12);
 console.log('Strength for Today: 12-section content contract checks passed');
}
