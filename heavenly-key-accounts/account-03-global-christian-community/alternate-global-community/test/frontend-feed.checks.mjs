import {test} from 'node:test';
// Run shared AI sandbox safety checks with the existing Account 3 feed test suite.
import '../../scripts/test-account4-ai-preview.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
class Node {
 constructor(tag,text){this.tag=tag;this.textContent=text||'';this.dataset={};this.children=[];this.attributes={};this.parentElement=null;}
 append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}
 replaceChildren(...items){this.children=[];this.append(...items);}
 replaceWith(next){const p=this.parentElement;p.children[p.children.indexOf(this)]=next;next.parentElement=p;}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
 setAttribute(k,v){this.attributes[k]=v;}
 addEventListener(){}
 matches(selector){return selector==='[data-feed]'&&this.dataset.feed!==undefined;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 querySelectorAll(selector){const keys={'[data-feed]':'feed','[data-feed-status]':'feedStatus','[data-post-id]':'postId','[data-load-more]':'loadMore'};return this.children.flatMap(n=>[...(keys[selector]&&n.dataset[keys[selector]]!==undefined?[n]:[]),...n.querySelectorAll(selector)]);}
}
test('Feed keeps the newest filter response and deduplicates paginated posts',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=source.indexOf('async function mountFeed('),end=source.indexOf('function feedTabs(',start),requests=[],host=new Node('section'),context={URLSearchParams,location:{search:''},page:'home',root:host,el:(tag,text)=>new Node(tag,text),api:url=>new Promise(resolve=>requests.push({url,resolve})),renderPost:p=>{const n=new Node('article',p.body);n.dataset.postId=String(p.post_id);return n;}};
 const mount=vm.runInNewContext(source.slice(start,end)+'\nmountFeed;',context);
 const old=mount(host,'article'),latest=mount(host,'video_link');assert.ok(requests[1].url.includes('video_link'));
 requests[1].resolve({items:[{post_id:2,body:'New selection'}],nextBefore:2});await latest;
 requests[0].resolve({items:[{post_id:1,body:'Stale selection'}]});await old;
 assert.deepEqual(host.querySelectorAll('[data-post-id]').map(n=>n.dataset.postId),['2']);assert.equal(host.attributes['aria-busy'],'false');
 const next=mount(host,null,true);requests[2].resolve({items:[{post_id:2,body:'Repeated'},{post_id:3,body:'Additional'}]});await next;
 assert.deepEqual(host.querySelectorAll('[data-post-id]').map(n=>n.dataset.postId),['2','3']);
});

