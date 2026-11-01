import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const {document}=parseHTML('<html><body></body></html>');
let browserReady=false,permissionActive=true,writes=0,fetches=0;
function h(tag,props={},...children){
 const el=document.createElement(tag);
 for(const [k,v] of Object.entries(props)){
  if(k==='onclick')el.onclick=v;
  else if(k==='class')el.className=v;
  else if(k==='disabled')el.disabled=!!v;
  else el.setAttribute(k,String(v));
 }
 for(const child of children.flat(Infinity))if(child!==null&&child!==undefined)el.appendChild(typeof child==='string'?document.createTextNode(child):child);
 return el;
}
const callbacks={claude:()=>{},aiPermissions:()=>{},browserCenter:()=>{},nativeImports:()=>{},releaseHistory:()=>{}};
const ctx={document,h,Date,console,Promise,nav:()=>h('nav'),show:(...nodes)=>document.body.replaceChildren(...nodes),
 lagosTime:d=>String(d),...callbacks,
 api:async(path,method)=>{
  fetches++;
  if(method){writes++;throw Error('Readiness must not change anything');}
  if(path==='ai')return {enabled:true,accounts:[{id:'cloudflare',label:'Cloudflare AI'}]};
  if(path==='ai/permissions')return {policy:{mode:'work',connections:[4],expires_at:permissionActive?Date.now()+86400000:Date.now()-1},connections:[{id:4,label:'Account 4'}]};
  if(path==='browser')return {available:browserReady};
  if(path==='workspace/catalog')return {sources:[{id:1,label:'Online Bible'}]};
  throw Error('Unknown endpoint '+path);
 }};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('workspace/screens.js','utf8')+'\nthis.renderReadiness=aiStudioReadiness;',ctx);
await ctx.renderReadiness();
assert.match(document.body.textContent,/AI Studio readiness/);
assert.match(document.body.textContent,/Configured providers: Cloudflare AI/);
assert.match(document.body.textContent,/Work mode\. Authorized accounts: Account 4/);
assert.match(document.body.textContent,/Browser runtime is not connected/);
assert.match(document.body.textContent,/connected GitHub source/);
assert.match(document.body.textContent,/not a live deployment or AI execution test/);
assert.equal(writes,0);
assert.equal(fetches,4);
const refresh=[...document.querySelectorAll('button')].find(b=>b.textContent==='Refresh AI Studio status');
assert.ok(refresh);
browserReady=true;permissionActive=false;
await refresh.onclick();
assert.match(document.body.textContent,/Browser service binding reported/);
assert.match(document.body.textContent,/No active account permission grant/);
assert.equal(writes,0);
assert.equal(fetches,8);
const page=fs.readFileSync('workspace/screens.js','utf8');
assert.match(page,/onclick:aiStudioReadiness\},'Check AI Studio readiness'/);
console.log('PASS: AI Studio readiness panels, refresh, owner navigation and read-only behavior');
