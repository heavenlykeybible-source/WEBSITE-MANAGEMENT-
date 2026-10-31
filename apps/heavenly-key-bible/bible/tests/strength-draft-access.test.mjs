import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import worker from '../worker.js';

const origin='https://bible.heavenlykey.org';
const file='strength-devotionals-2027-batch01.json';
const approvedEntry={
 date:'2026-11-13',status:'approved-for-publication',
 topics:Array.from({length:12},(_,i)=>({topic:'Topic '+i,reviewStatus:'approved',reference:'Psalm 85:6',bibleText:'Verse',reflection:'Reflection',prayer:'Prayer'}))
};
const fixtures=(manifest,entries=[approvedEntry])=>{
 const requests=[];
 const env={ASSETS:{fetch:async request=>{
   const path=new URL(request.url).pathname;
   requests.push(path);
   if(path==='/strength-publication-status.json')
     return Response.json(manifest);
   if(path==='/'+file)
     return Response.json({timezone:'Africa/Lagos',entries});
   return new Response('public asset',{status:200});
 }}};
 return {env,requests};
};
const request=(method='GET')=>new Request(origin+'/'+file,{method});
const published={schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[file]};

test('draft manifest blocks GET without requesting draft bytes',async()=>{
 const {env,requests}=fixtures({schemaVersion:1,publicationStatus:'editorial-hold',publishedBatchFiles:[]});
 const response=await worker.fetch(request(),env);
 assert.equal(response.status,404);
 assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.deepEqual(requests,['/strength-publication-status.json']);
});
test('unlisted batch blocked even when manifest is marked published',async()=>{
 const {env,requests}=fixtures({...published,publishedBatchFiles:[]});
 assert.equal((await worker.fetch(request(),env)).status,404);
 assert.deepEqual(requests,['/strength-publication-status.json']);
});
test('approved listed content is readable',async()=>{
 const {env}=fixtures(published);
 const response=await worker.fetch(request(),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal((await response.json()).entries.length,1);
});
test('one unapproved topic blocks entire listed batch',async()=>{
 const topics=approvedEntry.topics.map(t=>({...t}));
 topics[5].reviewStatus='draft-original-editorial-and-doctrinal-approval-pending';
 const {env}=fixtures(published,[{...approvedEntry,topics}]);
 const response=await worker.fetch(request(),env);
 assert.equal(response.status,404);
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
