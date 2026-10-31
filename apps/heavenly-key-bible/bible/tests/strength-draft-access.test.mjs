import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import worker from '../worker.js';

const origin='https://bible.heavenlykey.org';
const file='strength-devotionals-2027-batch01.json';
const topicNames=["Revival & Spiritual Fire","Holiness & Righteousness","Hope & Encouragement","Prayer & Intercession","Salvation & Repentance","Faith & Trust","The Holy Spirit","Evangelism & Soul Winning","Love & Christian Unity","The Word & Obedience","Wisdom & Discernment","End-time & Rapture Readiness"];
const makeEntry=(date='2026-11-13',overrides={})=>({
 date,status:'approved-for-publication',
 topics:Array.from({length:12},(_,i)=>({topic:topicNames[i],reviewStatus:'approved',reference:'Psalm 85:6',bibleText:'Verse',reflection:'Reflection',prayer:'Prayer'})),
 ...overrides
});
const approvedEntry=makeEntry();
const fixtures=(manifest,entries=[approvedEntry],filename=file)=>{
 const requests=[];
 const env={ASSETS:{fetch:async request=>{
  const path=new URL(request.url).pathname;
  requests.push(path);
  if(path==='/strength-publication-status.json')return Response.json(manifest);
  if(path==='/'+filename)return Response.json({timezone:'Africa/Lagos',entries});
  return new Response('public asset',{status:200});
 }}};
 return {env,requests};
};
const request=(method='GET',filename=file)=>new Request(origin+'/'+filename,{method});
const published={schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[file]};
const RealDate=globalThis.Date;
async function atLagosDate(iso,run){
 class FixedDate extends RealDate{
  constructor(...args){super(...(args.length?args:[iso]));}
  static now(){return new RealDate(iso).getTime();}
 }
 globalThis.Date=FixedDate;
 try{return await run();}finally{globalThis.Date=RealDate;}
}

test('draft manifest blocks GET without requesting draft bytes',async()=>{
 const {env,requests}=fixtures({schemaVersion:1,publicationStatus:'editorial-hold',publishedBatchFiles:[]});
 const response=await worker.fetch(request(),env);
 assert.equal(response.status,404);
 assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.deepEqual(requests,['/strength-publication-status.json']);
});
test('unknown devotional filename is denied before static asset access',async()=>{
 const {env,requests}=fixtures(published);
 for(const name of ['strength-devotionals-year6-batch01.json','strength-devotionals-backup.json','strength-devotionals-2026-old.json']){
  const response=await worker.fetch(new Request(origin+'/'+name),env);
  assert.equal(response.status,404);
  assert.match(response.headers.get('Cache-Control'),/no-store/);
 }
 assert.deepEqual(requests,[]);
});
test('unlisted batch blocked even when manifest is marked published',async()=>{
 const {env,requests}=fixtures({...published,publishedBatchFiles:[]});
 assert.equal((await worker.fetch(request(),env)).status,404);
 assert.deepEqual(requests,['/strength-publication-status.json']);
});
test('approved listed content is readable only on or after its Lagos publication date',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const {env}=fixtures(published);
  const response=await worker.fetch(request(),env);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Cache-Control'),'no-store, private');
  assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  assert.equal((await response.json()).entries.length,1);
 });
});
test('future editions are removed from an otherwise approved batch response',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const {env}=fixtures(published,[approvedEntry,makeEntry('2026-11-14')]);
  const response=await worker.fetch(request(),env);
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).entries.map(entry=>entry.date),['2026-11-13']);
 });
});
test('batch filename and exact date window must agree',async()=>{
 await atLagosDate('2028-02-29T12:00:00.000Z',async()=>{
  const filename='strength-devotionals-year2-batch02.json';
  const {env}=fixtures({...published,publishedBatchFiles:[filename]},[approvedEntry],filename);
  assert.equal((await worker.fetch(request('GET',filename),env)).status,404);
 });
});
test('one unapproved topic blocks an approved daily entry',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const topics=approvedEntry.topics.map(t=>({...t}));
  topics[5].reviewStatus='draft-original-editorial-and-doctrinal-approval-pending';
  const {env}=fixtures(published,[{...approvedEntry,topics}]);
  assert.equal((await worker.fetch(request(),env)).status,404);
 });
});
test('duplicate dates deny a supposedly published batch',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const {env}=fixtures(published,[approvedEntry,{...approvedEntry}]);
  assert.equal((await worker.fetch(request(),env)).status,404);
 });
});
test('invalid calendar date denies a supposedly published batch',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const {env}=fixtures(published,[makeEntry('2026-02-30')]);
  assert.equal((await worker.fetch(request(),env)).status,404);
 });
});
test('valid leap date remains eligible in its assigned batch',async()=>{
 await atLagosDate('2028-02-29T12:00:00.000Z',async()=>{
  const filename='strength-devotionals-year2-batch02.json';
  const {env}=fixtures({...published,publishedBatchFiles:[filename]},[makeEntry('2028-02-29')],filename);
  assert.equal((await worker.fetch(request('GET',filename),env)).status,200);
 });
});
test('invalid non-leap February date is rejected',async()=>{
 await atLagosDate('2028-02-28T12:00:00.000Z',async()=>{
  const filename='strength-devotionals-year2-batch02.json';
  const {env}=fixtures({...published,publishedBatchFiles:[filename]},[makeEntry('2027-02-29')],filename);
  assert.equal((await worker.fetch(request('GET',filename),env)).status,404);
 });
});
test('empty Scripture and unbounded topic text deny public access',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const incomplete=approvedEntry.topics.map(t=>({...t}));
  incomplete[0].bibleText=' ';
  const {env}=fixtures(published,[{...approvedEntry,topics:incomplete}]);
  assert.equal((await worker.fetch(request(),env)).status,404);
  const tooLong=approvedEntry.topics.map(t=>({...t}));
  tooLong[0].reflection='x'.repeat(281);
  const second=fixtures(published,[{...approvedEntry,topics:tooLong}]);
  assert.equal((await worker.fetch(request(),second.env)).status,404);
 });
});
test('published batch with swapped doctrinal topic names is rejected',async()=>{
 await atLagosDate('2026-11-13T12:00:00.000Z',async()=>{
  const topics=approvedEntry.topics.map(t=>({...t}));
  [topics[0].topic,topics[1].topic]=[topics[1].topic,topics[0].topic];
  const {env}=fixtures(published,[{...approvedEntry,topics}]);
  assert.equal((await worker.fetch(request(),env)).status,404);
 });
});
test('HEAD hides draft and has no response body',async()=>{
 const {env}=fixtures({schemaVersion:1,publicationStatus:'editorial-hold',publishedBatchFiles:[]});
 const response=await worker.fetch(request('HEAD'),env);
 assert.equal(response.status,404);
 assert.equal(await response.text(),'');
});
test('unknown publication manifest fails closed',async()=>{
 const {env}=fixtures({schemaVersion:2,publicationStatus:'published',publishedBatchFiles:[file]});
 assert.equal((await worker.fetch(request(),env)).status,404);
});

