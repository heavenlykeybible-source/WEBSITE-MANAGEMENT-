// Regression tests for server-side devotional publication embargo.
import assert from 'node:assert/strict';
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
 if(expected===404)assert.equal(result.headers.get('Cache-Control'),'no-store, private');
 assert.deepEqual(calls,['/strength-publication-status.json',...(publicationStatus==='published'?['/'+filename]:[])]);
}
await check(tomorrow,'published',404);
await check(today,'published',200);
await check(today,'editorial-hold',404);
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
console.log('Devotional embargo regression: future approved entries blocked; current approved allowed; editorial hold blocked.');