test('Public broadcast player survives navigation and minimizes without restarting; Stop releases resources',async()=>{
const base=new URL('../../',import.meta.url);const readSource=path=>readFileSync(new URL(path,base),'utf8');
class Node{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.listeners={};this.hidden=false;this.classList={add(){},remove(){}};}
 append(...xs){for(const x of xs){x.parentElement=this;this.children.push(x);}}
 replaceChildren(...xs){this.children=[];this.append(...xs);}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);}
 focus(){this.focusCount=(this.focusCount||0)+1;}after(n){body.append(n);}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}addEventListener(k,f){(this.listeners[k]??=[]).push(f);}async click(){for(const f of this.listeners.click??[])await f({});}
}
const body=new Node('body'),authbar=new Node('div'),top=new Node('header'),headerNav=new Node('nav'),root=new Node('main'),document=new Node('document');body.append(top,authbar,root);top.append(headerNav);document.body=body;document.createElement=t=>new Node(t);document.querySelector=s=>s==='#authbar'?authbar:s==='.top'?top:s==='.nav'?headerNav:null;
let opened=0;const context={document};const mount=vm.runInNewContext(readSource('global-community/public/media-dock.js').replace('export function','function')+'\nmountMediaDock;',context);const controls=mount({onOpen:()=>opened++});const dock=body.children.find(n=>n.className==='faith-media-dock'),launch=headerNav.children.find(n=>n.className==='faith-media-launch');assert.equal(controls.active(),false);assert.equal(dock.hidden,true);assert.equal(dock.children[1].children.length,0,'No stream or frame before click');
await launch.children[2].click();const frame=dock.children[1].children[0];assert.ok(frame.src.endsWith('?channel=radio'));assert.equal(opened,1);
const head=dock.children[0];await head.children[1].click();assert.equal(dock.children[1].hidden,true);assert.equal(controls.active(),true);assert.equal(dock.children[1].children[0],frame,'Minimize must retain player');root.replaceChildren(new Node('article'));assert.equal(dock.children[1].children[0],frame,'Page content changes must retain player');await launch.children[2].click();assert.equal(dock.children[1].children[0],frame,'Opening same station must not restart it');await launch.children[3].click();const tv=dock.children[1].children[0];assert.notEqual(tv,frame);assert.ok(tv.src.endsWith('?channel=video'));await head.children[2].click();assert.equal(controls.active(),false);assert.equal(dock.hidden,true);assert.equal(dock.children[1].children.length,0,'Stop releases iframe and polling');
// Exercise the actual app navigation function with a pending render and private-page redirect.
const app=readSource('global-community/public/app.js'),start=app.indexOf('const routes='),end=app.indexOf('async function renderPage()',start);let renders=0;const history={pushState(_state,_title,url){location.href=url;location.pathname=new URL(url).pathname;location.search=new URL(url).search;},replaceState(_state,_title,url){this.pushState(_state,_title,url);}};const location={href:'https://community.example/index.html',origin:'https://community.example',pathname:'/index.html',search:'',reload(){throw Error('Unexpected reload');}};
controls.open('radio');const retained=dock.children[1].children[0];root.replaceChildren=()=>{renders++;root.children=[];};
const nav={URL,location,history,document:{body:{dataset:{},classList:{remove(){}}}},root,window:{scrollTo(){}},clearInterval(){},messageTimer:1,activeConversation:2,chatBodies:new Map(),confirm:()=>true,page:'home',mounts:{},renderPage:async()=>{}};vm.createContext(nav);vm.runInContext(app.slice(start,end)+'\nkeepNavigation=true;this.navigate=navigate;',nav);await nav.navigate('groups.html?id=2');assert.equal(location.pathname,'/groups.html');assert.equal(nav.page,'groups');assert.equal(nav.activeConversation,null);assert.equal(nav.messageTimer,null);assert.equal(renders,1);await nav.navigate('prayer.html');assert.equal(nav.page,'prayer');assert.equal(renders,2);assert.equal(root.focusCount,2,'Soft navigation moves keyboard focus into the new page');assert.equal(controls.active(),true);assert.equal(dock.children[1].children[0],retained);await head.children[2].click();

});

test('Quiet mode can be left without refreshing and clears on navigation',()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const start=source.indexOf('quiet.setAttribute("aria-pressed"'),end=source.indexOf(';tc.append(quiet)',start);
 let click,active=false;const attributes={},quiet={setAttribute:(k,v)=>attributes[k]=v,addEventListener:(event,fn)=>click=fn};
 vm.runInNewContext(source.slice(start,end),{quiet,document:{body:{classList:{toggle:()=>active=!active}}},window:{scrollTo(){}}});
 click();assert.equal(quiet.textContent,'Leave Quiet With God Mode');assert.equal(attributes['aria-pressed'],'true');
 click();assert.equal(quiet.textContent,'Enter Quiet With God Mode');assert.equal(attributes['aria-pressed'],'false');
 assert.ok(source.includes("classList.remove('social-page','messages-page','quiet-with-god')"));
});

