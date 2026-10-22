import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

class Node {
 constructor(tag,text='',className=''){this.tag=tag;this.textContent=text;this.className=className;this.children=[];this.parentElement=null;this.attributes={};this.listeners={};this.hidden=false;const classes=new Set();this.classList={add:x=>classes.add(x),contains:x=>classes.has(x)};}
 get isConnected(){return this.tag==='body'||Boolean(this.parentElement?.isConnected);}
 append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children.forEach(n=>n.parentElement=null);this.children=[];this.append(...nodes);}
 after(n){const p=this.parentElement;n.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,n);}
 remove(){const p=this.parentElement;if(p)p.children=p.children.filter(n=>n!==this);this.parentElement=null;}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(k,f){this.listeners[k]=f;}
 querySelector(s){for(const n of this.children){if(s.startsWith('.')?n.className.split(' ').includes(s.slice(1)):n.tag===s)return n;const found=n.querySelector(s);if(found)return found;}return null;}
 click(){this.listeners.click?.();}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(session=null){
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const body=new Node('body'),root=new Node('main'),stream=new Node('section','','social-stream'),aside=new Node('aside');body.append(root);root.append(stream,aside);stream.append(new Node('header','','stream-heading'));aside.append(new Node('section','','existing-card'));
 const el=(tag,text,cls)=>new Node(tag,text??'',cls??''),card=(title,copy)=>{const n=el('section',null,'card');n.append(el('h2',title));if(copy)n.append(el('p',copy));return n;};
 const events=[],requests=[],loads=[];
 const context={session,page:'home',el,card,root,location:{hash:''},document:{body,querySelectorAll:()=>[],querySelector:()=>null},
  sessionLoad:async()=>{},networkNotifications(){},window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  socialFeedLayout(){body.classList.add('social-page');return{stream,aside};},CareUI:{mountDaily:async()=>{}},
  communityShortcuts:()=>el('section',null,'community-shortcuts'),composeCard:()=>el('section',null,'composer-card'),feedTabs(){},
  mountFeed(){loads.push('feed');return new Promise(()=>{});},discoverProfiles(){loads.push('discover');return new Promise(()=>{});},
  api:path=>new Promise((resolve,reject)=>requests.push({path,resolve,reject}))
 };
 vm.createContext(context);
 const start=source.indexOf('function homeReadingCard('),end=source.indexOf('async function moderatorReports(',start);
 vm.runInContext(source.slice(start,end),context);
 context.mounts={home:context.mountHome};
 const renderStart=source.indexOf('async function renderPage()'),renderEnd=source.indexOf('document.body.dataset.currentViewUrl=location.href;',renderStart);
 vm.runInContext(source.slice(renderStart,renderEnd),context);
 return {context,body,root,stream,aside,events,requests,loads};
}

test('actual page lifecycle initializes layout and ACTIVE without waiting for reading, feed or discovery services',{timeout:1000},async()=>{
 for(const session of [null,{user:{userId:4,status:'active'}}]){
  const f=fixture(session);await f.context.renderPage();
  assert.equal(f.requests[0].path,'/api/today-with-god');
  assert.deepEqual(f.loads,['feed','discover']);
  assert.equal(f.events.length,1);assert.equal(f.events[0].type,'hk-community-view-ready');assert.equal(f.events[0].detail.session,session);
  assert(f.stream.querySelector('.composer-card'));assert(f.aside.querySelector('form'));
 }
});

test('reading outage shows a retry state without rejecting page initialization, and retry restores real content',async()=>{
 const f=fixture();await f.context.renderPage();f.requests[0].reject(Error('Service offline'));await flush();
 const reading=f.aside.children.find(n=>n.querySelector('h2')?.textContent==='Today With God'),status=reading.querySelector('.status'),retry=reading.querySelector('button');
 assert.match(status.textContent,/keep browsing/);assert.equal(retry.hidden,false);assert.equal(retry.disabled,false);assert.equal(f.events.length,1);
 retry.click();assert.equal(retry.disabled,true);assert.equal(f.requests.length,2);
 f.requests[1].resolve({today:{scripture_reference:'John 15:5',reflection:'Abide in Christ.',prayer_focus:'Pray for others.'}});await flush();
 assert.equal(reading.querySelector('strong').textContent,'John 15:5');assert.equal(status.textContent,'');assert.equal(retry.hidden,true);assert.equal(retry.disabled,false);
});

test('missing and malformed readings produce an honest recoverable state',async()=>{
 for(const payload of [null,{}, {today:null},{today:{scripture_reference:'',reflection:'Text',prayer_focus:'Prayer'}},{today:{scripture_reference:'John 15:5',reflection:{unexpected:true},prayer_focus:'Prayer'}}]){
  const f=fixture();await f.context.renderPage();f.requests[0].resolve(payload);await flush();
  const reading=f.aside.children.find(n=>n.querySelector('h2')?.textContent==='Today With God');
  assert.equal(reading.querySelector('strong'),null);assert.equal(reading.querySelector('button').hidden,false);assert.match(reading.querySelector('.status').textContent,/could not be loaded/);assert.equal(f.events.length,1);
 }
});

test('a late reading cannot update a card removed by navigation',async()=>{
 const f=fixture();await f.context.renderPage();const reading=f.aside.children.find(n=>n.querySelector('h2')?.textContent==='Today With God');reading.remove();
 f.requests[0].resolve({today:{scripture_reference:'John 15:5',reflection:'Late content',prayer_focus:'Prayer'}});await flush();
 assert.equal(reading.querySelector('strong'),null);assert.equal(f.aside.children.includes(reading),false);
});
