import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const restream = await readFile(join(root, 'src/restream.ts'), 'utf8');
const entry = await readFile(join(root, 'src/index.ts'), 'utf8');
const config = await readFile(join(root, 'wrangler.toml'), 'utf8');

// Prevent regression of the on-air continuity fix.
const start = restream.indexOf("callLiveKit(env,'StartEgress',body)");
const stop = restream.indexOf("callLiveKit(env,'StopEgress',{egress_id:replacedEgressId})");
assert.ok(start >= 0 && stop > start, 'Replacement must start before the previous broadcast is stopped');
assert.match(restream, /if\(!result\.egress_id\)throw/, 'Do not stop the previous broadcast without a new egress ID');
assert.match(restream, /await callLiveKit\(env,'StopEgress',\{egress_id:result\.egress_id\}\)/, 'Failed handoff must clean up the replacement');

// Verify the administrative control plane is not inadvertently made public.
assert.match(entry, /verifyCapability\(auth\.slice\(7\),env\.MEDIA_ENGINE_SHARED_SECRET\)/);
assert.match(entry, /ADMIN_ROLES = new Set/);
assert.match(restream, /AES-GCM/, 'Stored stream destinations must remain encrypted');
assert.match(config, /crons = \["\* \* \* \* \*"\]/, 'Broadcast monitoring must retain its one-minute schedule');
assert.doesNotMatch(config, /^\s*MEDIA_ENGINE_SHARED_SECRET\s*=/m, 'Never commit the shared secret as a Wrangler variable');

// Ensure invalid recording retention values cannot trigger 500s or unlimited storage.
assert.match(entry, /Number\.isFinite\(retentionHours\)\|\|retentionHours<1\|\|retentionHours>48/, 'Retention must have a finite, bounded duration');
assert.equal((entry.match(/Retention must be between 1 and 48 hours/g) ?? []).length, 2, 'Validate retention on both create and update');
assert.match(entry, /typeof b\.keep!=='boolean'/, 'Keep-recording changes require an explicit boolean');
assert.match(entry, /async scheduled\(/, 'Cron trigger must have a scheduled handler');

console.log('Account 2 broadcast safety regression checks passed');
