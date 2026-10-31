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

// Capabilities must not be valid indefinitely or with malformed issuance times.
assert.match(entry, /Number\.isInteger\(p\.iat\)/, 'Issued-at must be an integer');
assert.match(entry, /p\.iat<now-300/, 'Reject stale issued-at values');
assert.match(entry, /p\.exp-p\.iat>300/, 'Reject long-lived admin capabilities');
assert.match(entry, /p\.exp<=p\.iat/, 'Reject expiration before issuance');

// Campaign creation must keep authorization and media availability checks.
assert.match(entry, /if\(url\.pathname==='\/api\/campaigns'&&request\.method==='POST'\)/);
assert.match(entry, /status IN \('approved','published'\)/);
assert.match(entry, /campaign\.cancel/, 'Campaign cancellation must be audited');

// Campaigns must record creation and never schedule already-expired media.
assert.match(entry, /id<=0\)return json\(\{error:'Invalid media'\}/, 'Campaign IDs must be positive');
assert.match(entry, /campaign\.schedule/, 'Campaign creation must be audited');
assert.match(entry, /Media expires before campaign starts/, 'Media retention must cover the campaign start');

// Malformed signed capability tokens must fail closed.
assert.match(entry, /parts\.length!==2/, 'Reject extra token segments');
assert.match(entry, /encoded\.length>8192/, 'Reject oversized token payloads');
assert.match(entry, /signature\.length!==64/, 'Require exact SHA-256 signature size');
assert.match(entry, /Array\.isArray\(p\)/, 'Reject array/null capability payloads');

// Recording references must be valid and safely bounded.
assert.match(entry, /objectKey\.length>1024/, 'Reject oversized recording object keys');
assert.match(entry, /!Number\.isSafeInteger\(sessionId\)\|\|sessionId<=0/, 'Reject invalid recording session IDs');

// Request bodies must be capped even when transfer encoding omits Content-Length.
assert.match(entry, /const maxBytes=65536/, 'Limit JSON payloads to 64 KB');
assert.match(entry, /total>maxBytes/, 'Limit streamed bodies as they arrive');
assert.match(entry, /reader\.cancel\(\)/, 'Cancel oversized request streams');
assert.match(entry, /!Array\.isArray\(parsed\)/, 'Reject non-object JSON request payloads');

// Signed capability claims must contain bounded identifiers, not truthy objects.
assert.match(entry, /typeof p\.sub!=='string'/, 'Validate capability subject type');
assert.match(entry, /p\.sub\.length>256/, 'Bound capability subject length');
assert.match(entry, /typeof p\.nonce!=='string'/, 'Validate capability nonce type');
assert.match(entry, /p\.nonce\.length>256/, 'Bound capability nonce length');

// Recording retention flags must not accept truthy strings such as "false".
assert.match(entry, /typeof b\.keep_recording!=='boolean'/, 'Create-recording retention must validate the boolean type');
assert.match(entry, /const keep=b\.keep_recording===true/, 'Keep-recording must be explicitly true');

// Deleting a recording must not leave distribution jobs attempting to post it.
assert.match(entry, /recording\.retention\.update/, 'Retention changes must create audit events');
assert.match(entry, /recording\.delete/, 'Recording deletions must create audit events');
assert.match(entry, /Recording deleted by administrator/, 'Deletion must cancel outstanding distribution jobs');
assert.match(entry, /status IN \('pending','processing','failed'\)/, 'Pending and failed distribution jobs must be cancellable');

console.log('Account 2 broadcast safety regression checks passed');
