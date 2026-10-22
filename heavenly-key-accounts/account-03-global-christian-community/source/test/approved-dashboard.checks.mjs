import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

class Element {
 constructor(tag,cls='',text=''){this.tagName=tag.toUpperCase();this.className=cls;this.textContent=text;this.children=[];this.parentElement=null;this.attributes={};this.dataset={};this.classList={add:(...xs)=>this.className=[...new Set([...this.className.split(' ').filter(Boolean),...xs])].join(' '),remove:(...xs)=>this.className=this.className.split(' ').filter(x=>!xs.includes(x)).join(' '),contains:x=>this.className.split(' ').includes(x)};}
 get isConnected(){return this.tagName==='BODY'||Boolean(this.parentElement?.isConnected);}
 append(...xs){for(const x of xs){x.remove();x.parentElement=this;this.children.push(x);}}
 prepend(x){x.remove();x.parentElement=this;this.children.unshift(x);}
 before(x){x.remove();x.parentElement=this.parentElement;this.parentElement.children.splice(this.parentElement.children.indexOf(this),0,x);}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);this.parentElement=null;}
 setAttribute(k,v){this.attributes[k]=v;}
 cloneNode(deep){const n=new Element(this.tagName,this.className,this.textContent);if(deep)this.children.forEach(x=>n.append(x.cloneNode(true)));return n;}
 matches(s){return s.startsWith('.')?this.classList.contains(s.slice(1)):s.startsWith('#')?this.id===s.slice(1):this.tagName===s.toUpperCase();}
 querySelectorAll(s){const parts=s.split(' '),last=parts.at(-1);const matches=n=>{if(!n.matches(last))return false;let parent=n.parentElement;for(let i=parts.length-2;i>=0;i--){while(parent&&!parent.matches(parts[i]))parent=parent.parentElement;if(!parent)return false;parent=parent.parentElement;}return true;};return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
 click(){this.onclick?.();}
}
function fixture(){
 const n=(tag,cls,text)=>new Element(tag,cls,text),body=n('body'),top=n('header','top'),header=n('nav','nav'),brand=n('a','brand'),auth=n('div');auth.id='authbar';brand.append(n('span','brand-name','Global Christian Community'));
 const search=n('form','reference-search');search.append(n('input'));header.append(brand,search,auth);top.append(header);body.append(top);
 const layout=n('main','social-layout'),rail=n('nav','social-rail'),aside=n('aside','social-sidebar'),stream=n('section','social-stream'),composer=n('section','composer-card'),composerTop=n('div','composer-top'),prompt=n('button','composer-prompt');let opens=0;prompt.onclick=()=>opens++;composerTop.append(prompt);composer.append(composerTop);stream.append(composer,n('section','gc-active-section'),n('div','feed'));layout.append(rail,stream,aside);body.append(layout);
 const broadcast=n('section','gc-broadcast-feature');broadcast.append(n('h2','','Live Broadcast'),n('a','hk-live-button'));aside.append(broadcast);
 const listeners={},requests=[];
 vm.runInNewContext(readFileSync(new URL('../public/approved-dashboard.js',import.meta.url),'utf8'),{
  document:{body,createElement:t=>n(t),createElementNS:(_ns,t)=>n(t),querySelector:s=>body.querySelector(s)},
  window:{addEventListener:(name,fn)=>listeners[name]=fn},AbortController,Number,encodeURIComponent,
  fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject})),setTimeout:()=>1,clearTimeout(){}
 });
 return {body,header,rail,aside,stream,composer,prompt,requests,get opens(){return opens;},emit:(name,detail)=>listeners[name]({detail})};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('reference composition preserves working feed/ACTIVE and forwards create-post to the original editor',()=>{
 const f=fixture(),feed=f.stream.querySelector('.feed'),active=f.stream.querySelector('.gc-active-section');
 f.emit('hk-community-view-ready',{page:'home',session:null});
 assert(f.body.classList.contains('gc-composed-dashboard'));
 assert.equal(f.stream.querySelector('.feed'),feed);assert.equal(f.stream.querySelector('.gc-active-section'),active);
 assert.equal(f.header.querySelectorAll('.gc-header-shortcuts').length,1);
 assert.deepEqual(f.header.querySelector('.gc-header-shortcuts').children.map(x=>x.href),['https://app.heavenlykey.org/bible.html','prayer.html','groups.html','spaces.html','messages.html']);
 f.composer.querySelector('.gc-composer-submit').click();assert.equal(f.opens,1);
 assert.equal(f.aside.querySelector('.gc-world-invitation').querySelector('a').href,'account.html#register');
 assert.equal(f.aside.querySelector('.gc-broadcast-feature').querySelector('h2').textContent,'Word, worship & prayer');
});

