import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync('workspace/apps-client.js','utf8');
async function render(verified){let target,roots=[];
 const ctx={h(tag,props,...children){return {tag,...props,value:tag==='select'?'5':props?.value,children:children.filter(x=>x!=null),appendChild(el){this.children.push(el);},set innerHTML(value){this.children=[];}};},api:async path=>path==='connections'?{connections:[{id:5,label:'Account 5'}]}:{workers:[{name:'heavenly-key-app',url:verified?'https://heavenly-key-app.heavenlykeyapp.workers.dev/':'https://heavenly-key-app.wrong.workers.dev/'}]},nav:()=>({tag:'nav',children:[]}),show:(...els)=>{roots=els;},oops:e=>{throw e;},deployForm:(c,name)=>{target=name;}};
 vm.createContext(ctx);vm.runInContext(source,ctx);await ctx.appsCenter();const all=[];function visit(n){if(typeof n==='object'){all.push(n);(n.children||[]).forEach(visit);}}roots.forEach(visit);return {all,target:()=>target};}
const wrong=await render(false);assert.ok(wrong.all.some(n=>/not the verified Account 5/.test(n.textContent)));assert.equal(wrong.all.filter(n=>n.tag==='section').length,0);
const right=await render(true);assert.equal(right.all.filter(n=>n.tag==='section').length,5);const updates=right.all.filter(n=>n.tag==='button'&&n.children.includes('Update this Worker'));assert.equal(updates.length,1);updates[0].onclick();assert.equal(right.target(),'heavenly-key-app');console.log('Apps portal: verified account required; missing workers cannot be updated; exact existing Worker selected.');
