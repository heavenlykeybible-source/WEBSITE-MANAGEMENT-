import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

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

// Public LiveKit viewer-token errors must not expose provider or secret details.
assert.match(entry, /Viewer token issuance failed/, 'Internal failure must be logged without exposing its message');
assert.match(entry, /return json\(\{error:'Live transport unavailable'\},503\)/, 'Return a generic viewer error');
const publicViewerRoute = entry.slice(entry.indexOf("if(url.pathname==='/api/media-engine/livekit/viewer-token'"), entry.indexOf("if(marker!=='media-engine-v1'"));
assert.ok(publicViewerRoute.length > 0, 'Public viewer route must exist');
assert.match(publicViewerRoute, /'Cache-Control':'no-store'/, 'Do not cache time-sensitive viewer credentials');
assert.doesNotMatch(publicViewerRoute, /error:e instanceof Error\?e\.message/, 'Public viewer endpoint must not expose provider exception messages');

// Social publishing accounts require bounded metadata and explicit automation flags.
assert.match(entry, /ch\.length>100\|\|ref\.length>300/, 'Limit social account metadata lengths');
assert.match(entry, /typeof b\.automatable!=='boolean'/, 'Validate social automation flag type');
assert.match(entry, /social\.account\.create/, 'Audit creation of social destination accounts');

// Streaming destinations must not interpret nonempty text like "false" as enabled.
assert.match(entry, /b\.action!=='remove'&&typeof b\.enabled!=='boolean'/, 'Require explicit destination enable setting');
assert.match(entry, /saveDestination\(env,String\(b\.destination\?\?'\'\),combined,b\.enabled===true\)/, 'Only explicitly true may enable a new destination');
assert.match(entry, /setDestinationEnabled\(env,String\(b\.destination\?\?'\),b\.enabled===true\)/, 'Only explicitly true may enable an existing destination');

// Invalid streaming controls must fail closed instead of silently starting 'live'.
assert.match(entry, /!\['live','247'\]\.includes\(requestedSource\)/, 'Reject unsupported streaming sources');
assert.match(entry, /!\['radio','video'\]\.includes\(requestedChannel\)/, 'Reject unsupported channels');
assert.ok(entry.includes("typeof b.session_id==='string'"), 'Require a canonical string session identifier');
assert.match(entry, /A valid live session ID is required/, 'Invalid live session IDs must return a client error');

// Egress destinations must never target private infrastructure.
assert.match(restream, /function unsafeStreamHost\(/, 'Stream destinations must have a host validator');
assert.match(restream, /unsafeStreamHost\(u\.hostname\)/, 'Host validation must run on save');
for(const fragment of ["host==='localhost'","a===127","a===10","a===172&&b>=16&&b<=31","a===192&&b===168","a===169&&b===254","host.startsWith('fc')","host.startsWith('fd')"]){
 assert.ok(restream.includes(fragment), 'Missing private-host guard: '+fragment);
}

// Execute the actual stream-host validator (with only TypeScript annotations stripped).
const hostValidatorSource=restream.match(/function unsafeStreamHost\(hostname:string\):boolean\{[\s\S]*?\n\}/)?.[0];
assert.ok(hostValidatorSource, 'Host validator implementation must be present');
const unsafeHost=runInNewContext('('+hostValidatorSource.replace('(hostname:string):boolean','(hostname)')+')',Object.create(null),{timeout:1000});
for(const host of ['localhost','localhost.','stream.local','127.0.0.1','127.1','2130706433','0x7f000001','192.168.1','10.0.0.5','172.16.10.20','192.168.1.2','169.254.1.2','[::1]','[fd00::1]','[::ffff:127.0.0.1]']){
 assert.equal(unsafeHost(host),true,'Must block private streaming host: '+host);
}
for(const host of ['stream.youtube.com','rtmp.example.com','8.8.8.8']){
 assert.equal(unsafeHost(host),false,'Must permit public streaming host: '+host);
}

assert.ok(restream.includes('function safeStreamUrl('), 'Validate stored streaming destinations');
assert.ok(restream.includes('if(enabled&&!safeStreamUrl(store[destination].url))'), 'Validate destination when re-enabled');
assert.ok(restream.includes("v.enabled===true&&typeof v.url==='string'&&safeStreamUrl(v.url)!==null"), 'Validate destination before broadcast');

console.log('Account 2 broadcast safety regression checks passed');
