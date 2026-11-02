import test from 'node:test';
import assert from 'node:assert/strict';
import {createGithubReleaseChannel} from '../project-import/github-release-channel.mjs';
const revision='a'.repeat(40);
const files=['package.json','package-lock.json','wrangler.toml','public/index.html'].map(path=>({path,sha:'b'.repeat(40),size:100}));
function setup(complete=true){let proposals=0;const channel=createGithubReleaseChannel({authorize:async()=>true,listGithubSites:async()=>[{id:1,repo:'owner/project',branch:'main',dir:''}],listGithubFiles:async()=>complete?files:files.slice(0,2),readGithubFile:async()=>({content:'{}',sha:'c'.repeat(40)}),enqueueWaiting:async p=>{assert.equal(p.deploymentAuthorized,false);proposals++;return {id:'review-1'}},audit:async()=>{}});return {channel,count:()=>proposals};}
test('GitHub channel proposes complete application without deploying',async()=>{const t=setup();const r=await t.channel.propose({actor:'owner',siteId:1,revision});assert.equal(r.status,'pending');assert.equal(t.count(),1)});
test('Incomplete GitHub project blocked',async()=>{const t=setup(false);await assert.rejects(t.channel.propose({actor:'owner',siteId:1,revision}));assert.equal(t.count(),0)});
