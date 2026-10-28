import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import {execFileSync} from 'node:child_process';
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
  assert.ok(release.android.artifact_url.toLowerCase().split('?')[0].endsWith('.apk'),'Android artifact must be an APK download');
}
if(release.ios.status==='ready'){
  assert.ok(release.ios.app_store_url,'Apple distribution listing is required');
  validHttps(release.ios.app_store_url);
  assert.ok(release.ios.bundle_id);
  assert.ok(release.ios.version);
  assert.ok(/^(apps\.apple\.com|itunes\.apple\.com)$/i.test(new URL(release.ios.app_store_url).hostname),'iOS release must use an official Apple App Store listing');
}
if(release.pwa.status==='ready'){
  validHttps(release.pwa.manifest_url);
  validHttps(release.pwa.service_worker_url);
  for(const u of [release.pwa.manifest_url,release.pwa.service_worker_url]) assert.equal(new URL(u).origin,new URL(release.domain).origin,'PWA assets must be hosted on the SocialPlus domain');
}
if(release.release_status==='ready'){
  assert.equal(release.source?.verified,true,'Original SocialPlus source must be verified');
  assert.equal(typeof release.source?.path,'string','Source directory must be recorded');
  assert.ok(release.source.path && !path.isAbsolute(release.source.path),'Source path must be repository-relative');
  const root=path.resolve(process.cwd());
  const sourceDir=path.resolve(root,release.source.path);
  assert.ok(sourceDir.startsWith(root+path.sep),'Source must remain within repository');
  assert.ok(fs.existsSync(sourceDir),'Source directory is missing');
  assert.ok(release.requirements?.every(item=>typeof item==='string' && item.trim()),'Requirements must be documented');
  assert.equal(release.verification?.android_install_passed,true,'Android installation test must pass');
  assert.equal(release.verification?.ios_install_passed,true,'iOS installation test must pass');
  assert.equal(release.verification?.domain_https_passed,true,'HTTPS domain check must pass');
  assert.equal(release.verification?.pwa_offline_passed,true,'PWA offline test must pass');
  assert.match(release.verification?.checked_commit||'',/^[0-9a-f]{40}$/i,'Verification must identify a real commit SHA');
  if(process.env.GITHUB_ACTIONS==='true'){
    const tested=release.verification.checked_commit;
    const current=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const ancestor=execFileSync('git',['merge-base',tested,current],{encoding:'utf8'}).trim();
    assert.equal(ancestor,tested,'Verified source commit must be an ancestor of the current build');
    const changes=execFileSync('git',['diff','--name-only',tested,current,'--',release.source.path],{encoding:'utf8'}).trim();
    assert.equal(changes,'','Application source changed since device testing; reverify the updated source');
  }
  assert.equal(release.android.status,'ready');
  assert.equal(release.ios.status,'ready');
  assert.equal(release.pwa.status,'ready');
}
console.log(release.release_status==='ready' ? 'PASS SocialPlus release metadata (ready; run --verify-live for live validation)' : 'PASS SocialPlus metadata format; release remains BLOCKED and is NOT launch-ready');

if (process.argv.includes('--require-ready')) {
  assert.equal(release.release_status,'ready','SocialPlus is NOT cleared for global launch');
}

