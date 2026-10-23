import assert from 'node:assert/strict';import fs from 'node:fs';
import {handleReadPray,localDateTime,dispatchReadPray} from '../read-pray-server.js';
const r=await handleReadPray(new Request('https://bible.example/api/read-pray/config'),{},new URL('https://bible.example/api/read-pray/config'));
assert.equal(r.status,503);assert.deepEqual(await dispatchReadPray({}),{skipped:true,reason:'unconfigured'});
assert.deepEqual(localDateTime(new Date('2026-10-22T05:30:00Z'),'Africa/Lagos'),{day:'2026-10-22',time:'06:30'});
assert(fs.readFileSync('heavenly-key-website/bible/study-extensions.html','utf8').includes('enable-push'));
assert(fs.readFileSync('heavenly-key-website/bible/sw.js','utf8').includes('read-pray-push.js'));
assert(fs.readFileSync('heavenly-key-website/bible/read-pray-push.js','utf8').includes('async function syncTime')); 
console.log('PASS: safe unconfigured push behavior, timezone, frontend wire, offline caching');
