import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../public/'+f,import.meta.url),'utf8');
test('Existing app switchers share public destinations and keep internal study modules in My Walk With God',()=>{
 const pages=['hymns.html','audio-hymns.html','walk-offline.html','creation-to-eternity.html','experience.html','assistant.html'];let reference;
 for(const page of pages){const html=read(page),nav=html.match(/<nav class="hk-app-switcher"[\s\S]*?<\/nav>/)?.[0];assert.ok(nav,page);assert.match(html,/href="\/app-switcher.css"/);assert.match(nav,/<details><summary>/);assert.doesNotMatch(nav,/audio-bible|href="https:\/\/apps.heavenlykey.org\/(?:audio-hymns|hymns|creation-to-eternity)\.html"/);
 const destinations=[...nav.matchAll(/href="([^"]+)"/g)].map(x=>x[1]);if(reference)assert.deepEqual(destinations,reference);else reference=destinations;
 assert.equal(destinations.length,12);assert.ok(destinations.every(x=>x.startsWith('https://')));assert.ok(destinations.includes('https://apps.heavenlykey.org/walk-offline.html#walk-bible-study'));}
 for(const page of ['bible.html','devotional.html']){const html=read(page);assert.match(html,/<header/);assert.match(html,/href="(?:\/experience.html#grow|bible.html)"/);}
 assert.ok(read('sw.js').includes("'/app-switcher.css'"));
});
test('Study navigation points to real all-in-one sections',()=>{const experience=read('experience.html');for(const page of ['bible.html','devotional.html','hymns.html','audio-bible.html']){const html=read(page);assert.doesNotMatch(html,/href="\/#(?:grow|community)"/);for(const ref of html.matchAll(/href="\/experience\.html#(grow|community)"/g))assert.ok(experience.includes('id="'+ref[1]+'"'),page+' points to missing '+ref[1]);}});
