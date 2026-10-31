// Regression tests for server-side devotional publication embargo.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
// Cloudflare serves matching assets before Worker unless routing explicitly opts in.
const wrangler=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../wrangler.toml'),'utf8');
assert.match(wrangler,/run_worker_first\s*=\s*\[[^\]]*"\/strength-devotionals-\*"/s,'Devotional asset requests must always reach the Worker first');
import worker from '../worker.js';
const filename='strength-devotionals-2026.json';
const topicNames=['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Salvation & Repentance','Faith & Trust','The Holy Spirit','Evangelism & Soul Winning','Love & Christian Unity','The Word & Obedience','Wisdom & Discernment','End-time & Rapture Readiness'];
const topics=topicNames.map(topic=>({topic,reviewStatus:'approved',reference:'John 3:16',bibleText:'For God so loved the world',reflection:'A thoughtful reflection.',prayer:'Guide us today.'}));
const todayParts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(part=>[part.type,part.value]));
const today=todayParts.year+'-'+todayParts.month+'-'+todayParts.day;
const tomorrow=new Date(Date.parse(today+'T00:00:00Z')+86400000).toISOString().slice(0,10);
async function check(date,publicationStatus,expected){
 const manifest={schemaVersion:1,publicationStatus,publishedBatchFiles:[filename]};
 const data={timezone:'Africa/Lagos',entries:[{date,status:'approved-for-publication',topics}]};
 const calls=[];
 const env={ASSETS:{fetch:async request=>{
  const path=new URL(request.url).pathname;calls.push(path);
  if(path==='/strength-publication-status.json')return Response.json(manifest);
  if(path==='/'+filename)return Response.json(data);
  throw Error('Unexpected asset: '+path);
 }}};
 const result=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(result.status,expected);
 if(expected===200){assert.equal(result.headers.get('Content-Range'),null);assert.equal(result.headers.get('Accept-Ranges'),null);assert.equal(result.headers.get('Content-Length'),null );assert.match(result.headers.get('Content-Type'),/^application\/json/);assert.equal(result.headers.get('X-Robots-Tag'),'noindex, noarchive');}
 if(expected===404)assert.equal(result.headers.get('Cache-Control'),'no-store, private');
 if(expected===404)assert.equal(result.headers.get('X-Robots-Tag'),'noindex, noarchive');
 assert.deepEqual(calls,['/strength-publication-status.json',...(publicationStatus==='published'?['/'+filename]:[])]);
}
await check(tomorrow,'published',404);
await check(today,'published',200);
await check(today,'editorial-hold',404);
// A published batch must be in chronological order, not merely contain unique dates.
{
 const entries=[today,new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10)].map(date=>({date,status:'approved-for-publication',topics}));
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json({schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]}):Response.json({timezone:'Africa/Lagos',entries})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404);
}
// Published files with missing calendar days must never pass the release gate.
{
 const earlier=new Date(Date.parse(today+'T00:00:00Z')-2*86400000).toISOString().slice(0,10);
 const entries=[earlier,today].map(date=>({date,status:'approved-for-publication',topics}));
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json({schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]}):Response.json({timezone:'Africa/Lagos',entries})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404);
}
// Unrecognized filenames must not fall through to the public asset layer.
{
 let called=false;
 const env={ASSETS:{fetch:async()=>{called=true;throw Error('Asset should not be fetched');}}};
 const response=await worker.fetch(new Request('https://example.org/strength-devotionals-unreviewed.json'),env);
 assert.equal(response.status,404);
 assert.equal(called,false);
}
// HEAD requests must not leak draft content or response bodies.
{
 const env={ASSETS:{fetch:async()=>Response.json({private:true})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename,{method:'HEAD'}),env);
 assert.equal(response.status,404);
 assert.equal(await response.text(),'');
}
// Malformed publication manifests and malformed batches must fail closed.
for(const scenario of [
 {label:'missing allowlist',manifest:{schemaVersion:1,publicationStatus:'published'},data:null},
 {label:'unapproved file',manifest:{schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[]},data:null},
 {label:'invalid batch',manifest:{schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]},data:{entries:[]}},
 {label:'malformed JSON',manifest:{schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]},malformed:true}
]){
 const env={ASSETS:{fetch:async request=>{
  if(new URL(request.url).pathname==='/strength-publication-status.json')return Response.json(scenario.manifest);
  return scenario.malformed?new Response('{bad json',{headers:{'Content-Type':'application/json'}}):Response.json(scenario.data);
 }}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404,scenario.label);
 assert.equal(response.headers.get('Cache-Control'),'no-store, private',scenario.label);
}
// A partial-content request cannot reveal unpublished devotional material.
{
 const env={ASSETS:{fetch:async()=>Response.json({schemaVersion:1,publicationStatus:'editorial-hold',publishedBatchFiles:[]})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename,{headers:{Range:'bytes=0-20'}}),env);
 assert.equal(response.status,404);
 assert.equal(await response.text(),'');
}
// Upstream partial asset responses are rejected rather than forwarded to readers.
{
 const manifest={schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]};
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json(manifest):new Response('partial',{status:206,headers:{'Content-Range':'bytes 0-6/100'}})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404);
 assert.equal(response.headers.get('Content-Range'),null);
}
// Calendar validation must reject impossible dates even in approved batches.
for(const invalidDate of ['2026-02-30','2026-13-01','2027-02-29']){
 const manifest={schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]};
 const data={timezone:'Africa/Lagos',entries:[{date:invalidDate,status:'approved-for-publication',topics}]};
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json(manifest):Response.json(data)}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404,invalidDate);
}
// A batch cannot be served if any entry is unreviewed or its topic sequence is altered.
for(const scenario of ['unapproved entry','unapproved topic','reordered topics']){
 const manifest={schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]};
 const entry={date:today,status:'approved-for-publication',topics:topics.map(topic=>({...topic}))};
 if(scenario==='unapproved entry')entry.status='draft';
 if(scenario==='unapproved topic')entry.topics[0].reviewStatus='draft';
 if(scenario==='reordered topics')entry.topics.reverse();
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json(manifest):Response.json({timezone:'Africa/Lagos',entries:[entry]})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404,scenario);
}
// Published batches must reject repeated calendar days.
{
 const manifest={schemaVersion:1,publicationStatus:'published',publishedBatchFiles:[filename]};
 const entry={date:today,status:'approved-for-publication',topics};
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json(manifest):Response.json({timezone:'Africa/Lagos',entries:[entry,entry]})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename),env);
 assert.equal(response.status,404);
}
// Requests for unreleased files must fail even when a client adds a cache-busting query.
{
 const env={ASSETS:{fetch:async request=>new URL(request.url).pathname==='/strength-publication-status.json'?Response.json({schemaVersion:1,publicationStatus:'editorial-hold',publishedBatchFiles:[]}):Response.json({private:true})}};
 const response=await worker.fetch(new Request('https://example.org/'+filename+'?v=latest'),env);
 assert.equal(response.status,404);
 assert.equal(response.headers.get('Cache-Control'),'no-store, private');
}
// Unsupported HTTP methods must not fetch even the publication manifest.
for(const method of ['POST','PUT','PATCH','DELETE','OPTIONS']){
 let fetched=false;
 const env={ASSETS:{fetch:async()=>{fetched=true;throw Error('Unexpected fetch');}}};
 const response=await worker.fetch(new Request('https://example.org/'+filename,{method}),env);
 assert.equal(response.status,405,method);
 assert.equal(fetched,false,method);
}
console.log('Devotional embargo regression: future approved entries blocked; current approved allowed; editorial hold blocked.');
