import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(tag,cls=''){this.tagName=tag.toUpperCase();this.className=cls;this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.textContent='';}
 get isConnected(){return this.tagName==='BODY'||!!this.parentElement?.isConnected;}
 append(...nodes){for(const n of nodes){n.remove();this.children.push(n);n.parentElement=this;}}
 prepend(n){n.remove();this.children.unshift(n);n.parentElement=this;}
 before(n){const parent=this.parentElement;n.remove();parent.children.splice(parent.children.indexOf(this),0,n);n.parentElement=parent;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
 setAttribute(k,v){this.attributes[k]=v;}
 getAttribute(k){return this.attributes[k];}

 querySelector(s){for(const n of this.children){if(s[0]==='.'?n.className.split(' ').includes(s.slice(1)):n.tagName===s.toUpperCase())return n;const found=n.querySelector(s);if(found)return found;}return null;}
 getBoundingClientRect(){return {height:86};}
}
function fixture(){const body=new Element('body'),layout=new Element('div','social-layout'),stream=new Element('section','social-stream'),aside=new Element('aside','social-sidebar'),header=new Element('header','top'),radio=new Element('a');radio.id='hk-radio-compact';body.dataset.page='home';body.style={setProperty(){}};stream.append(new Element('div','feed-tabs'));layout.append(stream,aside);body.append(header,layout,radio);const handlers={},document={body,readyState:'complete',querySelector:s=>body.querySelector(s),getElementById:id=>id===radio.id?radio:null,createElement:t=>new Element(t)};return {body,layout,stream,aside,header,radio,handlers,document,window:{addEventListener:(name,fn)=>(handlers[name]??=[]).push(fn)},emit:(name,detail)=>handlers[name]?.forEach(fn=>fn({detail}))};}
const read=file=>readFileSync(new URL('../public/'+file,import.meta.url),'utf8'),flush=()=>new Promise(r=>setImmediate(r));
test('sidebars remain in the grid on desktop, become an accessible disclosure on smaller screens, and return without duplication',()=>{
 const f=fixture(),media={matches:false,addEventListener(_n,fn){this.changed=fn},removeEventListener(){}};
 vm.runInNewContext(read('community-shell.js'),{document:f.document,window:f.window,matchMedia:()=>media});
 assert.equal(f.aside.parentElement,f.layout);assert.equal(f.radio.parentElement,f.aside);
 media.matches=true;media.changed();const drawer=f.stream.querySelector('.gc-discovery-drawer');assert(drawer);assert.equal(drawer.tagName,'DETAILS');assert.equal(f.aside.parentElement,drawer);
 media.changed();f.emit('hk-community-view-ready',{page:'home'});assert.equal(f.stream.children.filter(n=>n.className==='gc-discovery-drawer').length,1);
 media.matches=false;media.changed();assert.equal(f.aside.parentElement,f.layout);assert.equal(f.stream.querySelector('.gc-discovery-drawer'),null);
});
test('publications wait for the real stream, paginate there, expand safely, and ignore a stale signed-out response',async()=>{
 const f=fixture(),requests=[];f.layout.remove();
 vm.runInNewContext(read('official-community-feed.js'),{document:f.document,window:f.window,AbortController,fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))});
 assert.equal(requests.length,0);assert.equal(f.body.querySelector('.hk-official-feed'),null);
 f.body.append(f.layout);f.emit('hk-community-view-ready',{page:'home'});assert.equal(f.stream.querySelector('.hk-official-feed').parentElement,f.stream);
 f.emit('hk-community-view-ready',{page:'home'});assert.equal(requests.length,1);
 requests[0].resolve({ok:true,json:async()=>({items:[]})});await flush();const full='<script>untrusted</script>'+'.'.repeat(450);requests[1].resolve({ok:true,json:async()=>({items:[{post_id:7,title:'A post',body:full}]})});await flush();
 const root=f.stream.querySelector('.hk-official-feed'),article=root.querySelector('article'),p=article.querySelector('p'),expand=article.querySelector('button');assert(p.textContent.length<full.length);expand.onclick();assert.equal(p.textContent,full);assert.equal(expand.getAttribute('aria-expanded'),'true');assert.equal(article.querySelector('script'),null);
 f.emit('hk-care-session');root.remove();f.emit('hk-community-view-ready',{page:'home'});const current=f.stream.querySelector('.hk-official-feed');assert(current);assert.notEqual(root,current);assert.equal(requests[0].options.signal.aborted,true);
});
