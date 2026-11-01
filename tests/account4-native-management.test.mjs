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

test('bulk GitHub onboarding reuses authorized credential and validates repository list',()=>{
 assert.match(client,/Add multiple repositories using one existing GitHub authorization/);
 assert.match(client,/names\.length>20/);
 assert.match(client,/new Set\(names\)\.size!==names\.length/);
 assert.match(client,/workspace\/github\/reuse/);
 assert.match(server,/const g=await importSource\(env,user,sourceId\)/);
 assert.match(server,/const head=await ghHead\(env,target\)/);
 assert.match(server,/original\.secret_enc/);
});

test('bulk GitHub endpoint enforces scope and validates before writes',()=>{
 assert.match(server,/workspace\/github\/bulk-connect/);
 assert.match(server,/names\.length>20/);
 assert.match(server,/new Set\(names\.map\(n=>n\.toLowerCase\(\)\)\)/);
 assert.match(server,/const g=await importSource\(env,user,sourceId\)/);
 assert.match(server,/await ghHead\(env,\{\.\.\.g,repo,branch,dir:''\}\)/);
 assert.match(server,/requiresOwnerApprovalForDeploy:true/);
 assert.match(client,/workspace\/github\/bulk-connect/);
});
