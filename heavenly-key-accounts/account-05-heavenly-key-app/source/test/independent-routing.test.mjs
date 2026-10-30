import test from 'node:test';import assert from 'node:assert/strict';import {routeIndependentApp} from '../src/independent-apps.js';
const request=path=>new Request('https://apps.heavenlykey.org'+path,{headers:{Cookie:'private=fixture',Authorization:'Bearer fixture'}});
test('Original notebook and study origins/paths use only their independent Worker and strip credentials',async()=>{for(const [path,binding,id,target]of [['/walk-offline.html','WALK_APP','walk-with-god','/walk-offline.html'],['/creation-to-eternity.html','BIBLE_STUDY_APP','bible-study-portal','/creation-to-eternity.html'],['/eternity-in-view/index.html','ETERNITY_APP','eternity-in-view','/eternity-in-view/']]){let calls=0;const response=await routeIndependentApp(request(path),{INDEPENDENT_APPS_ENABLED:'true',[binding]:{fetch:async req=>{calls++;assert.equal(new URL(req.url).pathname,target);assert.equal(req.headers.get('Cookie'),null);assert.equal(req.headers.get('Authorization'),null);return new Response('original content',{headers:{'X-HK-App-Service':id}});}}});assert.equal(await response.text(),'original content');assert.equal(calls,1);}});
test('App outage is isolated; missing or wrong service never falls through to another app',async()=>{const env={INDEPENDENT_APPS_ENABLED:'true'};assert.equal((await routeIndependentApp(request('/walk-offline.html'),env)).status,503);assert.equal(await routeIndependentApp(request('/api/member/login'),env),null);assert.equal(await routeIndependentApp(request('/index.html'),env),null);assert.equal((await routeIndependentApp(request('/walk-offline.html'),{...env,WALK_APP:{fetch:async()=>new Response('wrong')}})).status,502);assert.equal(await routeIndependentApp(request('/walk-offline.html'),{}),null);});

test('Every public app failure stays within its own Worker route',async()=>{
 const apps=[["/walk-offline.html", "WALK_APP", "walk-with-god"], ["/creation-to-eternity.html", "BIBLE_STUDY_APP", "bible-study-portal"], ["/eternity-in-view/", "ETERNITY_APP", "eternity-in-view"], ["/bible.html", "BIBLE_READER_APP", "bible-reader"], ["/audio-bible.html", "AUDIO_BIBLE_APP", "audio-bible"], ["/hymns.html", "HYMNS_APP", "hymns"], ["/audio-hymns.html", "AUDIO_HYMNS_APP", "audio-hymns"], ["/devotional.html", "DAILY_READING_APP", "daily-reading"]];
 for(const [failedPath,failedBinding] of apps){const env={INDEPENDENT_APPS_ENABLED:'true'};for(const [path,binding,id]of apps)env[binding]={fetch:async()=>{if(binding===failedBinding)throw Error('fixture outage');return new Response('healthy app',{headers:{'X-HK-App-Service':id}});}};
 for(const [path,binding]of apps)assert.equal((await routeIndependentApp(request(path),env)).status,binding===failedBinding?503:200);
 assert.equal(await routeIndependentApp(request('/api/member/login'),env),null);assert.equal(await routeIndependentApp(request('/index.html'),env),null);
 }
});

test('prototype-inherited paths never become independent application routes',async()=>{
 const env={INDEPENDENT_APPS_ENABLED:'true'};
 for(const path of ['/constructor','/__proto__','/toString','/valueOf','/hasOwnProperty']){
  assert.equal(await routeIndependentApp(request(path),env),null,'Unexpected route: '+path);
 }
});