if (process.argv.includes('--verify-live')) {
  assert.equal(release.release_status,'ready','Cannot check downloads before the app is ready');
  async function checkPublicUrl(url, label, kind='page') {
    const target=validHttps(url);
    assert.ok(!target.port || target.port==='443',label+' must use standard HTTPS');
    const response=await fetch(target,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(15000),headers:kind==='android'?{range:'bytes=0-4095'}:{}});
    assert.ok(response.ok || response.status===206,label+' is not publicly accessible: '+response.status);
    assert.equal(new URL(response.url).protocol,'https:',label+' redirect must remain HTTPS');
    const mime=response.headers.get('content-type')||'';
    if(kind==='android'){
      assert.ok(!/text\/html/i.test(mime),'Android installer returned HTML instead of APK');
      const reader=response.body?.getReader();
      assert.ok(reader,'APK download has no body');
      const header=[];
      while(header.length<4){
        const chunk=await reader.read();
        if(chunk.done) break;
        for(const byte of chunk.value){header.push(byte);if(header.length===4)break;}
      }
      await reader.cancel();
      assert.equal(header.length,4,'APK response is empty or too short');
      assert.deepEqual(header,[0x50,0x4b,0x03,0x04],'Android artifact is not a ZIP-based APK');
    } else if(kind==='manifest'){
      const manifest=await response.json();
      assert.equal(typeof manifest.name,'string','PWA manifest must have a name');
      assert.ok(manifest.name.trim(),'PWA manifest name must not be empty');
      assert.ok(manifest.start_url,'PWA manifest must specify start_url');
      assert.ok(['standalone','fullscreen','minimal-ui'].includes(manifest.display),'PWA must be installable');
      assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length,'PWA needs install icons');
      const appOrigin=new URL(release.domain).origin;
      const manifestBase=new URL(release.pwa.manifest_url);
      const start=new URL(manifest.start_url,manifestBase);
      assert.equal(start.origin,appOrigin,'PWA start_url must remain on the SocialPlus origin');
      const scope=new URL(manifest.scope||'/',manifestBase);
      assert.equal(scope.origin,appOrigin,'PWA scope must remain on the SocialPlus origin');
      assert.ok(start.pathname.startsWith(scope.pathname),'PWA start_url must be inside its scope');
      for(const icon of manifest.icons){
        assert.ok(icon&&typeof icon.src==='string'&&icon.src.trim(),'PWA icon must have a source');
        const iconUrl=new URL(icon.src,manifestBase);
        assert.equal(iconUrl.origin,appOrigin,'PWA install icons must be same-origin');
        assert.ok(icon.sizes&&icon.sizes.trim(),'PWA install icon sizes are required');
      }
    } else if(kind==='worker'){
      assert.ok(/javascript|ecmascript|text\/plain/i.test(mime),'Service worker must serve JavaScript');
      await response.body?.cancel();
    } else {
      assert.ok(!/application\/json/i.test(mime),'Expected a web page, not JSON');
      await response.body?.cancel();
    }
  }
  await checkPublicUrl(release.domain,'SocialPlus home page');
  await checkPublicUrl(release.android.artifact_url,'Android installer','android');
  // Download the complete release APK to verify its cryptographic identity.
  // A ZIP magic header alone is not sufficient to validate a release artifact.
  const apkResponse=await fetch(validHttps(release.android.artifact_url),{signal:AbortSignal.timeout(120000),redirect:'follow'});
  assert.ok(apkResponse.ok,'Complete Android artifact is not downloadable: '+apkResponse.status);
  assert.equal(new URL(apkResponse.url).protocol,'https:','APK download redirected to an insecure URL');
  assert.ok(apkResponse.body,'Complete APK response has no body');
  const digest=createHash('sha256');
  let bytes=0;
  for await (const chunk of apkResponse.body){
    bytes+=chunk.byteLength;
    assert.ok(bytes<=1024*1024*1024,'APK exceeds 1 GiB safety limit');
    digest.update(chunk);
  }
  assert.ok(bytes>1024,'APK download is unexpectedly small');
  assert.equal(digest.digest('hex').toLowerCase(),release.android.sha256.toLowerCase(),'Android APK SHA-256 checksum mismatch');
  await checkPublicUrl(release.ios.app_store_url,'iPhone App Store listing');
  await checkPublicUrl(release.pwa.manifest_url,'PWA manifest','manifest');
  await checkPublicUrl(release.pwa.service_worker_url,'PWA service worker','worker');
  console.log('PASS SocialPlus live HTTPS download endpoints');
}
