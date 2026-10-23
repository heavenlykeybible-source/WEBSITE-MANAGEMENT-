import assert from 'node:assert/strict';
import fs from 'node:fs';
const app=fs.readFileSync('heavenly-key-website/bible/study-extensions.js','utf8');
const save=app.slice(app.indexOf("$('save').addEventListener"),app.indexOf("$('stop').addEventListener"));
assert.match(save,/if\(!old\?\.enabled\)localStorage\.removeItem\('hk-read-pray-last-v2'\)/);
assert(!save.includes("localStorage.removeItem('hk-read-pray-last-v2');renderRoutine()"));
assert(app.includes("localStorage.removeItem('hk-read-pray-last-v2');renderRoutine();"),'unsubscribe must remove daily marker');
console.log('PASS: editing reminder settings retains today’s delivered-notification marker');
