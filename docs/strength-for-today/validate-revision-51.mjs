#!/usr/bin/env node
// Strength for Today. Fails closed on publication-grade content defects.
// Run: node docs/strength-for-today/validate-revision-51.mjs
import fs from 'node:fs';
import path from 'node:path';
const root=new URL('./manuscript/', import.meta.url);
const files=fs.readdirSync(root).filter(x=>/^revision-50-days-\d{4}-\d{4}\.jsonl$/.test(x)).sort();
if(files.length!==11){console.error('Expected exactly 11 revision-50 JSONL chunks; found',files.length);process.exitCode=1;}
const days=files.flatMap(f=>fs.readFileSync(new URL(f,root),'utf8').trim().split('\n').filter(Boolean).map((line,i)=>{try{return JSON.parse(line)}catch(err){throw Error(f+':'+(i+1)+': '+err.message)}}));
const errors=[], storyNames=new Map(), historicalNames=new Map();
const normalize=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const expectedStart=new Date('2026-10-30T00:00:00Z').getTime();
for(let i=0;i<days.length;i++){
 const d=days[i], expectedDate=new Date(expectedStart+i*86400000).toISOString().slice(0,10);
 if(d.day_number!==i+1)errors.push('day '+(i+1)+': wrong day number');
 if(d.date!==expectedDate)errors.push('day '+(i+1)+': wrong date');
 if(!d.main_kjv_passage?.reference||!d.main_kjv_passage?.excerpt?.trim())errors.push('day '+(i+1)+': missing main passage');
 if(d.supporting_kjv_passages?.length!==2||d.supporting_kjv_passages.some(s=>!s.reference||!s.excerpt?.trim()))errors.push('day '+(i+1)+': missing supporting KJV');
 for(const [key,map] of [['bible_story',storyNames],['verified_real_life_story',historicalNames]]){
  const title=normalize(d[key]?.title);if(!title)errors.push('day '+(i+1)+': missing '+key+' title');else{const arr=map.get(title)||[];arr.push(i+1);map.set(title,arr)}
 }
 if(/illustration/i.test(d.bible_story?.title||''))errors.push('day '+(i+1)+': generic Bible story placeholder');
 if(d.publication_ready===true)errors.push('day '+(i+1)+': publication flagged despite absent editorial certification');
}
for(const [title,nums] of historicalNames)if(nums.length>1)errors.push('historical title repeated on days '+nums.join(', ')+': '+title);
if(days.length!==1826)errors.push('Expected 1826 days; found '+days.length);
const summary={chunks:files.length,days:days.length,issueCount:errors.length,first200Issues:errors.slice(0,200),releaseApproved:errors.length===0};
console.log(JSON.stringify(summary,null,2));
if(errors.length)process.exitCode=1;