test('Cloudflare routes devotional JSON through Worker first',()=>{
 const config=readFileSync(fileURLToPath(new URL('../wrangler.toml',import.meta.url)),'utf8');
 const routeLine=config.split(String.fromCharCode(10)).find(line=>line.trim().startsWith('run_worker_first ='));
 assert.ok(routeLine,'Worker-first route configuration required');
 assert.ok(routeLine.includes('"/strength-devotionals-*"'),'Draft JSON must be routed through worker');
});
test('offline service worker cannot resurrect withdrawn devotional drafts',()=>{
 const source=readFileSync(fileURLToPath(new URL('../../heavenly-key-website/bible/sw.js',import.meta.url)),'utf8');
 assert.ok(source.includes('const isDevotionalDraftLibrary ='),'Draft JSON identification required');
 const start=source.indexOf('if(isDevotionalDraftLibrary){');
 const end=source.indexOf('const aliases=',start);
 assert.ok(start>=0&&end>start,'Draft interception must precede generic offline routing');
 const gate=source.slice(start,end);
 for(const expected of ['event.respondWith','cache:"no-store"','status:503','caches.open(name)','delete(event.request)']){
  assert.ok(gate.includes(expected),'Offline draft gate missing '+expected);
 }
});

test('all 21 devotional date windows match between the interface and edge worker',()=>{
 const html=readFileSync(fileURLToPath(new URL('../../heavenly-key-website/bible/strength-for-today.html',import.meta.url)),'utf8');
 const declaration=html.match(/const DEVOTIONAL_BATCHES=(\\[[\\s\\S]*?\\]);/);
 assert.ok(declaration,'Five-year devotional batch registry is required');
 const uiBatches=JSON.parse(declaration[1]);
 const workerSource=readFileSync(new URL('../worker.js',import.meta.url),'utf8');
 const workerBatches=[...workerSource.matchAll(/"(strength-devotionals-[^"]+\\.json)":\\["(\\d{4}-\\d{2}-\\d{2})","(\\d{4}-\\d{2}-\\d{2})"\\]/g)].map(match=>[match[1],match[2],match[3]]);
 assert.equal(uiBatches.length,21,'All 21 source batches must be selectable');
 assert.deepEqual(uiBatches.map(([start,end,name])=>[name,start,end]),workerBatches,'Browser and server date allowlists must agree exactly');
 assert.deepEqual(uiBatches.at(-1),['2031-07-30','2031-10-31','strength-devotionals-year5-batch04.json']);
});
test('final batch contains the two missing editions required for 1,828 days',()=>{
 const finalBatch=JSON.parse(readFileSync(fileURLToPath(new URL('../../heavenly-key-website/bible/strength-devotionals-year5-batch04.json',import.meta.url)),'utf8'));
 assert.equal(finalBatch.entries.length,94);
 assert.deepEqual(finalBatch.entries.slice(-2).map(entry=>entry.date),['2031-10-30','2031-10-31']);
 assert(finalBatch.entries.slice(-2).every(entry=>entry.status==='draft-not-published'&&entry.topics.every(topic=>topic.reviewStatus==='draft-original-editorial-and-doctrinal-approval-pending')));
});
