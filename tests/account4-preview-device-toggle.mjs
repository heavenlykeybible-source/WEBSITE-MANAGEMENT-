import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const begin=s.indexOf('async function nativeImports()'),end=s.indexOf('var PROVIDER_SEEN=',begin);
assert.ok(begin>=0&&end>begin,'Native import preview missing');
const preview=s.slice(begin,end);
for(const [name,fragment] of [
 ['responsive desktop control',"'Desktop'"],
 ['responsive mobile control',"'Mobile'"],
 ['390px mobile width',"previewFrame.style.width='390px'"],
 ['desktop full width',"previewFrame.style.width='100%'"],
 ['sandbox scripts and forms',"sandbox:'allow-scripts allow-forms'"],
 ['cross-site referrer suppression',"referrerpolicy:'no-referrer'"],
 ['review action',"openP(result.proposal_id,decision)"],
 ['decline action',"decision:'reject'"]
])assert.ok(preview.includes(fragment),'Missing '+name);
assert.ok(!preview.includes("sandbox:'allow-scripts allow-same-origin'"),'Untrusted preview must not share its source origin');
console.log('PASS mobile/desktop imported-site previews with isolated interactive sandbox and owner decision');
