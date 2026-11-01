import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPORT_STEPS,importNavigation,availableDestinations,validateImportStep,IMPORT_SOURCES,MAX_IMPORT_BYTES,validatePackageManifest} from '../project-import/unified-import-ui.mjs';
test('unified import has six explicit steps',()=>assert.equal(IMPORT_STEPS.length,6));
test('removes legacy shortcuts but keeps normal site links',()=>{
 const links=[{label:'TinyFish import',href:'/tinyfish'},{label:'Account 3',href:'/account-3'},{label:'Universal import',href:'/import'},{label:'Home',href:'/'}];
 assert.deepEqual(importNavigation(links).map(x=>x.label),['Universal import','Home']);
});
test('account 3 is still a valid destination without a separate shortcut',()=>{
 const connections=[{connectionId:3,accountId:'a'.repeat(32),connected:true,label:'Account 3'}];
 assert.equal(availableDestinations(connections).length,1);
 assert.equal(validateImportStep('destination',{connections,destination:{connectionId:3,accountId:'a'.repeat(32)}}),true);
});
test('release cannot proceed without full scan, preview and approval',()=>{
 assert.equal(validateImportStep('scan',{scan:{passed:true,unsafeFiles:1}}),false);
 assert.equal(validateImportStep('release',{ownerApproved:true,buildVerified:true,previewVerified:false,liveReleaseAuthorized:true}),false);
 assert.equal(validateImportStep('release',{ownerApproved:true,buildVerified:true,previewVerified:true,liveReleaseAuthorized:true}),true);
});

test('AI and Drive import options are available',()=>{
 assert.equal(IMPORT_SOURCES.some(x=>x.id==='ai'),true);
 assert.equal(IMPORT_SOURCES.some(x=>x.id==='google-drive'),true);
});
test('1 GiB manifests are bounded and verify all file checksums',()=>{
 const file={path:'site/index.html',bytes:MAX_IMPORT_BYTES,sha256:'a'.repeat(64)};
 assert.equal(validatePackageManifest({kind:'website',totalBytes:MAX_IMPORT_BYTES,files:[file]}).valid,true);
 assert.throws(()=>validatePackageManifest({kind:'website',totalBytes:MAX_IMPORT_BYTES+1,files:[file]}));
 assert.throws(()=>validatePackageManifest({kind:'website',totalBytes:4,files:[{...file,path:'../secret',bytes:4}]}));
});
