import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
assert.match(source,/function openMeetingStudioOwner\(\)/);
assert.match(source,/if\(own\(\)\)item\('Meeting Studio'/);
assert.match(source,/api\('connections\/\'\+conn\.id\+'\/meeting-launch','POST'/);
assert.match(source,/if \(user\.kind !== 'staff' \|\| user\.role !== 'owner'\) fail\('Only the owner can open this app as owner\.'/);
console.log('PASS: Studio menu is owner-only and uses existing authenticated launch');
