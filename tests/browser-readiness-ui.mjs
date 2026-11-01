import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
const {document}=parseHTML('<html><body></body></html>');
let available=false,requests=0;
function h(tag,props={},...children){
 const node=document.createElement(tag);
 for(const [key,val] of Object.entries(props)){
  if(key==='onclick'||key==='onchange')node[key]=val;
  else if(key==='class')node.className=val;
  else if(key==='disabled')node.disabled=!!val;
  else if(key==='value')node.value=val;
  else node.setAttribute(key,String(val));
 }
 for(const child of children.flat(Infinity))if(child!==null&&child!==undefined)node.appendChild(typeof child==='string'?document.createTextNode(child):child);
 return node;
}
const ctx={document,h,Date,console,nav:()=>h('nav'),show:(...nodes)=>document.body.replaceChildren(...nodes),
 passwordDialog:async()=> 'owner-proof',
 api:async (path,method)=> {
  if(path==='browser')return {available,notice:available?'Runtime connected':'Runtime missing',tasks:[]};
  if(path==='browser/request'&&method==='POST'){requests++;return {};}
  throw Error('Unexpected endpoint '+path);
 }};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('workspace/browser-client.js','utf8')+'\nthis.testBrowserCenter=browserCenter;',ctx);
await ctx.testBrowserCenter();
const create=Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Prepare browser task');
const refresh=Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='Refresh tasks');
assert.ok(create&&refresh);
assert.equal(create.disabled,true);
assert.match(document.body.textContent,/Browser runtime not connected/);
assert.equal(requests,0);
available=true;await refresh.onclick();
assert.equal(create.disabled,false);
assert.match(document.body.textContent,/Browser runtime connected/);
assert.equal(requests,0);
available=false;await refresh.onclick();
assert.equal(create.disabled,true);
assert.equal(requests,0);
const home=fs.readFileSync('workspace/screens.js','utf8');
assert.match(home,/onclick:browserCenter\},'Browser agent and runtime status'/);
console.log('PASS browser runtime readiness and home shortcut');
