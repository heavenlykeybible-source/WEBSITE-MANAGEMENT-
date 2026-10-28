import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../control-room-worker.js',import.meta.url),'utf8');
const code=source.slice(source.indexOf('function reserveAppTab(){'),source.indexOf('\nfunction nav(){'));
function setup({blocked=false,invalid=false,fail=false}={}){
 const events=[],errors=[];
 const tab={document:{body:{}},location:{replace:url=>events.push(['navigate',url])},closed:false,close(){this.closed=true;events.push('close')}};
 const context={crypto:{randomUUID:()=> 'unique-id'},URL,window:{open:(url,name)=>{events.push(['open',url,name]);return blocked?null:tab}},own:()=>true,oops:e=>errors.push(e.message),h:(tag,attrs)=>({attrs,appendChild(){},submit(){events.push(['submit',attrs.target])},remove(){}}),document:{body:{appendChild(){}}},api:async(path)=>{
  events.push(['api',path]);if(fail)throw Error('Unavailable');
  if(path==='connections')return {connections:[{id:9,label:'Account 8',account_id:'6401a8f41a41f5325ba5bd4d006b4ff5'},{id:2,label:'Account 7 Meeting App',account_id:'6401a8f41a41f5325ba5bd4d006b4ff5'}]};
  return {url:invalid?'https://untrusted.example/':'https://app.example.workers.dev/'+(path.endsWith('meeting-launch')?'api/control-login':''),ticket:'one-time-test-ticket'};
 }};vm.createContext(context);vm.runInContext(code,context);return {context,events,errors,tab};
}
let t=setup();await t.context.openMeetingStudioOwner();assert.equal(t.events[0][0],'open');assert.equal(t.events[2][1],'connections/2/meeting-launch');assert.equal(t.events[3][1],'heavenlykey-app-unique-id');assert.equal(t.tab.opener,null);
t=setup({blocked:true});await t.context.openMeetingStudioOwner();assert.equal(t.events.length,1);assert.match(t.errors[0],/Allow popups/);
t=setup({fail:true});await t.context.openMeetingStudioOwner();assert.equal(t.tab.closed,true);
t=setup({invalid:true});await t.context.openConnectedApp('social-plus');assert.equal(t.tab.closed,true);assert.match(t.errors[0],/Invalid app destination/);assert.equal(t.events.some(x=>x[0]==='navigate'),false);
t=setup();await t.context.openConnectedApp('social-plus');assert.equal(t.events[0][0],'open');assert.equal(t.events.at(-1)[0],'navigate');
for(const title of ['Social Network','Meeting Space · Zoom app','MediaGuru · Video editor','Social Plus · Account 10'])assert.ok(source.includes("item('"+title+"'"));
console.log('PASS: app shortcuts reserve tabs before requests, choose Account 7 exactly, reject unsafe destinations and clean up failures');
