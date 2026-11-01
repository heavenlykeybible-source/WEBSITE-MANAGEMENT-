import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const hub=fs.readFileSync('workspace/universal-import-client.js','utf8');
const old=fs.readFileSync('workspace/client.js','utf8');
const build=fs.readFileSync('cms/build.mjs','utf8');
test('only unified import page is invoked from the standard navigation',()=>{
 assert.match(old,/async function nativeImports\(\)\{return universalImportHub\(\);\}/);
 assert.match(build,/workspace\/universal-import-client\.js/);
 assert.match(hub,/show\(nav\(\),mount\)/);
});
test('import wizard provides app-first GitHub discovery and safe destination selection',()=>{
 for(const item of ['Bible App / Daily Manna','Global Christian Community','Heavenly Key websites','workspace/github/discover','workspace/github/reuse','workspace/candidates','workspace/scan','workspace/stage','workspace/application-build'])assert.ok(hub.includes(item),item);
 assert.match(hub,/listing\.commit!==scan\.commit/);
 assert.match(hub,/owner approval/i);
 assert.match(hub,/sandbox:'allow-scripts allow-forms'/);
});
test('device and Drive imports preserve complete ZIP upload flow',()=>{
 assert.match(hub,/Phone or computer/);
 assert.match(hub,/Google Drive/);
 assert.match(hub,/existing Google Drive file ID field/);
 assert.match(hub,/packageForm\(entry\)/);
 assert.doesNotMatch(hub,/workspace\/tinyfish\/|BROWSER_ENGINE_KEY/);
});

test('central connection supports GitHub user tokens and installation tokens without exposing secrets',()=>{
 const server=fs.readFileSync('workspace/imports.js','utf8');
 assert.match(server,/api\.github\.com\/user\/repos\?per_page=50/);
 assert.match(server,/api\.github\.com\/installation\/repositories\?per_page=50/);
 assert.match(server,/connectionMode:mode,readOnly:true/);
 assert.match(server,/await unseal\(env,g\.secret_enc\)/);
});
test('Account 3 source and advanced management are distinguishable in unified importer',()=>{
 assert.match(hub,/Global Christian Community/);
 assert.match(hub,/Complete Community source/);
 assert.match(hub,/Account 3 production source/);
 assert.match(hub,/Advanced DNS, Worker and GitHub tools/);
 assert.match(hub,/scanButton\.disabled=chosen\.kind==='application'/);
});

test('universal Account 4 GitHub reauthorization is independent of app destinations',()=>{
 const server=fs.readFileSync('workspace/imports.js','utf8');
 assert.match(server,/workspace\/github\/central-connect/);
 assert.match(server,/await seal\(env,token\)/);
 assert.match(server,/UPDATE github_sites SET label=\?,secret_enc=\?/);
 assert.match(server,/connectionMode:mode,authenticated:true/);
 assert.match(hub,/Authorize \/ reauthorize universal GitHub account/);
 assert.match(hub,/belongs to Account 4, not Account 3 or a website/);
 assert.match(hub,/all repositories and organizations permitted by the token/);
 assert.doesNotMatch(hub,/api\('github','POST'/);
});
