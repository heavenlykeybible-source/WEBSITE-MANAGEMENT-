import fs from 'node:fs';
import {aiActionAllowed} from './account4-ai-intent.mjs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const old="const mayPropose=policy.mode==='work'&&(actionRequested||continuation);";
const updated="const mayPropose=policy.mode==='work'&&aiActionAllowed(latestUserMessage,remembered?.task||'');";
if(s.includes(updated)){
 console.log('Enhanced intent guard already installed');
}else{
 if(!s.includes(old))throw Error('Existing AI proposal permission guard changed; refusing patch');
 const start=s.indexOf('async function aiChat(');
 if(start<0)throw Error('Missing AI chat route');
 s=s.slice(0,start)+aiActionAllowed.toString()+'\n'+s.slice(start);
 s=s.replace(old,updated);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('Account 4 AI conversational intent guard '+(process.argv.includes('--check')?'checked':'applied'));
