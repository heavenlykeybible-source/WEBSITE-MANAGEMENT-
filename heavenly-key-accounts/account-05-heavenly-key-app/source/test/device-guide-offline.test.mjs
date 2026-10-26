import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../public/',import.meta.url);
const inventory=JSON.parse(readFileSync(new URL('app-device-manifest.json',root)));
test('All device guides and QR artwork install and reopen offline without intercepting private or external requests',async()=>{
 const handlers={},saved=new Map();let installed;
 const origin='https://apps.heavenlykey.org';
 const context={URL,Set,Promise,Response,fetch:async()=>{throw Error('offline')},self:{location:{origin},addEventListener:(name,callback)=>handlers[name]=callback},caches:{open:async()=>({addAll:async paths=>{installed=paths;for(const path of paths){const file=path.endsWith('/')?path+'index.html':path;assert.ok(existsSync(new URL(file.slice(1),root)),file);saved.set(origin+path,new Response('cached '+path));}}}),match:async key=>saved.get(key)}};
 vm.runInNewContext(readFileSync(new URL('sw.js',root),'utf8'),context);
 let installation;handlers.install({waitUntil:p=>installation=p});await installation;
 for(const row of inventory){const path=new URL(row.url).pathname;for(const suffix of [path,path+'index.html',row.qr]){assert.ok(installed.includes(suffix),suffix);let response;handlers.fetch({request:new Request(origin+suffix),respondWith:p=>response=p,waitUntil:()=>{}});assert.equal(await (await response).text(),'cached '+suffix);}}
 for(const url of [origin+'/api/me',origin+'/account',origin+'/install/bible/android/?token=private','https://onlinebible.heavenlykey.org/']){let intercepted=false;handlers.fetch({request:new Request(url),respondWith:()=>intercepted=true});assert.equal(intercepted,false,url);}
 let authorized=false;handlers.fetch({request:new Request(origin+'/install/bible/android/',{headers:{Authorization:'Bearer test'}}),respondWith:()=>authorized=true});assert.equal(authorized,false);
});
