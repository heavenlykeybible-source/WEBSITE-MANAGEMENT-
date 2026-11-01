import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync('workspace/imports.js','utf8');
const client=fs.readFileSync('workspace/client.js','utf8');
const workflow=fs.readFileSync('.github/workflows/review-application-build.yml','utf8');

test('review dispatch is explicitly owner only and cannot authorize deployment',()=>{
 assert.match(server,/if\(user\.role!=='owner'/);
 assert.match(server,/item\.createdBy!==user\.id/);
 assert.match(server,/item\.status!=='build-required'/);
 assert.match(server,/item\.deploymentAuthorized=false/);
 assert.match(server,/withOperationLock\(env,'application-build:'/);
});
test('review build input contract matches GitHub Actions',()=>{
 for(const key of ['request_id','source_sha','directory']){
  assert.ok(workflow.includes('      '+key+':'),'workflow requires '+key);
  assert.ok(server.includes(key+':')||(key==='directory'&&server.includes('source_sha:item.commit,directory')),'dispatch passes '+key);
 }
 assert.match(workflow,/run-name: Review \$\{\{ inputs\.request_id \}\}/);
 assert.match(server,/const wanted='Review '\+b\.id/);
 assert.match(workflow,/name: review-build-\$\{\{ inputs\.request_id \}\}/);
 assert.match(server,/a\.name==='review-build-'\+b\.id/);
});
test('review run cannot silently deploy production',()=>{
 assert.doesNotMatch(workflow,/wrangler deploy|cloudflare\/workers\/scripts|CLOUDFLARE_API_TOKEN/i);
 assert.match(workflow,/permissions:\s*\n\s*contents: read/);
 assert.match(server,/Review workflow must first be active on the default GitHub branch/);
 assert.match(server,/package-lock\.json/);
});
test('nested repository directory is preserved in pinned build',()=>{
 assert.match(server,/root:g\.dir\|\|''/);
 assert.match(server,/\[item\.root\|\|'',item\.directory\|\|''\]\.filter\(Boolean\)\.join\('\/'\)/);
});
test('application controls require reviewed build',()=>{
 assert.match(client,/Start review build/);
 assert.match(client,/Check review build status/);
 assert.match(client,/Deployment not authorized/);
 assert.match(server,/ownerApprovalRequired:true,deploymentAuthorized:false/);
});