test('Space suggestions render real backend records as text and link to their existing slug routes',async()=>{
 const f=fixture();f.emit('hk-community-view-ready',{page:'home',session:{user:{userId:9}}});
 const r=f.requests[0];assert.equal(r.url,'/api/spaces');assert.equal(r.options.credentials,'same-origin');
 r.resolve({ok:true,json:async()=>({items:[{space_id:4,slug:'prayer & faith',name:'<img src=x onerror=alert(1)>',category:'prayer'},{space_id:-1,slug:'bad',name:'Invalid'}]})});await flush();
 const panel=f.aside.querySelector('.gc-suggested-spaces'),rows=panel.querySelectorAll('.gc-space-row');
 assert.equal(rows.length,1);assert.equal(rows[0].href,'spaces.html?slug=prayer%20%26%20faith');assert.equal(rows[0].querySelector('strong').textContent,'<img src=x onerror=alert(1)>');assert.equal(rows[0].querySelector('img'),null);
 assert.equal(f.aside.querySelector('.gc-world-invitation').querySelector('a').href,'index.html#discover');
});

test('repeated renders do not duplicate panels and stale requests cannot update the next session',async()=>{
 const f=fixture();f.emit('hk-community-view-ready',{page:'home',session:null});const old=f.requests[0],oldPanel=f.aside.querySelector('.gc-suggested-spaces');
 f.emit('hk-community-view-ready',{page:'home',session:{user:{userId:3}}});
 assert.equal(old.options.signal.aborted,true);assert.equal(f.rail.querySelectorAll('.gc-rail-brand').length,1);assert.equal(f.header.querySelectorAll('.gc-header-shortcuts').length,1);assert.equal(f.aside.querySelectorAll('.gc-suggested-spaces').length,1);assert.equal(f.composer.querySelectorAll('.gc-composer-submit').length,1);
 old.resolve({ok:true,json:async()=>({items:[{space_id:1,slug:'old',name:'Stale'}]})});await flush();assert.equal(oldPanel.querySelector('.gc-space-row'),null);
 f.emit('hk-care-session',null);assert.equal(f.requests[1].options.signal.aborted,true);assert(!f.body.classList.contains('gc-composed-dashboard'));assert.equal(f.header.querySelector('.gc-header-shortcuts'),null);
});

test('failed and empty Space responses show honest states while retaining the directory link',async()=>{
 for(const fails of [false,true]){const f=fixture();f.emit('hk-community-view-ready',{page:'home',session:null});if(fails)f.requests[0].reject(Error('Offline'));else f.requests[0].resolve({ok:true,json:async()=>({items:[]})});await flush();const panel=f.aside.querySelector('.gc-suggested-spaces');assert.equal(panel.querySelector('.gc-space-row'),null);assert.equal(panel.querySelector('a').href,'spaces.html');assert.match(panel.querySelector('p').textContent,fails?/could not be loaded/:/Explore Spaces/);}
});

test('homepage loads final layout; only the authenticated ACTIVE module owns its rail and consent',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('public/index.html');
 assert(html.includes('approved-dashboard.css?v=20261021-dashboard1'));assert(html.includes('approved-dashboard.js?v=20261021-dashboard1'));
 const official=read('public/official-community-feed.js');assert(!official.includes('hk-active-auto-'));assert(!official.includes("section.className='hk-active-section'"));assert(official.includes('/api/ministry/posts'));
 assert(read('public/active-strip.js').includes("api('/api/active')"));
 const css=read('public/approved-dashboard.css');assert(css.includes('@media(min-width:1400px)'));assert(css.includes('@media(max-width:900px)'));assert(css.includes('.brand-words'));assert(css.includes('button[aria-pressed=true]'));
});
