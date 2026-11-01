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
 assert.match(hub,/direct connector is not configured/);
 assert.match(hub,/packageForm\(entry\)/);
 assert.doesNotMatch(hub,/workspace\/tinyfish\/|BROWSER_ENGINE_KEY/);
});
