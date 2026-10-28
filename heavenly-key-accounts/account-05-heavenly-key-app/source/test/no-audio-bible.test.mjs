import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);
const read=name=>readFileSync(new URL(name,root),'utf8');
test('Audio Bible is retired from Account 5 public entry points',()=>{
 for(const name of ['index.html','downloads.html','app-downloads.json','sw.js','bible.html','experience.html','app-launcher.js']){
  assert.doesNotMatch(read(name),/audio[- ]bible/i,name+' must not advertise Audio Bible');
 }
 const catalog=JSON.parse(read('app-downloads.json'));
 assert.equal(Object.hasOwn(catalog,'audio-bible'),false);
 for(const name of ['audio-bible.js','audio-bible-catalog.js','audio-bible-manifest.json','manifests/audio-bible.webmanifest']){
  assert.equal(existsSync(new URL(name,root)),false,name+' must remain retired');
 }
 const retired=read('audio-bible.html');
 assert.match(retired,/url=\/bible\.html/i);
 assert.doesNotMatch(retired,/<audio\b|audio-bible\.js/i);
});
test('Written KJV and hymns remain available',()=>{
 assert.match(read('bible.html'),/Authorised King James Version/);
 assert.ok(existsSync(new URL('study-library.js',root)));
 assert.ok(existsSync(new URL('hymns.html',root)));
 assert.ok(existsSync(new URL('audio-hymns.html',root)));
});
