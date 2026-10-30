import assert from 'node:assert/strict';
import fs from 'node:fs';
import {account4NeedsReadTools} from '../scripts/account4-chat-read-intent.mjs';
const cases=[
 ['Hello',false],['Good morning',false],['Thanks!',false],
 ['How are you?',false],['Explain JavaScript closures',false],
 ['What is a website?',false],['What is my website status?',true],
 ['Show my Cloudflare Workers',true],['Check Account 4 connections',true],
 ['List connected repositories',true],['Read our current homepage',true]
];
for(const [message,needed] of cases)assert.equal(account4NeedsReadTools(message),needed,'Incorrect read-tool routing: '+message);
const source=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const start=source.indexOf('async function aiChat('),end=source.indexOf('async function mcp(',start);
assert.ok(start>=0&&end>start,'Account4 chat route missing');
const chat=source.slice(start,end);
assert.ok(source.includes('function account4NeedsReadTools('),'Fast-path classifier missing in Worker');
assert.ok(chat.includes("account4NeedsReadTools(latestUserMessage)?tools.filter"),'Chat tool list must use read-intent gate');
assert.ok(chat.includes("t.name==='browser_task_status';}):[]"),'Casual messages must receive an empty tool list');
assert.ok(chat.indexOf('const safeTools=')<chat.indexOf('await aiLoop('),'Provider must see filtered tool list');
console.log('PASS Account 4 fast conversational path, resource reading and read-only separation');
