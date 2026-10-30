import fs from 'node:fs';
import {account4NeedsReadTools} from './account4-chat-read-intent.mjs';
const target=new URL('../control-room-worker.js',import.meta.url);
let s=fs.readFileSync(target,'utf8');
const existing="const safeTools=mayPropose?tools:tools.filter(function(t){return /^(?:list_|read_|get_|find_|inspect_)/.test(t.name)||t.name==='my_proposals'||t.name==='browser_task_status';});";
const updated="const safeTools=mayPropose?tools:(account4NeedsReadTools(latestUserMessage)?tools.filter(function(t){return /^(?:list_|read_|get_|find_|inspect_)/.test(t.name)||t.name==='my_proposals'||t.name==='browser_task_status';}):[]);";
if(!s.includes(updated)){
 if(!s.includes(existing))throw Error('Existing AI tool filter does not match reviewed code');
 const anchor='async function aiChat(';
 if(!s.includes(anchor))throw Error('Cannot locate Account4 AI chat handler');
 s=s.replace(anchor,account4NeedsReadTools.toString()+'\n'+anchor);
 s=s.replace(existing,updated);
}
if(!process.argv.includes('--check'))fs.writeFileSync(target,s);
console.log('PASS Account 4 conversational fast path '+(process.argv.includes('--check')?'checked':'applied'));
