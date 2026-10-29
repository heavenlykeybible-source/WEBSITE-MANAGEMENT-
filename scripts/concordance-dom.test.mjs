/** Executes actual application scripts in a DOM with local KJV fetches. Not a browser/layout test. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {root,study,loadCanon} from './concordance-core.mjs';
const tests=[];
async function harness(query='?book=GEN&chapter=46&verse=1'){
 const {window,document}=parseHTML(fs.readFileSync(study+'index.html','utf8'));
 for(const node of document.querySelectorAll('select')){
  let selected=node.querySelector('option')?.getAttribute('value')??'';
  Object.defineProperty(node,'value',{get(){return selected},set(v){selected=String(v)},configurable:true});
  Object.defineProperty(node,'options',{get(){return Array.from(this.querySelectorAll('option'))}});
  node.add=option=>{node.append(option);if(!selected)selected=option.value};
  const replace=node.replaceChildren.bind(node);node.replaceChildren=(...values)=>{replace(...values);selected=values[0]?.value??''};
 }
 const state={copied:'',shared:null,failCode:null};
 const location={href:'https://local.test/bible/concordance/'+query};
 const navigator={clipboard:{writeText:async t=>state.copied=t},share:async t=>state.shared=t};
 function Option(text,value){const o=document.createElement('option');o.textContent=text;o.value=value;Object.defineProperty(o,'text',{get(){return this.textContent}});return o}
 // Existing select options also expose the browser's .text property.
 for(const o of document.querySelectorAll('option'))Object.defineProperty(o,'text',{get(){return this.textContent}});
 const context=vm.createContext({window,document,Option,URL,location,history:{replaceState:(_,__,u)=>location.href=String(u)},navigator,MutationObserver:window.MutationObserver,queueMicrotask,AbortController,console,fetch:async url=>{
  const code=String(url).match(/\/([A-Z0-9]+)\.json$/)?.[1];
  if(code===state.failCode)return {ok:false};
  return {ok:true,json:async()=>JSON.parse(fs.readFileSync(root+'data/kjv/'+code+'.json','utf8'))};
 }});
 for(const file of ['concordance.js','study-notes-genesis-drafts.js','study-notes-matthew-5.js','study-notes-matthew-5b.js','search.js','topics.js','reference-links.js'])vm.runInContext(fs.readFileSync(study+file,'utf8'),context,{filename:file});
 const flush=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r))};
 await flush();
 const click=async selector=>{document.querySelector(selector).click();await flush()};
 const change=async(selector,value)=>{document.querySelector(selector).value=value;document.querySelector(selector).dispatchEvent(new window.Event('change'));await flush()};
 return {window,document,state,navigator,flush,click,change,context};
}
async function check(name,fn){await fn();tests.push(name)}
await check('real scripts load exact KJV and new draft with visible review warning',async()=>{
 const h=await harness();assert.equal(h.document.querySelector('#ref').textContent,'Genesis 46:1');assert.match(h.document.querySelector('#passage').textContent,/Beer-sheba/);assert.match(h.document.querySelector('#detail').textContent,/pending human doctrinal review/);
 await h.click('[data-tab=context]');assert.match(h.document.querySelector('#detail').textContent,/Historical or cultural context/);
 await h.click('[data-tab=references]');assert.equal(h.document.querySelectorAll('#detail a').length,2);assert.match(h.document.querySelector('#detail a').href,/chapter=26&verse=24/);
});
await check('all publication-held entries withheld in every tab',async()=>{
 const entries=fs.readdirSync(study+'drafts').flatMap(f=>JSON.parse(fs.readFileSync(study+'drafts/'+f)));
 for(const e of entries.filter(x=>x.publicationHold)){
  const [,name,ch,v]=e.ref.match(/^(.+) (\d+):(\d+)$/),code=loadCanon().books.find(b=>b[0]===name)[1],h=await harness(`?book=${code}&chapter=${ch}&verse=${v}`);
  for(const tab of ['explanation','context','references']){await h.click(`[data-tab=${tab}]`);assert.match(h.document.querySelector('#detail').textContent,/withheld/);assert.ok(!h.document.querySelector('#detail').textContent.includes(e.explanation))}
 }
});
await check('needs_revision never exposes text or falls back',async()=>{
 const h=await harness();h.window.registerConcordanceStudyNotes({'Genesis 46:1':{explanation:'HIDDEN DRAFT',context:'Hidden',references:'John 3:16',reviewStatus:'needs_revision'}});await h.click('[data-tab=explanation]');assert.match(h.document.querySelector('#detail').textContent,/withheld/);assert.doesNotMatch(h.document.querySelector('#detail').textContent,/HIDDEN DRAFT/);
});
await check('chapter and cross-book navigation both directions',async()=>{
 const h=await harness('?book=GEN&chapter=46&verse=34');await h.click('#next');assert.equal(h.document.querySelector('#ref').textContent,'Genesis 47:1');await h.click('#prev');assert.equal(h.document.querySelector('#ref').textContent,'Genesis 46:34');
 const b=await harness('?book=GEN&chapter=50&verse=26');await b.click('#next');assert.equal(b.document.querySelector('#ref').textContent,'Exodus 1:1');await b.click('#prev');assert.equal(b.document.querySelector('#ref').textContent,'Genesis 50:26');
});
await check('copy, share, fallback and permission failure handling',async()=>{
 const h=await harness();await h.click('#copy');assert.match(h.state.copied,/Genesis 46:1 \(KJV\)/);assert.match(h.state.copied,/pending human doctrinal review/);await h.click('#share');assert.match(h.state.shared.text,/Study link:/);h.navigator.share=undefined;await h.click('#share');assert.equal(h.document.querySelector('#status').textContent,'Study copied');h.navigator.clipboard.writeText=async()=>{throw Error('Denied')};await h.click('#copy');assert.match(h.document.querySelector('#status').textContent,/unavailable/);
});
await check('preserve legacy Genesis and Matthew study notes with unreviewed notice',async()=>{
 for(const [query,text] of [['?book=GEN&chapter=1&verse=1',/Creator of heaven and earth/],['?book=MAT&chapter=5&verse=3',/spiritual need/]]){const h=await harness(query);assert.match(h.document.querySelector('#detail').textContent,text);assert.match(h.document.querySelector('#detail').textContent,/pending human doctrinal review/)}
});
await check('undrafted verse fallback and full Scripture context',async()=>{
 const h=await harness('?book=EXO&chapter=40&verse=1');assert.match(h.document.querySelector('#detail').textContent,/not yet published/);await h.click('[data-tab=context]');assert.match(h.document.querySelector('#detail').textContent,/Selected/);
});
await check('selected-book concordance query returns deep links',async()=>{
 const h=await harness();h.document.querySelector('#search-scope').value='current';h.document.querySelector('#search-term').value='Beer-sheba';h.document.querySelector('#concordance-search').dispatchEvent(new h.window.Event('submit',{cancelable:true}));await h.flush();assert.match(h.document.querySelector('#search-progress').textContent,/matching verses found/);assert.ok(h.document.querySelectorAll('#search-results a').length);assert.match(h.document.querySelector('#search-results a').href,/book=GEN/);
});
await check('all-book concordance search and honest zero result',async()=>{
 const h=await harness();h.document.querySelector('#search-scope').value='all';h.document.querySelector('#search-term').value='zznonexistenttest9843';h.document.querySelector('#concordance-search').dispatchEvent(new h.window.Event('submit',{cancelable:true}));await h.flush();assert.equal(h.document.querySelector('#search-progress').textContent,'0 matching verses found');
});
await check('scripture request errors clear content and display status',async()=>{
 const h=await harness();h.state.failCode='EXO';await h.change('#book','EXO');assert.match(h.document.querySelector('#status').textContent,/unavailable/);assert.equal(h.document.querySelector('#passage').textContent,'');
});
console.log(JSON.stringify({passed:tests.length,failed:0,tests,limitations:'DOM execution with local KJV fetches and mocked clipboard/share; not browser, mobile layout, native device permissions, production performance or real network QA.'},null,2));
