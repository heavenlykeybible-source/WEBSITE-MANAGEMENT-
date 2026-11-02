import test from 'node:test';
import assert from 'node:assert/strict';
import {planCompleteProject} from '../project-import/complete-project-preflight.mjs';
test('Account 3 style monorepo is a complete app, not a single worker',()=>{
 const plan=planCompleteProject({
  projectRoot:'apps/global-christian-community',
  files:['apps/global-christian-community/package.json','apps/global-christian-community/public/app.js','apps/global-christian-community/src/index.ts','apps/global-christian-community/migrations/0001.sql','apps/global-christian-community/wrangler.toml'],
  packageJson:{scripts:{build:'npm run check',deploy:'wrangler deploy'}},
  wranglerConfig:{name:'global-community'}
 });
 assert.equal(plan.kind,'application');
 assert.equal(plan.requiresCompleteBundle,true);
 assert.equal(plan.requiresMigrationApproval,true);
 assert.equal(plan.safeToDeploy,false);
});
test('rejects traversal and missing manifest inspection',()=>{
 assert.throws(()=>planCompleteProject({files:['../secret']}));
 assert.throws(()=>planCompleteProject({files:['package.json']}));
});
