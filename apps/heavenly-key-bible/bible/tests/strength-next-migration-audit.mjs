// Read-only migration inventory. Never publishes or rewrites legacy drafts.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const files=readdirSync(root).filter(n=>/^strength-devotionals-(2026|2027|year[1-5])(?:-batch\d+)?\.json$/.test(n)).sort();
const dates=new Set();const problems=[];let total=0;let sourceTopics=0;
const topicNames=['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Salvation & Repentance','Faith & Trust','The Holy Spirit','Evangelism & Soul Winning','Love & Christian Unity','The Word & Obedience','Wisdom & Discernment','End-time & Rapture Readiness'];
for(const name of files){
 const data=JSON.parse(readFileSync(resolve(root,name),'utf8'));
 if(!Array.isArray(data?.entries))throw Error('Invalid entries: '+name);
 for(const entry of data.entries){
  total++;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry?.date||''))throw Error('Invalid date in '+name);
  if(dates.has(entry.date))problems.push(entry.date+': duplicate date');
  dates.add(entry.date);
  if(!Array.isArray(entry.topics)||entry.topics.length!==12){problems.push(entry.date+': missing source themes');continue}
  sourceTopics+=entry.topics.length;
  for(let i=0;i<12;i++)if(entry.topics[i]?.topic!==topicNames[i])problems.push(entry.date+': theme order mismatch '+i);
 }
}
const start=Date.parse('2026-10-30T00:00:00Z'),end=Date.parse('2031-10-31T00:00:00Z');
const missing=[];for(let day=start;day<=end;day+=86400000){const date=new Date(day).toISOString().slice(0,10);if(!dates.has(date))missing.push(date)}
const report={mode:'READ_ONLY_NO_PUBLICATION',sourceFiles:files.length,sourceDays:total,sourceTopics,requiredDays:Math.round((end-start)/86400000)+1,missingDates:missing,problems:problems.slice(0,30),problemCount:problems.length,editorialApproval:'REQUIRED',conversion:'NOT_PERFORMED'};
console.log(JSON.stringify(report,null,2));
if(problems.length||missing.length)process.exitCode=1;
