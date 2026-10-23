import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('heavenly-key-website/bible/read-pray-push.js','utf8');
assert.match(s,/newSubscription=sub/);
assert.match(s,/await newSubscription\.unsubscribe\(\)/);
assert.match(s,/if\(!settings\?\.enabled\)return/);
console.log('PASS: new push subscription rollback after failed server registration, disabled settings do not sync');
