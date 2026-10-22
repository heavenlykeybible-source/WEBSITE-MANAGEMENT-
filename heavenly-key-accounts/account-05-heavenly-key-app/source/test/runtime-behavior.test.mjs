import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import worker from '../src/index.js';

const root=new URL('../',import.meta.url);
const content=(p)=>readFileSync(new URL(p,root),'utf8');

test('Visitor: health returns real JSON without caching or credential exposure',async()=>{
 const req=new Request('https://app.example.test/api/health');
 const res=await worker.fetch(req,{ASSETS:{fetch(){throw Error('Health must never use assets')}}});
 assert.equal(res.status,200);
 assert.equal(res.headers.get('cache-control'),'no-store');
 assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 assert.deepEqual(await res.json(),{service:'heavenly-key-app',status:'ok',release:'starter'});
 const head=await worker.fetch(new Request('https://app.example.test/api/health',{method:'HEAD'}),{});
 assert.equal(head.status,200);
 assert.equal(await head.text(),'');
});
test('Anonymous visitor: unknown and unsafe API operations never execute storage calls',async()=>{
 const env={ASSETS:{fetch(){throw Error('Private API must not enter assets')}}};
 for(const [path,method] of [['/api/login','POST'],['/api/me','GET'],['/api/health','POST'],['/api/admin','DELETE']]){
  const response=await worker.fetch(new Request('https://app.example.test'+path,{method}),env);
  assert.equal(response.status,404,path+' '+method);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
});
test('Visitor homepage: static asset handler remains separate from private APIs',async()=>{
 let visited=false;
 const req=new Request('https://app.example.test/');
 const result=await worker.fetch(req,{ASSETS:{fetch(r){visited=true;assert.equal(r.url,req.url);return new Response('page',{status:200})}}});
 assert.equal(await result.text(),'page');
 assert.ok(visited);
});
test('Owner integrity: app assets cannot reuse Accounts 1-4 D1, KV, R2, auth credentials',()=>{
 const wrangler=content('wrangler.toml');
 assert.doesNotMatch(wrangler,/\[\[d1_databases\]\]|\[\[kv_namespaces\]\]|\[\[r2_buckets\]\]/);
 for(const path of ['src/index.js','public/sw.js','public/app.js']){
  assert.doesNotMatch(content(path),/ACCOUNT_4_TOKEN|HKEM_CONTROL_TOKEN|PASSWORD_PEPPER|D1Database|CONTROL_PASSWORD_HASH/);
 }
});
test('Offline visitor: service worker only handles approved public static paths',()=>{
 const callbacks=new Map();
 const fakeSelf={location:{origin:'https://app.example.test'},addEventListener:(name,fn)=>callbacks.set(name,fn)};
 const context={self:fakeSelf,URL,Set,Promise,Response,fetch:async()=>new Response('public'),caches:{open:async()=>({put(){return Promise.resolve()},addAll(){return Promise.resolve()}}),match:async()=>null,keys:async()=>[]}};
 vm.runInNewContext(content('public/sw.js'),context);
 const handler=callbacks.get('fetch');
 assert.equal(typeof handler,'function');
 const simulate=(path,opts={})=>{
  let intercepted=false;
  handler({request:new Request('https://app.example.test'+path,opts),respondWith:()=>{intercepted=true},waitUntil(){}});
  return intercepted;
 };
 assert.equal(simulate('/'),true,'public homepage should be cached');
 assert.equal(simulate('/app.js'),true,'known JS should be cached');
 assert.equal(simulate('/api/me'),false,'authenticated endpoints must never be intercepted');
 assert.equal(simulate('/api/member/session'),false,'member profile must never be cached');
 assert.equal(simulate('/api/member/tracks'),false,'personal progress must never be cached');
 assert.equal(simulate('/api/health'),false,'API health must not be cached');
 assert.equal(simulate('/private'),false,'unknown future user page must not be cached');
 assert.equal(simulate('/?token=test'),false,'personalized URL must not be cached');
 assert.equal(simulate('/app.js',{headers:{Authorization:'Bearer fake'}}),false,'authorized asset must never be cached');
 assert.equal(simulate('/app.js',{method:'POST'}),false,'mutations must never be cached');
});
test('User reading view: tab navigation and Scripture selection work on mobile DOM',()=>{
 const handlers={};
 function element(id,props={}){
  const listeners={};
  return {id,hidden:false,dataset:props.dataset||{},classList:{toggle(){}},
    textContent:'',attributes:{},addEventListener(name,fn){listeners[name]=fn},
    setAttribute(n,v){this.attributes[n]=v},removeAttribute(n){delete this.attributes[n]},
    fire(name){listeners[name]?.()},getAttribute(n){return this.attributes[n]}};
 }
 const views=['home','bible','community','live'].map(id=>element(id));
 const tabs=['home','grow','community','profile'].map(screen=>element('tab-'+screen,{dataset:{screen}}));
 const select=element('passage');select.value='psalm';
 const ref=element('verse-ref'),verse=element('verse-text');
 const extra=element('quick',{dataset:{screen:'bible'}});
 const all=new Map([['verse-ref',ref],['verse-text',verse],['passage',select]]);
 let hash='#home';
 const window={location:{get hash(){return hash},set hash(value){hash=String(value)}},scrollTo(){},
   addEventListener(name,fn){handlers[name]=fn}};
 const history={pushState(_a,_b,newHash){hash=newHash;window.location.hash=newHash}};
 const doc={querySelectorAll(selector){
  return selector==='.tabbar button[data-screen]'?tabs:selector==='.view'?views:
    selector==='[data-screen]'?[...tabs,extra]:[];
 },getElementById(id){return all.get(id)}};
 const context={document:doc,window,location:window.location,history,navigator:{},console};
 vm.runInNewContext(content('public/app.js'),context);
 assert.equal(views[0].hidden,false);
 extra.fire('click');
 assert.equal(views[1].hidden,false);
 assert.equal(views[0].hidden,true);
 assert.equal(tabs[1].getAttribute('aria-current'),'page');
 select.fire('change');
 assert.equal(ref.textContent,'Psalm 27:14');
 assert.ok(verse.textContent.includes('Wait on the LORD'));
 const live=element('live-button',{dataset:{screen:'live'}});
 // Legacy #live deep links remain valid.
 hash='#live';handlers.hashchange();
 assert.equal(views[3].hidden,false);
 assert.equal(tabs[0].getAttribute('aria-current'),'page');
 // Native browser back must restore the selected screen without adding another entry.
 hash='#bible';handlers.popstate();
 assert.equal(views[1].hidden,false);
 assert.equal(views[3].hidden,true);
 // Accessibility skip link must keep its own #main anchor instead of rewriting the URL.
 hash='#main';handlers.hashchange();
 assert.equal(hash,'#main');
 assert.equal(views[1].hidden,false);
});

