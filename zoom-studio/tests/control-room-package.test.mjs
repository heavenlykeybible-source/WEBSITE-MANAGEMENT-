import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
execFileSync(process.execPath,[path.join(root,'scripts/bundle-control-room.mjs')]);
const {default:app}=await import(pathToFileURL(path.join(root,'build/meeting-worker.mjs')));
test('complete Control Room bundle serves exact public assets and excludes private sources',async()=>{
 for(const name of ['index.html','studio-theme.css','bg/globe-doves.jpg','icons/icon-192.png']){
  // Icon naming differs between supplied packages; check the actual manifest below.
  if(!fs.existsSync(path.join(root,'site',name)))continue;
  const r=await app.fetch(new Request('https://meeting/'+name),{},{});assert.equal(r.status,200);
  assert.deepEqual(Buffer.from(await r.arrayBuffer()),fs.readFileSync(path.join(root,'site',name)));
 }
 for(const name of ['_worker.js','_headers','server/setup-accounts.mjs','../schema.sql'])assert.equal((await app.fetch(new Request('https://meeting/'+name),{},{})).status,404);
 const r=await app.fetch(new Request('https://meeting/'),{},{});const etag=r.headers.get('etag');assert.ok(etag);
 assert.equal((await app.fetch(new Request('https://meeting/',{headers:{'if-none-match':etag}}),{},{})).status,304);
 assert.equal((await app.fetch(new Request('https://meeting/',{method:'HEAD'}),{},{})).status,200);
 assert.equal((await app.fetch(new Request('https://meeting/',{method:'POST'}),{},{})).status,405);
});
function database(){
 const raw=new DatabaseSync(':memory:');let migrations=0;
 const DB={async exec(sql){migrations++;raw.exec(sql);return{};},prepare(sql){const q=raw.prepare(sql);let a=[];return{bind(...x){a=x;return this},async first(){return q.get(...a)||null},async all(){return{results:q.all(...a)}},async run(){const r=q.run(...a);return{meta:{changes:r.changes}}}}}};
 return{raw,DB,get migrations(){return migrations}};
}
const secret='fixture-control-room-shared-secret-only';
function ticket(n='11111111-1111-4111-8111-111111111111',extra={}){const p=Buffer.from(JSON.stringify({k:'control-owner',e:'owner@studio.local',n,exp:Date.now()+60000,...extra})).toString('base64url');return p+'.'+createHmac('sha256',secret).update(p).digest('hex');}
const login=(env,t)=>app.fetch(new Request('https://meeting/api/control-login',{method:'POST',body:new URLSearchParams({ticket:t})}),env,{});
test('first health request initializes additive schema; repeated requests retain data',async()=>{
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret};
 assert.equal((await app.fetch(new Request('https://meeting/api/health'),env,{})).status,200);
 d.raw.exec("INSERT INTO programs(id,owner,title,created) VALUES('existing','existing','Keep me',1)");
 const r=await app.fetch(new Request('https://meeting/api/health'),env,{});assert.equal((await r.json()).accountsConfigured,true);assert.equal(d.migrations,1);assert.equal(d.raw.prepare('SELECT title FROM programs').get().title,'Keep me');d.raw.close();
});
test('owner launch requires a signed single-use ticket and never overrides another identity',async()=>{
 const d=database(),env={TEAMDB:d.DB,AUTH_SECRET:secret};
 assert.equal((await login(env,'bad')).status,403);
 assert.equal((await login(env,ticket(undefined,{k:'wrong'}))).status,403);
 assert.equal((await login(env,ticket(undefined,{exp:Date.now()-1}))).status,403);
 const t=ticket(),r=await login(env,t);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),/localStorage.setItem/);
 assert.equal(d.raw.prepare('SELECT role FROM users').get().role,'owner');assert.equal((await login(env,t)).status,403);
 d.raw.exec("UPDATE users SET role='user'");assert.equal((await login(env,ticket('22222222-2222-4222-8222-222222222222'))).status,409);assert.equal(d.raw.prepare('SELECT role FROM users').get().role,'user');d.raw.close();
});
test('missing database yields a clear setup failure while public template still loads',async()=>{
 assert.equal((await app.fetch(new Request('https://meeting/'),{},{})).status,200);
 assert.equal((await app.fetch(new Request('https://meeting/api/health'),{},{})).status,503);
});
