import fs from 'node:fs';
import assert from 'node:assert/strict';
const wf=fs.readFileSync(new URL('../.github/workflows/deploy.yml',import.meta.url),'utf8');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
assert.match(wf,/on:\s*\n\s*workflow_dispatch:/,'Production releases must be manual');
assert.ok(wf.includes("environment: account-4"),'Keep protected Account 4 production environment');
assert.ok(wf.includes('test "$APPROVED_COMMIT" = "$(git rev-parse HEAD)"'),'Require exact approved commit');
assert.ok(wf.includes('npm run prepare:account4-release'),'Production must use reviewed release build, not legacy CMS-only build');
assert.ok(!wf.includes('npm run build:cms'),'Standalone CMS-only build must never omit reviewed security patches in production');
assert.ok(wf.includes('node scripts/account4-release-integrity.mjs\n'),'Production must create reviewed checksum manifest');
assert.ok(wf.includes('node scripts/account4-release-integrity.mjs --verify'),'Production must verify Worker unchanged after all tests');
assert.ok(wf.indexOf('node scripts/account4-release-integrity.mjs --verify')<wf.indexOf('- name: Deploy existing Worker'),'Integrity verification must run before upload');
assert.ok(wf.includes("git fetch --no-tags origin main"),'Block stale production commits');
assert.ok(pkg.scripts['prepare:account4-release'].includes('npm run build:cms'),'Reviewed release must integrate current CMS');
assert.ok(pkg.scripts['prepare:account4-release'].includes('node scripts/account4-chat-agent-grant-discovery.mjs'),'Reviewed build must include latest AI grant fixes');
const upload=fs.readFileSync(new URL('../scripts/deploy-account4-existing.mjs',import.meta.url),'utf8');
for(const [name,fragment] of [
 ['approved commit checked again','integrity.commit !== approved'],
 ['sha256 checked against Worker','integrity.sha256 !== sha256'],
 ['byte length verified','integrity.bytes !== Buffer.byteLength(source'],
 ['owner review requirement','integrity.reviewRequired !== true'],
 ['no automatic deployment','integrity.deploysAutomatically !== false'],
 ['checksum file verified',"checksum !== sha256 + '  control-room-worker.js"],
 ['fail closed','Deployment cancelled.']
])assert.ok(upload.includes(fragment),'Direct deployment missing '+name);
assert.ok(upload.indexOf('integrity.commit !== approved')<upload.indexOf("await api(base, {method:'PUT'"),'The integrity gate must run before Cloudflare upload');
console.log('PASS Account 4 production deploy uses exact approval-gated, checksum-verified reviewed Worker build');
