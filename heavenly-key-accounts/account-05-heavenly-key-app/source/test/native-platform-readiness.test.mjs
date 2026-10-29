import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const sourceRoot=new URL('../../',import.meta.url);
const repositoryRoot=new URL('../../../../',import.meta.url);
const readNative=path=>readFileSync(new URL('native/'+path,sourceRoot),'utf8');
const readWorkflow=name=>readFileSync(new URL('.github/workflows/'+name,repositoryRoot),'utf8');

test('four native platform projects exist without replacing the account-5 web shell',()=>{
 for(const path of [
  'android/app/build.gradle',
  'android/app/src/main/java/org/heavenlykey/apps/MainActivity.java',
  'ios/project.yml','ios/HeavenlyKey/HeavenlyKeyApp.swift',
  'macos/project.yml','macos/HeavenlyKeyMac/HeavenlyKeyMacApp.swift',
  'windows/HeavenlyKeyWindows.csproj','windows/MainWindow.xaml.cs'
 ]) assert.ok(existsSync(new URL('native/'+path,sourceRoot)),path);
});

test('each platform uses only official Account 5 HTTPS in its embedded browser',()=>{
 const sources=[
  readNative('android/app/src/main/java/org/heavenlykey/apps/MainActivity.java'),
  readNative('ios/HeavenlyKey/HeavenlyKeyApp.swift'),
  readNative('macos/HeavenlyKeyMac/HeavenlyKeyMacApp.swift'),
  readNative('windows/MainWindow.xaml.cs')
 ];
 for(const [i,s] of sources.entries()){
  assert.ok(s.includes('https://apps.heavenlykey.org/experience.html'),'missing home on platform '+i);
  assert.ok(s.includes('apps.heavenlykey.org'),'missing trusted origin on platform '+i);
 }
 assert.match(sources[0],/setAllowFileAccess\(false\)/);
 assert.match(sources[0],/MIXED_CONTENT_NEVER_ALLOW/);
 assert.match(sources[3],/e.Cancel = true/);
});

test('native production publishing never substitutes test binaries for signed releases',()=>{
 const release=readWorkflow('release-account5-android.yml');
 const distribution=readFileSync(new URL('source/src/native-downloads.js',sourceRoot),'utf8');
 assert.match(release,/workflow_dispatch/);
 assert.match(release,/HKEM_ANDROID_KEYSTORE_BASE64/);
 assert.match(release,/apksigner/);
 assert.match(release,/clamscan/);
 assert.match(distribution,/signatureVerified/);
 assert.match(distribution,/scannedSha256/);
 assert.match(distribution,/DOWNLOAD_ADMIN_TOKEN/);
});

test('platform workflows build separately and do not deploy automatically',()=>{
 const flows=[
  'build-account5-android.yml','test-account5-android-emulator.yml',
  'test-account5-ios-simulator.yml','test-account5-macos.yml',
  'test-account5-windows.yml'
 ];
 for(const name of flows){
  const s=readWorkflow(name);
  assert.ok(s.includes('workflow_dispatch'),name);
  assert.doesNotMatch(s,/wrangler deploy|cloudflare\/pages-action|store upload|app-store-connect deploy/i,name);
 }
});

test('Windows signed release candidate is gated and never publicly deployed',()=>{
 const workflow=readWorkflow('release-account5-windows.yml');
 assert.match(workflow,/workflow_dispatch/);
 assert.match(workflow,/environment: production-release/);
 assert.match(workflow,/HKEM_WINDOWS_PFX_BASE64/);
 assert.match(workflow,/HKEM_WINDOWS_PFX_PASSWORD/);
 assert.match(workflow,/signtool verify \/pa/);
 assert.match(workflow,/Get-AuthenticodeSignature/);
 assert.doesNotMatch(workflow,/wrangler deploy|actions\/create-release|cloudflare\/pages-action/);
});
