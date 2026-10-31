import assert from 'node:assert/strict';
import test from 'node:test';
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
