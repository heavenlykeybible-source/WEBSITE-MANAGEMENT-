import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
assert.match(source,/function openMeetingStudioOwner\(\)/);
assert.match(source,/if\(own\(\)\)item\('MeetingSpace · Account 8'/);
assert.match(source,/api\('connections\/\'\+conn\.id\+'\/meeting-launch','POST'/);
assert.match(source,/if \(user\.kind !== 'staff' \|\| user\.role !== 'owner'\) fail\('Only the owner can open this app as owner\.'/);
console.log('PASS: Studio menu is owner-only and uses existing authenticated launch');

// Exercise the actual embedded owner-entry function, including shared-tenant selection.
const {default:vm}=await import('node:vm');
const {writeFileSync,unlinkSync}=await import('node:fs');
const fixture=new URL('./meeting-menu-fixture.mjs',import.meta.url);
writeFileSync(fixture,source+'\nexport {UI};');
try {
 const {UI}=await import(fixture.href);
 const start=UI.indexOf('async function openMeetingStudioOwner()');
 const end=UI.indexOf('function nav()',start);
 async function launch(connections){
  let call,error,submitted=false;
  const context={URL,own:()=>true,oops:e=>{error=e.message;},api:async(path,method,args)=>{
   if(path==='connections')return {connections};call={path,method,args};return {url:'https://heavenly-key-meetingspace.example.workers.dev/api/control-login',ticket:'fixture'};
  },h:()=>({appendChild(){},submit(){submitted=true},remove(){}}),document:{body:{appendChild(){}}}};
  vm.createContext(context);vm.runInContext(UI.slice(start,end),context);await context.openMeetingStudioOwner();return {call,error,submitted};
 }
 const tenant='6401a8f41a41f5325ba5bd4d006b4ff5';
 const chosen=await launch([{id:2,label:'Account 7 Meeting App',account_id:tenant},{id:9,label:'Account 8',account_id:tenant}]);
 assert.equal(chosen.call.path,'connections/9/meeting-launch');assert.equal(chosen.call.args.worker,'heavenly-key-meetingspace');assert.equal(chosen.submitted,true);
 const ambiguous=await launch([{id:2,label:'First',account_id:tenant},{id:9,label:'Second',account_id:tenant}]);
 assert.equal(ambiguous.call,undefined);assert.equal(ambiguous.submitted,false);assert.ok(ambiguous.error);
 console.log('PASS: Account 8 menu selects its named connection and dedicated Worker; ambiguous shared tenants are blocked');
} finally {unlinkSync(fixture);}
