import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const publicRoot=new URL('../public/',import.meta.url);
test('retired Audio Bible does not expose a playable interface',()=>{
 const page=readFileSync(new URL('audio-bible.html',publicRoot),'utf8');
 assert.ok(page.includes('url=/bible.html'));
 assert.doesNotMatch(page,/<audio\\b|audio-bible\\.js/i);
 for(const path of ['audio-bible.js','audio-bible-catalog.js','audio-bible-manifest.json']) {
  assert.equal(existsSync(new URL(path,publicRoot)),false,path+' must remain retired');
 }
});
test('written Bible and approved hymn audio remain accessible',()=>{
 assert.ok(existsSync(new URL('bible.html',publicRoot)));
 assert.ok(existsSync(new URL('audio-hymns.html',publicRoot)));
 assert.ok(existsSync(new URL('audio-hymn-catalog.js',publicRoot)));
});
