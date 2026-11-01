import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPORT_STEPS,importNavigation,availableDestinations,validateImportStep} from '../project-import/unified-import-ui.mjs';
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
