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
