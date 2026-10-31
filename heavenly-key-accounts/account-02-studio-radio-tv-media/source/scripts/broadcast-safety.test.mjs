import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [restream, entry, config] = await Promise.all([
  readFile(join(root, 'src/restream.ts'), 'utf8'),
  readFile(join(root, 'src/index.ts'), 'utf8'),
  readFile(join(root, 'wrangler.toml'), 'utf8')
]);

// Broadcast replacement must never stop the old stream before the new one is established.
const start = restream.indexOf("callLiveKit(env,'StartEgress',body)");
const stop = restream.indexOf("callLiveKit(env,'StopEgress',{egress_id:replacedEgressId})");
assert.ok(start >= 0 && stop > start, 'Replacement must start before the previous broadcast is stopped');
assert.ok(restream.includes('if(!newEgressId)throw'), 'Replacement must have a provider egress ID');
assert.ok(restream.includes('writeActiveState(env,replacementState)'), 'Replacement state must be persisted before retiring the old stream');
assert.ok(restream.includes('async function withBroadcastLock'), 'Start/stop must be serialized across Worker isolates');
assert.ok(restream.includes('restream_operation_lock'), 'D1 lock must be used');
assert.ok(restream.includes('restream_active_state'), 'D1 must hold authoritative egress state');
assert.ok(restream.includes('parseActivePayload'), 'Corrupt stored broadcast state must fail closed');

// Egress destinations and provider credentials are restricted.
assert.ok(restream.includes('function validStreamingOutput('), 'Destination validator must exist');
assert.ok(restream.includes("url.protocol!=='rtmps:'"), 'New social destinations must require encrypted RTMPS');
assert.ok(restream.includes('secure public-hostname RTMPS URL'), 'Destination errors must explain the secure URL requirement');
assert.ok(restream.includes('AES-GCM'), 'Saved streaming credentials must be encrypted');
assert.ok(restream.includes("redirect:'manual'"), 'LiveKit redirects must not forward signed credentials');
assert.ok(restream.includes('AbortSignal.timeout(15000)'), 'LiveKit requests must have a timeout');
assert.ok(restream.includes('const limit=262144'), 'Provider responses must be bounded');
assert.ok(restream.includes('if(TV_LOCKED&&input.channel!==\'radio\')'), 'The egress layer must independently enforce radio-only mode');
assert.ok(restream.includes("if(!preset)throw new Error('Unsupported broadcast format."), 'Unsupported formats must fail closed');

// Public and administrator API controls must remain protected.
assert.ok(entry.includes('verifyCapability(auth.slice(7),env.MEDIA_ENGINE_SHARED_SECRET)'), 'Admin routes must verify signed capabilities');
assert.ok(entry.includes("if(marker!=='media-engine-v1'||!auth.startsWith('Bearer '))"), 'Admin routes must require the internal marker and bearer token');
assert.ok(entry.includes('/api/broadcast/channel-availability'), 'Public channel status must be explicit');
assert.ok(entry.includes("if(TV_LOCKED&&String(b.channel??'video')!=='radio')return tvLockedResponse()"), 'Social egress must default-deny television');
assert.ok(entry.includes("if(TV_LOCKED&&source==='video')return tvLockedResponse()"), 'Video broadcast creation must be locked');
assert.ok(entry.includes("if(TV_LOCKED&&destination!=='radio')return tvLockedResponse()"), 'Mixed and video destinations must be locked');
assert.ok(entry.includes("if(TV_LOCKED&&type!=='audio')return tvLockedResponse()"), 'Only audio media may be registered while TV is locked');
assert.ok(entry.includes("if(TV_LOCKED&&b.published&&row.media_type!=='audio')return tvLockedResponse()"), 'Video publishing must remain locked');
assert.ok(entry.includes("if(TV_LOCKED)return tvLockedResponse();"), 'Video publisher/switch routes must fail closed');
assert.ok(entry.includes("if(TV_LOCKED&&mr.media_type==='video')return tvLockedResponse();"), 'Video playout scheduling must remain locked');
assert.ok(entry.includes("media_id IN (SELECT media_id FROM media_objects WHERE media_type='audio')"), 'Cron must not activate scheduled television media');
assert.ok(entry.includes('Retention must be between 1 and 48 hours'), 'Temporary recording retention must be bounded');
assert.ok(entry.includes('async scheduled('), 'Scheduled retention cleanup must be present');

// Secrets must never be committed as plaintext Wrangler variables.
assert.doesNotMatch(config, /^\s*MEDIA_ENGINE_SHARED_SECRET\s*=/m, 'Shared secret must be configured as a Worker secret');
console.log('Account 2 broadcast safety and radio-only release guards passed');
