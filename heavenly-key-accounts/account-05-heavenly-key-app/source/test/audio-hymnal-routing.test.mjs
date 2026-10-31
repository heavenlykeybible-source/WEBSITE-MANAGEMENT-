import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeIndependentApp } from '../src/independent-apps.js';

const config=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/independent-apps.js',import.meta.url),'utf8');
const request=path=>new Request('https://apps.heavenlykey.org'+path);

test('Audio Hymnal HTML and player module are not intercepted by external services', async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true',AUDIO_HYMNS_APP:{fetch:async()=>{throw Error('External audio service unexpectedly invoked');}}};
 for(const path of ['/audio-hymns.html','/audio-hymns.js']){
  assert.equal(await routeIndependentApp(request(path),env),null,path);
  assert.equal(config.includes('"'+path+'"'),false,path+' should be served by static assets');
  assert.equal(source.includes('"'+path+'":'),false,path+' should not be mapped to external service');
 }
 assert.doesNotMatch(config,/binding\s*=\s*"AUDIO_HYMNS_APP"/);
});

test('unrelated independent application services retain their routing and fail closed',async()=>{
 const page=await routeIndependentApp(request('/bible.html'),{INDEPENDENT_APPS_ENABLED:'true'});
 assert.equal(page.status,503);
 const other=await routeIndependentApp(request('/devotional.html'),{INDEPENDENT_APPS_ENABLED:'true'});
 assert.equal(other.status,503);
});

test('local Audio Hymnal entry and controls remain present',()=>{
 const page=readFileSync(new URL('../public/audio-hymns.html',import.meta.url),'utf8');
 assert.match(page,/src="\/audio-hymns\.js"/);
 assert.match(page,/id="hymn-player"/);
 assert.match(page,/rel="manifest" href="\/manifests\/audio-hymns\.webmanifest"/);
 assert.doesNotMatch(page,/http-equiv="refresh"/i);
});

test('independent app services cannot set main-site cookies or issue redirects',async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{
  fetch:async()=>new Response('<h1>Reading</h1>',{status:200,headers:{
   'X-HK-App-Service':'bible-reader','Content-Type':'text/html',
   'Set-Cookie':'__Host-hk_session=malicious; Secure; Path=/',
   'Location':'https://other.example/redirect',
  }})
 }};
 const response=await routeIndependentApp(request('/bible.html'),env);
 assert.equal(response.status,200);
 assert.equal(await response.text(),'<h1>Reading</h1>');
 assert.equal(response.headers.get('set-cookie'),null);
 assert.equal(response.headers.get('location'),null);
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('referrer-policy'),'no-referrer');
 assert.equal(response.headers.get('content-type'),'text/html');
});

test('independent HEAD and empty body statuses remain valid responses',async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{
  fetch:async(request)=>request.method==='HEAD'
   ?new Response(null,{status:200,headers:{'X-HK-App-Service':'bible-reader'}})
   :new Response(null,{status:204,headers:{'X-HK-App-Service':'bible-reader'}})
 }};
 const head=await routeIndependentApp(new Request('https://apps.heavenlykey.org/bible.html',{method:'HEAD'}),env);
 assert.equal(head.status,200);assert.equal(await head.text(),'');
 const empty=await routeIndependentApp(request('/bible.html'),env);
 assert.equal(empty.status,204);assert.equal(await empty.text(),'');
});

test('independent service 302 redirects are rejected before browsers see them',async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{
  fetch:async()=>new Response(null,{status:302,headers:{
   'X-HK-App-Service':'bible-reader','Location':'https://unapproved.example/'
  }})
 }};
 const response=await routeIndependentApp(request('/bible.html'),env);
 assert.equal(response.status,502);
 assert.equal(response.headers.get('location'),null);
 assert.equal(response.headers.get('cache-control'),'no-store');
});

test('independent app response cannot clear main-site data, refresh, or grant CORS access',async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{
  fetch:async()=>new Response('<h1>Reader</h1>',{status:200,headers:{
   'X-HK-App-Service':'bible-reader',
   'Content-Type':'text/html; charset=utf-8',
   'Clear-Site-Data':'"cookies", "storage"',
   'Refresh':'0;url=https://unapproved.example/',
   'Access-Control-Allow-Origin':'*',
   'Access-Control-Allow-Credentials':'true',
   'Access-Control-Allow-Methods':'GET, POST',
   'Access-Control-Allow-Headers':'Authorization',
   'Access-Control-Expose-Headers':'Set-Cookie',
   'Access-Control-Max-Age':'86400',
  }})
 }};
 const response=await routeIndependentApp(request('/bible.html'),env);
 assert.equal(response.status,200);
 for(const name of ['clear-site-data','refresh','access-control-allow-origin',
  'access-control-allow-credentials','access-control-allow-methods',
  'access-control-allow-headers','access-control-expose-headers','access-control-max-age']){
  assert.equal(response.headers.get(name),null,'Unsafe response header leaked: '+name);
 }
 assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8');
 assert.equal(await response.text(),'<h1>Reader</h1>');
});

test('conditional static app responses preserve HTTP 304 without redirecting',async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{
  fetch:async()=>new Response(null,{status:304,headers:{
   'X-HK-App-Service':'bible-reader',
   'ETag':'"reviewed-release"',
   'Location':'https://unapproved.example/'
  }})
 }};
 const response=await routeIndependentApp(request('/bible.html'),env);
 assert.equal(response.status,304);
 assert.equal(response.headers.get('location'),null);
 assert.equal(response.headers.get('etag'),'"reviewed-release"');
 assert.equal(await response.text(),'');
});

test('service binding subrequests disable automatic redirect following and credentials',async()=>{
 let upstreamRequest;
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{
  fetch:async request=>{
   upstreamRequest=request;
   return new Response('Public page',{status:200,headers:{'X-HK-App-Service':'bible-reader','Content-Type':'text/html'}});
  }
 }};
 const response=await routeIndependentApp(new Request('https://apps.heavenlykey.org/bible.html',{
  headers:{Cookie:'__Host-hk_session=private',Authorization:'Bearer private',Accept:'text/html'}
 }),env);
 assert.equal(response.status,200);
 assert.equal(upstreamRequest.redirect,'manual');
 assert.equal(upstreamRequest.credentials,'omit');
 assert.equal(upstreamRequest.headers.get('cookie'),null);
 assert.equal(upstreamRequest.headers.get('authorization'),null);
 assert.equal(upstreamRequest.headers.get('accept'),'text/html');
});

test('independent apps reject insecure and parameterized entry URLs before service lookup',async()=>{
 let calls=0;
 const env={INDEPENDENT_APPS_ENABLED:'true',BIBLE_READER_APP:{fetch:async()=>{calls++;return new Response('Unexpected');}}};
 for(const url of [
  'http://apps.heavenlykey.org/bible.html',
  'https://apps.heavenlykey.org/bible.html?app=other',
  'https://apps.heavenlykey.org/bible.html?token=private',
  'https://user:pass@apps.heavenlykey.org/bible.html'
 ]){
  const response=await routeIndependentApp(new Request(url),env);
  assert.equal(response.status,400,url);
  assert.equal(response.headers.get('cache-control'),'no-store');
 }
 assert.equal(calls,0,'Unsafe independent app requests reached another service');
 const response=await routeIndependentApp(new Request('https://apps.heavenlykey.org/bible.html'),env);
 assert.equal(response.status,502,'Untrusted service identity must still be enforced');
 assert.equal(calls,1);
});