test('Believer discovery retains the latest search and recovers after a failed request',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=source.indexOf('async function discoverProfiles('),end=source.indexOf('async function mountOtherProfile',start),requests=[];
 class DiscoveryNode extends Node{
  querySelector(selector){if(selector==='.list')return this.children.find(n=>n.className==='list')||null;return super.querySelector(selector);}
 }
 const host=new DiscoveryNode('section'),el=(tag,text,cls)=>{const n=new DiscoveryNode(tag,text);n.className=cls;return n;};
 const discover=vm.runInNewContext(source.slice(start,end)+'\ndiscoverProfiles;',{el,session:null,encodeURIComponent,api:url=>new Promise((resolve,reject)=>requests.push({url,resolve,reject}))});
 const old=discover(host,'older'),latest=discover(host,'newer');
 requests[1].resolve({items:[{user_id:2,display_name:'New result',connection_count:0}]});await latest;
 requests[0].resolve({items:[{user_id:1,display_name:'Old result'}]});await old;
 let list=host.querySelector('.list');assert.equal(list.children[0].children[0].textContent,'New result');assert.equal(list.attributes['aria-busy'],'false');assert.equal(host.children.length,1);
 const failed=discover(host,'failure');requests[2].reject(Error('Offline'));await failed;
 list=host.querySelector('.list');assert.match(list.children[0].textContent,/try Search again/);assert.equal(list.attributes['aria-busy'],'false');
 const retry=discover(host,'retry');requests[3].resolve({items:[]});await retry;assert.match(host.querySelector('.list').children[0].textContent,/No matching members/);
});

 test('Welcome illustration is guest-only and is never created for signed-in members',()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=source.indexOf('function communityWelcome('),end=source.indexOf('function socialFeedLayout(',start),created=[];
 const shortcuts=new Node('section');shortcuts.className='community-shortcuts';const context={session:null,communityShortcuts:()=>shortcuts,el:(tag,text,cls)=>{const n=new Node(tag,text);n.className=cls;created.push(n);return n;}};
 const welcome=vm.runInNewContext(source.slice(start,end)+'\ncommunityWelcome;',context);
 const guest=welcome();assert.equal(guest.className,'community-welcome');assert.equal(guest.children[2],shortcuts,'The real action panel appears underneath the welcome artwork');assert.equal(created.filter(n=>n.tag==='img').length,3);const art=guest.children[1];assert.equal(art.children[1].src,'assets/community-network.svg');assert.match(readFileSync(new URL('../public/'+art.children[1].src,import.meta.url),'utf8'),/^<svg/,'Actual welcome illustration asset must exist');assert.equal(art.children[0].children[0].children.length,2);assert.ok(art.children[0].children[0].children.every(n=>n.src==='assets/rotating-world-land.svg'),'Only the map layers belong to the rotating track');
 context.session={user:{user_id:1}};created.length=0;assert.equal(welcome(),null);assert.equal(created.length,0,'No welcome image request or banner for a signed-in member');
 });

test('Manual feed refresh keeps the selected filter and recovers its button',async()=>{
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),start=source.indexOf('function feedTabs('),end=source.indexOf('function composeCard(',start),host=new Node('section'),requests=[];
 const context={session:null,el:(tag,text)=>{const n=new Node(tag,text);n.addEventListener=(event,fn)=>{n[event]=fn;};return n;},mountFeed:async h=>{requests.push(h.dataset.postFilter);}};
 const tabs=vm.runInNewContext(source.slice(start,end)+'\nfeedTabs;',context);tabs(host);
 await host.children[0].children[1].click();assert.equal(host.dataset.postFilter,'article');
 const refresh=host.children[1].children[1];await refresh.click();assert.deepEqual(requests,['article','article']);assert.equal(refresh.disabled,false);
 context.mountFeed=async()=>{throw Error('Network unavailable');};await assert.rejects(refresh.click());assert.equal(refresh.disabled,false);
});


test('Community HTML navigation and referenced scripts/styles/images exist',async()=>{
 const {readdirSync,existsSync}=await import('node:fs');
 const {fileURLToPath}=await import('node:url');
 const {resolve}=await import('node:path');
 const directory=fileURLToPath(new URL('../public/',import.meta.url));
 const pages=readdirSync(directory).filter(name=>name.endsWith('.html'));
 assert.ok(pages.length>=10,'Expected the community website pages');
 for(const page of pages){
  const html=readFileSync(resolve(directory,page),'utf8');
  const links=html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g);
  for(const [,value] of links){
   if(/^(?:https?:|mailto:|tel:|data:|#|\/)/i.test(value))continue;
   const pathname=value.split(/[?#]/)[0];
   if(!pathname)continue;
   const target=resolve(directory,pathname);
   assert.ok(existsSync(target),page+' references missing local file: '+value);
  }
 }
});
