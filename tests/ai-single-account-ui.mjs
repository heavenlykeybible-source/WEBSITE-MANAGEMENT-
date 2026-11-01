import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const {document}=parseHTML('<html><head></head><body></body></html>');
const saves=[];
const initial={connections:[{id:4,label:'Account 4'},{id:3,label:'Account 3'}],policy:{connections:[3,4],expires_at:Date.now()+86400000,mode:'work',max_tools:12,all_agents:false}};
function h(tag,attrs={},...children){
 const el=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)){
  if(key==='onclick'||key==='onchange'||key==='oninput')el[key]=value;
  else if(key==='class')el.className=value;
  else if(key==='value')el.value=String(value);
  else if(key==='checked')el.checked=!!value;
  else if(key==='hidden')el.hidden=!!value;
  else el.setAttribute(key,String(value));
 }
 for(const child of children.flat(Infinity))if(child!==null&&child!==undefined)el.appendChild(typeof child==='string'?document.createTextNode(child):child);
 return el;
}
const ctx={document,h,Date,Set,Array,Promise,console,OWNER_APPROVAL_SESSION:null,lagosTime:d=>String(d),nav:()=>document.createElement('nav'),show:(...nodes)=>document.body.replaceChildren(...nodes),oops:e=>{throw e},claude:()=>{},enableQuickApprovals:async()=>null,registerOwnerDevice:async()=>false,verifyOwnerDevice:async()=>{},passwordDialog:async()=> 'verified-owner',
 api:async (path,method,body)=>{
  if(path==='passkeys')return {credentials:[]};
  if(path==='ai/permissions'&&method==='POST'){saves.push(body);return {policy:{connections:body.connections,mode:body.mode,expires_at:Date.now()+3600000}};}
  if(path==='ai/permissions')return initial;
  throw Error('Unexpected API '+path);
 }};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('ai/permissions.js','utf8')+'\nthis.runPermissions=aiPermissions;',ctx);
await ctx.runPermissions();
assert.match(document.body.textContent,/Currently authorized: Account 3, Account 4/);
const only=Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')==='Select only Account 4');
assert.ok(only,'One-account button is present');
only.onclick();
const checked=Array.from(document.querySelectorAll('.permission-account input')).filter(el=>el.checked);
assert.equal(checked.length,1);
assert.equal(checked[0].getAttribute('aria-label'),'Account 4');
assert.equal(saves.length,0,'Changing scope never saves until owner authorizes');
assert.match(document.body.textContent,/Unsaved changes/);
const search=document.querySelector('[aria-label="Search connected accounts"]');
search.value='Account 3';search.oninput();
assert.equal(document.querySelectorAll('.permission-account[hidden]').length,1);
const save=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Save and verify permissions');
await save.onclick();
assert.equal(saves.length,1);
assert.equal(JSON.stringify(Array.from(saves[0].connections)),JSON.stringify([4]));
assert.match(document.body.textContent,/No unsaved permission changes/);
assert.match(document.body.textContent,/Currently authorized: Account 4 · Mode: work/);
assert.doesNotMatch(document.body.textContent,/Currently authorized: Account 3, Account 4/);
console.log('PASS Account 4 single-account permission selection and owner-confirmed save');
