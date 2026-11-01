import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
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
 assert.match(server,/const wanted='Review '\+id/);
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
test('review status never assumes that a completed job has a verified artifact',()=>{
 assert.match(server,/run\.conclusion==='success'/);
 assert.match(server,/a\.name==='review-build-'\+b\.id&&!a\.expired/);
 assert.match(server,/artifactAvailable:false/);
 assert.match(server,/deploymentAuthorized:false/);
});
test('application build queue orders latest requests and filters owner in D1',()=>{
 assert.match(server,/json_extract\(value_json,'\$\.createdBy'\)=\?/);
 assert.match(server,/ORDER BY CAST\(json_extract\(value_json,'\$\.createdAt'\) AS INTEGER\) DESC/);
});
test('build dispatch and source verification reject bundled dependencies',()=>{
 assert.match(server,/Pinned source contains bundled node_modules/);
 assert.match(server,/!tree\.files\.some\(f=>f\.path\.startsWith\(prefix\+'node_modules\/'\)\)/);
 assert.match(server,/lock\.mode!=='120000'/);
});
test('source re-verification checks both lockfile and connected repository root',()=>{
 assert.match(server,/Connected application root changed since build request/);
 assert.match(server,/tree\.files\.find\(f=>f\.path===prefix\+'package-lock\.json'\)/);
});
test('review artifact preserves request provenance',()=>{
 assert.match(workflow,/request_id=%s/);
 assert.match(workflow,/source_sha=%s/);
 assert.match(server,/review\.artifact=\{id:artifact\.id/);
 assert.match(client,/Open verified GitHub Actions run/);
});
test('real candidate picker only accepts locked source applications',()=>{
 const start=server.indexOf('function sourceBuildCandidates(');
 const end=server.indexOf('async function queueConnectedApplication(',start);
 assert.ok(start>=0&&end>start);
 const fn=runInNewContext('('+server.slice(start,end).trim()+')');
 const files=['app/package.json','app/package-lock.json','unlocked/package.json','vendor/package.json','vendor/package-lock.json','nested/pkg/package.json','nested/pkg/package-lock.json','symlink/package.json','huge/package.json'].map(path=>({path}));
 files.push({path:'symlink/package-lock.json',mode:'120000',size:99});
 files.push({path:'huge/package-lock.json',size:6*1024*1024});
 const paths=Array.from(fn(files),item=>item.path);
 assert.deepEqual(paths,['app/package.json','nested/pkg/package.json']);
});
test('real package manifest verifier checks Git blob integrity and build script',async()=>{
 const start=server.indexOf('async function verifyNpmBuildManifest(');
 const end=server.indexOf('async function scanConnectedSource(',start);
 assert.ok(start>0&&end>start);
 const json=JSON.stringify({scripts:{build:'vite build'}});
 let blob=json;
 const sha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+Buffer.byteLength(json)+'\0'),Buffer.from(json)])).digest('hex');
 const ctx={atob,TextEncoder,TextDecoder,Uint8Array,crypto:webcrypto,hex:data=>Buffer.from(data).toString('hex'),fail:message=>{throw Error(message)},gh:async()=>({encoding:'base64',content:Buffer.from(blob).toString('base64')})};
 const verify=runInNewContext('('+server.slice(start,end).trim()+')',ctx);
 const entry={path:'app/package.json',size:json.length,sha};
 assert.equal((await verify({}, {},[entry],'app/')).scripts.build,'vite build');
 blob='{}';
 await assert.rejects(verify({}, {},[entry],'app/'),/integrity check failed/);
 const pnpm=JSON.stringify({scripts:{build:'vite build'},packageManager:'pnpm@9'});
 const pnpmSha=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+Buffer.byteLength(pnpm)+'\0'),Buffer.from(pnpm)])).digest('hex');
 blob=pnpm;
 await assert.rejects(verify({}, {},[{path:'app/package.json',size:pnpm.length,sha:pnpmSha}],'app/'),/supports npm only/);
});
test('application source picker rejects dependency-unspecified npm projects',()=>{
 assert.match(server,/paths\.has\(f\.path\.replace/);
 assert.match(server,/package-lock\.json/);
});
test('review status requires exact run identity and dispatch timestamp',()=>{
 assert.match(server,/run\.display_title===wanted/);
 assert.match(server,/Date\.parse\(run\.created_at\)>=b\.dispatchedAt-120000/);
});
test('application queue updates after register, dispatch, and cancel',()=>{
 const updates=client.match(/refreshBuilds\.click\(\)/g)||[];
 assert.ok(updates.length>=3);
});
test('dispatched review cancellation targets only its owner and exact run',()=>{
 assert.match(server,/if\(item\.createdBy!==user\.id\)fail\('Build request owner mismatch',403\)/);
 assert.match(server,/matching\[0\]/);
 assert.match(server,/run\.display_title==='Review '\+id/);
 assert.match(server,/item\.cancelledReviewAt=Date\.now\(\)/);
 assert.match(server,/\/actions\/runs\/['"]\+encodeURIComponent\(run\.id\)\+['"]\/cancel/);
 assert.match(client,/Cancel dispatched review/);
 assert.match(server,/item\.status=item\.cancellationRequested\?'review-cancellation-requested':'cancelled'/);
 assert.match(server,/item\.deploymentAuthorized=false/);
 assert.match(client,/cancellation requested; awaiting GitHub confirmation/);
});
test('review status exposes API failures and confirmed cancellation only',()=>{
 assert.doesNotMatch(server,/workflow_runs:\[\]\}\)/);
 assert.match(server,/review-closed-after-cancel-request/);
 assert.match(server,/Build request cancelled or cancellation pending/);
});
test('additional GitHub repositories reuse only authorized encrypted connection tokens',()=>{
 assert.match(server,/workspace\/github\/reuse/);
 assert.match(server,/await importSource\(env,user,sourceId\)/);
 assert.match(server,/await ghHead\(env,target\)/);
 assert.match(server,/SELECT secret_enc FROM github_sites WHERE id=\? AND owner_id IS NULL/);
 assert.match(server,/original\.secret_enc\)\.run\(\)/);
 assert.match(client,/Verify and add repository/);
 assert.match(client,/different GitHub account/);
});
test('application controls require reviewed build',()=>{
 assert.match(client,/Start review build/);
 assert.match(client,/Check review build status/);
 assert.match(client,/Deployment not authorized/);
 assert.match(server,/ownerApprovalRequired:true,deploymentAuthorized:false/);
});
