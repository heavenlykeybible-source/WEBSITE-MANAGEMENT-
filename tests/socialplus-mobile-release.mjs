import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const release=JSON.parse(fs.readFileSync('releases/socialplus/mobile-release.json','utf8'));
assert.equal(release.account,10);
assert.equal(release.domain,'https://socialplus.heavenlykey.org');
assert.ok(['blocked','ready'].includes(release.release_status));
for(const platform of ['android','ios','pwa']) assert.ok(release[platform], 'Missing '+platform+' release record');
assert.ok(['missing','ready'].includes(release.android.status));
assert.ok(['missing','ready'].includes(release.ios.status));
assert.ok(['unverified','ready'].includes(release.pwa.status));
function validHttps(link){ const u=new URL(link); assert.equal(u.protocol,'https:'); assert.equal(u.username,''); assert.equal(u.password,''); return u; }
if(release.android.status==='ready'){
  assert.ok(release.android.artifact_url,'Android download artifact is required');
  validHttps(release.android.artifact_url);
  assert.match(release.android.sha256||'',/^[a-f0-9]{64}$/i);
  assert.match(release.android.package_name||'',/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i);
  assert.ok(release.android.version);
}
if(release.ios.status==='ready'){
  assert.ok(release.ios.app_store_url,'Apple distribution listing is required');
  validHttps(release.ios.app_store_url);
  assert.ok(release.ios.bundle_id);
  assert.ok(release.ios.version);
}
if(release.pwa.status==='ready'){
  validHttps(release.pwa.manifest_url);
  validHttps(release.pwa.service_worker_url);
}
if(release.release_status==='ready'){
  assert.equal(release.source?.verified,true,'Original SocialPlus source must be verified');
  assert.equal(typeof release.source?.path,'string','Source directory must be recorded');
  assert.ok(release.source.path && !path.isAbsolute(release.source.path),'Source path must be repository-relative');
  const root=path.resolve(process.cwd());
  const sourceDir=path.resolve(root,release.source.path);
  assert.ok(sourceDir.startsWith(root+path.sep),'Source must remain within repository');
  assert.ok(fs.existsSync(sourceDir),'Source directory is missing');
  assert.equal(release.verification?.android_install_passed,true,'Android installation test must pass');
  assert.equal(release.verification?.ios_install_passed,true,'iOS installation test must pass');
  assert.equal(release.verification?.domain_https_passed,true,'HTTPS domain check must pass');
  assert.equal(release.verification?.pwa_offline_passed,true,'PWA offline test must pass');
  assert.equal(release.verification?.checked_commit,process.env.GITHUB_SHA||release.verification?.checked_commit,'Verification must match checked commit');
  assert.ok(release.requirements.every(item=>typeof item==='string' && item.trim()),'Requirements must be documented');
  assert.equal(release.android.status,'ready');
  assert.equal(release.ios.status,'ready');
  assert.equal(release.pwa.status,'ready');
}
console.log('PASS SocialPlus mobile artifact release gates');

if (process.argv.includes('--require-ready')) {
  assert.equal(release.release_status,'ready','SocialPlus is NOT cleared for global launch');
}
