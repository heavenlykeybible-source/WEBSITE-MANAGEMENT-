/** Bible Champions release gate: all 24 subjects need 30 unique, reviewed question records.
 * Standalone and no external dependencies. Run from repo root or any directory.
 */
import {readFileSync} from 'node:fs';
const sourceRoot=new URL('../',import.meta.url);
const files=[
 new URL('public/bible-quiz.js',sourceRoot),
 new URL('../../../../apps/heavenly-key-bible/heavenly-key-website/bible/social-bible-champions.js',sourceRoot),
 new URL('../../../account-03-global-christian-community/source/public/social-bible-champions.js',sourceRoot)
];
function extractBank(text){const marker='const BANK=',start=text.indexOf(marker);if(start<0)throw Error('Missing Bible Champions BANK');const s=text.slice(start+marker.length);let depth=0,inString=false,escaped=false;for(let i=0;i<s.length;i++){const ch=s[i];if(inString){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')inString=false;continue;}if(ch==='"'){inString=true;continue;}if(ch==='{')depth++;if(ch==='}'&&--depth===0)return JSON.parse(s.slice(0,i+1));}throw Error('Unclosed BANK');}
const banks=files.map(file=>extractBank(readFileSync(file,'utf8')));
const canonical=JSON.stringify(banks[0]);
for(let i=1;i<banks.length;i++)if(JSON.stringify(banks[i])!==canonical)throw Error('Bible Champions question bank differs between app surfaces: '+files[i]);
const bank=banks[0],topics=Object.keys(bank),errors=[],statuses=[];
if(topics.length!==24)errors.push('Expected 24 topics, found '+topics.length);
let total=0;
for(const topic of topics){
 const questions=bank[topic];if(!Array.isArray(questions)){errors.push(topic+': not an array');continue;}
 total+=questions.length;const identities=new Set();
 for(const [i,q] of questions.entries()){
  if(!Array.isArray(q)||q.length!==4||typeof q[0]!=='string'||!Array.isArray(q[1])||q[1].length!==4||!Number.isInteger(q[2])||q[2]<0||q[2]>3||typeof q[3]!=='string'||!q[3].trim()||q[1].some(v=>typeof v!=='string'||!v.trim())||new Set(q[1].map(v=>v.trim().toLowerCase())).size!==4){errors.push(topic+': invalid question '+(i+1));continue;}
  const identity=q[0].toLowerCase().replace(/[^a-z0-9]/g,'');if(identities.has(identity))errors.push(topic+': duplicate question '+(i+1));identities.add(identity);
 }
 statuses.push({topic,found:questions.length,missing:Math.max(0,30-questions.length)});
 if(questions.length!==30)errors.push(topic+': expected exactly 30 questions; has '+questions.length);
}
if(total!==720)errors.push('Expected exactly 720 questions; found '+total);
console.log('Bible Champions curriculum: '+topics.length+'/24 topics; '+total+'/720 questions.');
for(const {topic,found,missing}of statuses)console.log((missing?'INCOMPLETE':'READY')+' '+topic+': '+found+'/30'+(missing?' (missing '+missing+')':''));
if(errors.length){for(const e of errors)console.error('RELEASE BLOCKED: '+e);process.exitCode=1;}else console.log('PASS: All 24 topics contain 30 unique validated question records on all three app surfaces. Editorial Scripture review and real-device testing remain independent release requirements.');
