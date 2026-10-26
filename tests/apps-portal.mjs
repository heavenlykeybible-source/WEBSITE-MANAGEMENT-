import {parseHTML} from 'linkedom';
import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('workspace/apps-client.js','utf8');
async function render(verified){const {document}=parseHTML('<html><body></body></html>');let target;
 const ctx={h(tag,props,...children){const el=document.createElement(tag);if(tag==='select')Object.defineProperty(el,'value',{value:'5',writable:true});for(const [key,value]of Object.entries(props||{})){if(key==='onclick')el.onclick=value;else el.setAttribute(key,value);}for(const x of children.flat()){if(x!=null)el.append(x);}return el;},api:async path=>path==='connections'?{connections:[{id:5,label:'Account 5'}]}:{workers:[{name:'heavenly-key-app',url:verified?'https://heavenly-key-app.heavenlykeyapp.workers.dev/':'https://heavenly-key-app.wrong.workers.dev/'}]},nav:()=>document.createElement('nav'),show:(...els)=>document.body.append(...els),oops:e=>{throw e;},deployForm:(c,name)=>{target=name;}};
 vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.appsCenter();return {document,target:()=>target};}
const wrong=await render(false);assert.match(wrong.document.body.textContent,/not the verified Account 5/);assert.equal(wrong.document.querySelectorAll('section').length,0);
const right=await render(true);assert.equal(right.document.querySelectorAll('section').length,5);const update=Array.from(right.document.querySelectorAll('button')).find(b=>b.textContent==='Update this Worker');update.onclick();assert.equal(right.target(),'heavenly-key-app');assert.equal(Array.from(right.document.querySelectorAll('button')).filter(b=>b.textContent==='Update this Worker').length,1);console.log('Apps portal: verified account required; missing workers cannot be updated; exact existing Worker selected.');
