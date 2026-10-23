import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('heavenly-key-website/bible/read-pray-push.js','utf8');
assert(s.includes('const time=saved?.time,zone='),'push enrollment uses saved reminder time');
assert(s.includes('const time=settings.time,zone='),'background time updates use validated saved preference');
assert(!s.includes("const time=$('time').value,zone="),'unsaved UI time must never modify push schedule');
assert(s.includes('if(!settings?.enabled)return;'),'disabled routine must not update push time');
console.log('PASS: push time is always derived from saved Read & Pray preferences');
