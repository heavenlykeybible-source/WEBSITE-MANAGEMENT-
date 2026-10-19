import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const command=()=>spawnSync(process.execPath,['scripts/protected-state-gate.mjs'],{encoding:'utf8'});
test('unchanged protected authentication, CMS, media and SQL baseline passes',()=>{
 const r=command();assert.equal(r.status,0,r.stderr);
});
test('a changed live storage binding blocks the release and leaves source restored',()=>{
 const file='media-engine/wrangler.toml',original=readFileSync(file);
 try{
  writeFileSync(file,Buffer.concat([original,Buffer.from('\n# deliberate regression probe\n')]));
  const r=command();
  assert.notEqual(r.status,0,'Changing the protected production config must fail closed');
  assert.match(r.stderr,/Protected file changed: media-engine\/wrangler.toml/);
 }finally{writeFileSync(file,original);}
});
test('new production SQL is rejected before it can run',()=>{
 const file='media-engine/migrations/9999_unapproved_regression_probe.sql';
 try{
  writeFileSync(file,'-- Never execute. Protected-state test only.\n');
  const r=command();
  assert.notEqual(r.status,0,'An unapproved migration must block a code-only release');
  assert.match(r.stderr,/New production SQL blocked/);
 }finally{unlinkSync(file);}
});

test('unapproved new deployment workflow is blocked',()=>{
 const file='.github/workflows/9999-unapproved-deployment-test.yml';
 try{
  writeFileSync(file,'name: Forbidden probe only\\n');
  const r=command();
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/Unapproved new GitHub Actions workflow/);
 }finally{unlinkSync(file);}
});
test('routine Account 1–4 production workflows never recreate production data or rotate passwords',()=>{
 for(const file of [
  '.github/workflows/cloudflare-production.yml',
  '.github/workflows/cloudflare-media-engine.yml',
  '.github/workflows/cloudflare-global-community.yml',
  '.github/workflows/cloudflare-recovery-control.yml'
 ]){
  const body=readFileSync(file,'utf8');
  const executable=body.split('\n').filter(line=>!line.trimStart().startsWith('#')).join('\n');
  assert.equal(/d1 migrations apply|d1 create|kv namespace create|r2 bucket create|secret put/.test(executable),false,
   'Protected releases cannot mutate storage: '+file);
  assert.ok(body.includes('protected-state-gate.mjs'),
   'Each release must run protected-state safeguards: '+file);
 }
});
