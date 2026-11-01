#!/usr/bin/env node
// Audit all 1,826 canonical devotional entries without rewriting their original content.
import fs from 'node:fs';
const root=new URL('./manuscript/',import.meta.url);
const files=fs.readdirSync(root).filter(f=>/^revision-50-days-\d{4}-\d{4}\.jsonl$/.test(f)).sort();
const prohibited=[/statement\s+of\s+faith/i,/pastor\s+(?:w\.?\s*f\.?\s*)?kumuyi/i,/deeper\s+(?:christian\s+life|life)/i,/daily\s+manna/i,/mountain\s+of\s+fire/i,/mfm\s+daily/i];
const contentFields=['title','topic','devotional_message','todays_challenge','footer'];
const issues=[];let total=0;
for(const file of files){for(const [index,line] of fs.readFileSync(new URL(file,root),'utf8').split('\n').entries()){if(!line.trim())continue;const d=JSON.parse(line);total++;
const textParts=contentFields.map(k=>[k,d[k]]).concat([['bible_story.title',d.bible_story?.title],['bible_story.narrative',d.bible_story?.narrative],['bible_story.spiritual_lesson',d.bible_story?.spiritual_lesson],['verified_real_life_story.title',d.verified_real_life_story?.title],['verified_real_life_story.narrative',d.verified_real_life_story?.narrative],['verified_real_life_story.application_to_today',d.verified_real_life_story?.application_to_today],['prayers',d.three_prayer_points]]);
for(const [field,value] of textParts){const s=typeof value==='string'?value:JSON.stringify(value??'');for(const term of prohibited)if(term.test(s))issues.push({day:d.day_number,file,line:index+1,field,issue:'External doctrinal review reference mentioned in reader-facing content',term:String(term)});}
if(!d.main_kjv_passage?.reference||!d.main_kjv_passage?.excerpt)issues.push({day:d.day_number,issue:'Missing main KJV'});
if(!Array.isArray(d.supporting_kjv_passages)||d.supporting_kjv_passages.length!==2)issues.push({day:d.day_number,issue:'Supporting passage count is not 2'});
if(!d.bible_story?.narrative)issues.push({day:d.day_number,issue:'Missing Bible narrative'});
if(!d.verified_real_life_story?.narrative)issues.push({day:d.day_number,issue:'Missing worldwide narrative'});
if(!d.todays_challenge)issues.push({day:d.day_number,issue:'Missing challenge'});
if(!d.three_prayer_points)issues.push({day:d.day_number,issue:'Missing prayers'});
}}
const report={canonicalFiles:files.length,days:total,issues,approved:total===1826&&issues.length===0};console.log(JSON.stringify(report,null,2));if(!report.approved)process.exitCode=1;
