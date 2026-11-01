import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync('workspace/imports.js','utf8');
const client=fs.readFileSync('workspace/client.js','utf8');
const deploy=fs.readFileSync('scripts/deploy-account4-existing.mjs','utf8');
const workflow=fs.readFileSync('.github/workflows/deploy.yml','utf8');
test('Worker edit proposals use authenticated owner and review rather than direct deployment',()=>{
 assert.match(server,/user\.role!=='owner'/);
 assert.match(server,/workspace\/workers\/propose-edit/);
 assert.match(server,/protectWorker\(env,name\)/);
 assert.match(server,/const actor=\{kind:'owner',user,ow:null,agentId:await userAgentId\(env,user\)\}/);
 assert.match(server,/coreProposeWorker\(env,actor/);
 assert.match(client,/Submit Worker edit for approval/);
 assert.doesNotMatch(server.slice(server.indexOf("if(sub==='workspace/workers/propose-edit'"),server.indexOf("if(sub==='workspace/workers'")),/deployWorker\(/);
});
test('Account 4 deploy blocks stale and older releases',()=>{
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/Block stale branches and unapproved commits/);
 assert.match(workflow,/Block superseded releases/);
 assert.match(deploy,/verifyForwardRelease\(/);
 assert.match(deploy,/merge-base/);
 assert.match(deploy,/ACCOUNT4_DEPLOY_COMMIT_SHA/);
 assert.match(deploy,/signature\(bindings\) !== signature\(after\.bindings \|\| \[\]\)/);
});
