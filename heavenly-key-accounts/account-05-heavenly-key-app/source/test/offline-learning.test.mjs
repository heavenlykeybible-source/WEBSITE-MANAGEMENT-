import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import {sealNotebook,openNotebook} from '../public/offline-vault.js';import {DAILY} from '../public/walk-offline-content.js';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Private notebook round-trip, wrong-passphrase and tamper checks',async()=>{
 const secret={version:1,goals:[{title:'Private study goal',completed:false}],journal:[{title:'A private prayer',text:'My confidential prayer request'}],answers:{b01:1}};
 const sealed=await sealNotebook(secret,'a separate notebook passphrase');assert.deepEqual(await openNotebook(sealed,'a separate notebook passphrase'),secret);
 assert.ok(!JSON.stringify(sealed).includes('confidential'));assert.ok(!JSON.stringify(sealed).includes('Private study'));
 await assert.rejects(openNotebook(sealed,'a wrong notebook passphrase'));
 const changed={...sealed,ciphertext:'A'+sealed.ciphertext.slice(1)};if(changed.ciphertext===sealed.ciphertext)changed.ciphertext='B'+sealed.ciphertext.slice(1);await assert.rejects(openNotebook(changed,'a separate notebook passphrase'));
 await assert.rejects(openNotebook({...sealed,iterations:1},'a separate notebook passphrase'));
 await assert.rejects(sealNotebook(secret,'short'));
});
test('Daily reflections remain available after the owner-approved retirement of the old quiz',()=>{
 assert.ok(DAILY.length>=20);
 assert.doesNotMatch(file('public/walk-offline-content.js'),/export const QUESTIONS/);
 assert.doesNotMatch(file('public/walk-offline.html'),/id="quiz-topic"/);
});
test('Strict CSP: new learning pages contain no executable inline code or inline styles',()=>{
 for(const path of ['public/walk-offline.html','public/creation-to-eternity.html']){const html=file(path);assert.doesNotMatch(html,/<style|\sstyle=|<script>/i);assert.ok(html.includes('offline-status.js'))}
 assert.doesNotMatch(file('public/walk-offline.js'),/fetch\(|\/api\/|localStorage\.setItem\([^,]+,JSON\.stringify\(state\)/);
});
test('App service worker reopens learning tools offline and never captures private routes',async()=>{
 const listeners={},store=new Map();let online=true;
 const cache={async addAll(paths){for(const path of paths)store.set('https://app.test'+path,new Response('public '+path))},async match(key){return store.get(typeof key==='string'?(key.startsWith('http')?key:'https://app.test'+key):key.url)?.clone()},async put(key,r){store.set(typeof key==='string'?(key.startsWith('http')?key:'https://app.test'+key):key.url,r)}};
 const ctx={self:{location:{origin:'https://app.test'},addEventListener:(n,f)=>listeners[n]=f,clients:{claim:async()=>{}},skipWaiting:async()=>{}},URL,Set,Response,Promise,caches:{open:async()=>cache,keys:async()=>[],match:key=>cache.match(key),delete:async()=>{}},fetch:async path=>{if(!online)throw Error('offline');const response=new Response('public '+path);Object.defineProperty(response,'type',{value:'basic'});return response}};
 vm.runInNewContext(file('public/sw.js'),ctx);let installation;listeners.install({waitUntil:p=>installation=p});await installation;online=false;
 async function call(path,extra={}){let result;listeners.fetch({request:new Request('https://app.test'+path,extra),respondWith:p=>result=p,waitUntil(){}});return result?await result:null}
 for(const path of ['/walk-offline.html','/creation-to-eternity.html','/walk-offline-content.js','/offline-vault.js','/creation-to-eternity.js','/walk-offline.css'])assert.match(await(await call(path)).text(),/public/);
 for(const path of ['/api/member/me','/api/community/feed','/profile.html','/walk-offline.html?token=private'])assert.equal(await call(path),null);
 assert.equal(await call('/walk-offline.html',{headers:{Authorization:'Bearer fake'}}),null);
});
