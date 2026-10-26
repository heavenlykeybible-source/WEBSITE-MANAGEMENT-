import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {buildSmallApp} from '../scripts/build-small-app-worker.mjs';
for(const id of Object.keys(JSON.parse(fs.readFileSync('config/small-app-bundles.json','utf8'))))test('Independent original app bundle: '+id,async()=>{const built=await buildSmallApp(id),worker=(await import('data:text/javascript;base64,'+Buffer.from(built.code).toString('base64'))).default;
 const health=await (await worker.fetch(new Request('https://fixture.test/api/health'))).json();assert.equal(health.service,id);assert.equal(health.revision,built.revision);
 for(const [path,original]of Object.entries(built.assets)){const r=await worker.fetch(new Request('https://fixture.test'+path));assert.equal(r.status,200);assert.equal(await r.text(),original);assert.equal(r.headers.get('x-hk-app-service'),id);}
 assert.equal((await worker.fetch(new Request('https://fixture.test/api/admin'))).status,404);assert.equal((await worker.fetch(new Request('https://fixture.test/',{method:'POST'}))).status,405);
 if(id==='walk-with-god'){assert.match(built.assets['/walk-offline.js'],/hkem-offline-private-notebook-v1/);assert.match(built.assets['/walk-offline.js'],/\.\/offline-vault\.js/);assert.ok(built.assets['/offline-vault.js']);}
 if(id==='bible-study-portal')assert.match(built.assets['/creation-to-eternity.js'],/hkem-creation-eternity-v1/);
 assert.ok(!built.code.includes('env.DB')&&!built.code.includes('VAULT_KEY'));});
test('Unknown app cannot be bundled',async()=>{await assert.rejects(buildSmallApp('control-room'),/Unknown Account 5 app/);});
