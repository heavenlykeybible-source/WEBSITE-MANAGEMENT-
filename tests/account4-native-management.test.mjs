import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync('workspace/imports.js','utf8');
const client=fs.readFileSync('workspace/client.js','utf8');
test('native Control Room features remain available',()=>{
 for(const route of ['workspace/workers','workspace/workers/propose-edit','workspace/dns/verify-permission','workspace/dns/propose-create','workspace/dns/approve-create','workspace/github/reuse','workspace/import-from-github'])assert.ok(server.includes(route),'Missing '+route);
 assert.match(server,/coreProposeWorker\(env,actor/);
 assert.match(client,/Worker Code Review/);
 assert.match(client,/Cloudflare Subdomain Management/);
});
test('no external automated-browser execution remains in native workspace',()=>{
 for(const s of [server,client])assert.doesNotMatch(s,/workspace\/tinyfish\/|BROWSER_ENGINE_KEY|BROWSER_ENGINE_URL|fishPanel|Heavenly Key Browser Engine/);
});
