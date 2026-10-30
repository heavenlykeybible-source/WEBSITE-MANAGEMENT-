import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const start=s.indexOf('async function aiChat('),end=s.indexOf('async function mcp(',start);
assert.ok(start>=0&&end>start,'AI chat handler missing');
const chat=s.slice(start,end);
for(const [name,fragment] of [
 ['last user request boundary','latestUserMessage=convo[convo.length-1].content.trim()'],
 ['explicit action requirement','const mayPropose=policy.mode'],
 ['tool filtering','const safeTools=mayPropose?tools:tools.filter'],
 ['deny unauthorized proposals',"No deployment, import or change was requested in your message."],
 ['per-AI grants preserved','aiPolicy:policy']
])assert.ok(chat.includes(fragment),'Missing '+name);
assert.ok(chat.indexOf('const safeTools=')<chat.indexOf('await aiLoop('),'Tool list must be filtered before AI receives it');
assert.ok(chat.includes('remembered.task'),'Continue must require recorded action context');
console.log('PASS AI conversational turns cannot propose without an explicit action or recorded task');
