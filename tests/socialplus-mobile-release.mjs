import assert from 'node:assert/strict';
import fs from 'node:fs';
const release=JSON.parse(fs.readFileSync('releases/socialplus/mobile-release.json','utf8'));
assert.equal(release.account,10);
assert.equal(release.domain,'https://socialplus.heavenlykey.org');
assert.ok(['blocked','ready'].includes(release.release_status));
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
  assert.equal(release.android.status,'ready');
  assert.equal(release.ios.status,'ready');
  assert.equal(release.pwa.status,'ready');
}
console.log('PASS SocialPlus mobile artifact release gates');
