import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../src/index.js';

const req=(path,options={})=>new Request('https://app.example.test'+path,options);
const enabled={COMMUNITY_PUBLIC_READS_ENABLED:'true'};
const reply=items=>new Response(JSON.stringify({items}),{headers:{'content-type':'application/json','set-cookie':'gc_session=secret'}});

test('disabled integration never contacts Account 3',async()=>{
 let called=false;const app=createWorker(async()=>{called=true;throw Error();});
 for(const path of ['/api/community/feed','/api/community/tracks']){
  const r=await app.fetch(req(path),{});assert.equal(r.status,503);assert.equal(r.headers.get('cache-control'),'no-store');
 }
 assert.equal(called,false);
});
test('public feed never forwards credentials, queries or arbitrary destinations',async()=>{
 let called=0;const app=createWorker(async(url,options)=>{
  called++;assert.equal(url,'https://global.heavenlykey.org/api/feed');
  assert.deepEqual(options.headers,{Accept:'application/json'});
  assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  return reply([{profile_name:'A member',body:'A public testimony',email:'private',userId:33},{post_type:'video',body:'excluded'},{video_url:'https://example.test',body:'excluded'}]);
 });
 const r=await app.fetch(req('/api/community/feed',{headers:{cookie:'gc_session=private',authorization:'Bearer private'}}),enabled);
 assert.equal(r.status,200);assert.equal(r.headers.get('set-cookie'),null);
 assert.deepEqual(await r.json(),{items:[{display_name:'A member',body:'A public testimony'}]});
 for(const path of ['/api/community/feed?before=5','/api/community/feed?url=https://evil.test'])assert.equal((await app.fetch(req(path),enabled)).status,400);
 for(const [path,method] of [['/api/community/me','GET'],['/api/community/feed','POST'],['/api/auth/login','POST'],['/api/community/tracks','DELETE']])assert.equal((await app.fetch(req(path,{method}),enabled)).status,404);
 assert.equal(called,1);
});
test('track summaries omit completion and private metadata',async()=>{
 const app=createWorker(async(url)=>{assert.equal(url,'https://global.heavenlykey.org/api/discipleship/tracks');return reply([{title:'Follow Christ',description:'Foundations',lessons:[{completed:1}],userId:1}]);});
 const r=await app.fetch(req('/api/community/tracks'),enabled);
 assert.deepEqual(await r.json(),{items:[{title:'Follow Christ',description:'Foundations'}]});
});
test('unavailable, malformed and oversized upstreams fail without exposing content',async()=>{
 for(const mock of [()=>new Response('secret',{status:500}),()=>new Response('not json',{headers:{'content-type':'application/json'}}),()=>reply(null),()=>reply([{body:'x'.repeat(270000)}]),()=>{throw Error('sensitive internal details')}]){
  const app=createWorker(async()=>mock());const r=await app.fetch(req('/api/community/feed'),enabled);
  assert.equal(r.status,502);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.deepEqual(await r.json(),{error:'Community content is temporarily unavailable.'});
 }
});
test('large feeds are limited to twenty bounded text entries',async()=>{
 const app=createWorker(async()=>reply(Array.from({length:21},()=>({profile_name:'a'.repeat(200),body:'b'.repeat(6000)}))));
 const r=await app.fetch(req('/api/community/feed'),enabled);const {items}=await r.json();
 assert.equal(items.length,20);assert.equal(items[0].display_name.length,160);assert.equal(items[0].body.length,5000);
});
