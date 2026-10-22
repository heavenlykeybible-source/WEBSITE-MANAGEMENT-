import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=path=>readFileSync(new URL(path,root),'utf8');
const REQUIRED=['walk-offline.html','walk-offline.js','walk-offline.css','walk-offline-content.js','offline-vault.js','offline-status.js','creation-to-eternity.html','creation-to-eternity.js','creation-to-eternity.css','offline-noscript.css'];
test('Owner-locked offline features, links, curriculum and data keys survive release edits',()=>{
 const callbacks={},context={self:{addEventListener:(n,f)=>callbacks[n]=f},Set};
 vm.runInNewContext(read('public/sw.js')+';globalThis.paths=[...PUBLIC];',context);
 for(const path of REQUIRED){assert.ok(existsSync(new URL('public/'+path,root)),'Missing protected feature: '+path);assert.ok(context.paths.includes('/'+path),'Missing offline dependency: '+path)}
 const html=read('public/creation-to-eternity.html'),data=JSON.parse(html.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(data.length,35);assert.deepEqual(data.map(l=>l.id),Array.from({length:35},(_,i)=>i+1));
 assert.ok(read('public/index.html').includes('/walk-offline.html'));assert.ok(read('public/index.html').includes('/creation-to-eternity.html'));
 for(const id of ['daily-topic','goal-form','quiz-topic','journal-form','stats'])assert.ok(read('public/walk-offline.html').includes('id="'+id+'"'),'Removed offline pillar '+id);
 assert.ok(read('public/walk-offline.js').includes('hkem-offline-private-notebook-v1'));assert.ok(read('public/creation-to-eternity.js').includes('hkem-creation-eternity-v1'));
 assert.ok(read('public/offline-vault.js').includes("name:'AES-GCM'"));assert.ok(read('public/walk-offline.js').includes('sealNotebook(state,passphrase)'));
});
test('App upgrade deletes only old shells and keeps downloaded books/audio and unrelated stores',async()=>{
 const callbacks={},deleted=[],keys=['heavenly-key-app-shell-v5','heavenly-key-app-shell-v6','hk-kjv-opt-in-books-v1','hk-audio-approved-v1','hk-public-offline-pages-v1'];
 const context={self:{addEventListener:(n,f)=>callbacks[n]=f,clients:{claim:async()=>{}}},Set,Promise,caches:{keys:async()=>keys,delete:async key=>deleted.push(key)}};
 vm.runInNewContext(read('public/sw.js'),context);let done;callbacks.activate({waitUntil:p=>done=p});await done;assert.deepEqual(deleted,['heavenly-key-app-shell-v5','heavenly-key-app-shell-v6']);
});
