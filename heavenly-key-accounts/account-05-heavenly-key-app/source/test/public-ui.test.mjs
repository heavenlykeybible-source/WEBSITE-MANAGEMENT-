import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('public lists load on demand, recover after errors and render malicious text safely',async()=>{
 const nodes=new Map();
 const element=id=>({id,hidden:false,disabled:false,dataset:{},textContent:'',children:[],attributes:{},listeners:{},classList:{toggle(){}},
  addEventListener(name,fn){this.listeners[name]=fn},setAttribute(n,v){this.attributes[n]=v},removeAttribute(n){delete this.attributes[n]},
  replaceChildren(){this.children=[]},append(...children){this.children.push(...children)},get childElementCount(){return this.children.length}});
 for(const id of ['load-feed','feed-status','feed-list','load-tracks','tracks-status','tracks-list'])nodes.set(id,element(id));
 const views=['home','community','grow','profile','bible','live','messages','groups','prayer'].map(element);
 const tabs=['home','community','grow','profile'].map(id=>{const e=element(id+'-tab');e.dataset.screen=id;return e;});
 let calls=0,fail=true;let resolve;
 const location={hash:'#home',protocol:'http:'};
 const context={document:{querySelectorAll:s=>s==='.view'?views:s==='.tabbar button[data-screen]'?tabs:s==='[data-screen]'?tabs:[],getElementById:id=>nodes.get(id),createElement:tag=>element(tag)},
  window:{location,scrollTo(){},addEventListener(){}},location,history:{pushState(_a,_b,hash){location.hash=hash}},navigator:{},AbortController,setTimeout,clearTimeout,
  fetch:async(_url,options)=>{calls++;assert.equal(options.credentials,'omit');assert.equal(options.cache,'no-store');await new Promise(r=>resolve=r);return {ok:!fail,status:fail?503:200,json:async()=>({items:[{display_name:'Member',body:'<img src=x onerror=alert(1)>'},{type:'video',body:'Excluded'}]})};}};
 vm.runInNewContext(readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),context);
 assert.equal(calls,0,'No background reads');
 const button=nodes.get('load-feed');
 const first=button.listeners.click();assert.equal(button.disabled,true);
 await button.listeners.click();assert.equal(calls,1,'Duplicate click does not issue a second request');
 resolve();await first;assert.equal(button.disabled,false);assert.match(nodes.get('feed-status').textContent,/still being prepared/);
 fail=false;const second=button.listeners.click();resolve();await second;
 const list=nodes.get('feed-list');assert.equal(list.childElementCount,1);
 assert.equal(list.children[0].children[1].textContent,'<img src=x onerror=alert(1)>');
 assert.equal(list.children[0].children[1].innerHTML,undefined,'Never interpret response text as HTML');
 assert.match(nodes.get('feed-status').textContent,/Public content loaded/);
 tabs[2].listeners.click();assert.equal(views.find(x=>x.id==='grow').hidden,false);
 assert.equal(tabs[2].attributes['aria-current'],'page');
 tabs[3].listeners.click();assert.equal(views.find(x=>x.id==='profile').hidden,false);
});
