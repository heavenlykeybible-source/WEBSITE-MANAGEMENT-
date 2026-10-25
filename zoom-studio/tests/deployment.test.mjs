import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const target='6401a8f41a41f5325ba5bd4d006b4ff5';
const database='11111111-1111-4111-8111-111111111111';
function configure(extra={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'meeting-deploy-'));
  try {
    fs.mkdirSync(path.join(dir,'scripts'));
    fs.copyFileSync(new URL('../scripts/configure.mjs',import.meta.url),path.join(dir,'scripts/configure.mjs'));
    const env={...process.env,STUDIO_D1_DATABASE_ID:database};
    delete env.CLOUDFLARE_ACCOUNT_ID; delete env.CF_ACCOUNT_ID;
    const result=spawnSync(process.execPath,[path.join(dir,'scripts/configure.mjs')],{env:{...env,...extra},encoding:'utf8'});
    const file=path.join(dir,'wrangler.generated.json');
    return {...result,config:fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null};
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('meeting deployment always pins Account 7 and its separate resources',()=>{
  const r=configure();assert.equal(r.status,0);assert.equal(r.config.account_id,target);
  assert.equal(r.config.name,'heavenly-key-zoom-studio');
  assert.equal(r.config.d1_databases[0].binding,'TEAMDB');
  assert.equal(r.config.d1_databases[0].database_id,database);
});
test('conflicting account variables stop deployment before writing configuration',()=>{
  for(const key of ['CLOUDFLARE_ACCOUNT_ID','CF_ACCOUNT_ID']) {
    const r=configure({[key]:'c324d871146f8fcc5e7dcd3da057011c'});
    assert.notEqual(r.status,0);assert.equal(r.config,null);assert.match(r.stderr,/belongs to Account 7/);
  }
  assert.equal(configure({CLOUDFLARE_ACCOUNT_ID:target,CF_ACCOUNT_ID:target}).status,0);
});
test('missing database stops deployment without creating a configuration',()=>{
  const r=configure({STUDIO_D1_DATABASE_ID:''});assert.notEqual(r.status,0);assert.equal(r.config,null);
});

test('Account 8 requires an explicit Cloudflare account ID',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8'});
 assert.notEqual(r.status,0);assert.equal(r.config,null);
 assert.match(r.stderr,/requires a valid Cloudflare account ID/);
});
test('Account 8 selects its own Worker and D1 without overwriting Account 7',()=>{
 const id='0123456789abcdef0123456789abcdef';
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8',MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:id,MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1'});
 assert.equal(r.status,0);
 assert.equal(r.config.account_id,id);
 assert.equal(r.config.name,'heavenly-key-meetingspace');
 assert.equal(r.config.d1_databases[0].database_name,'heavenly-key-meetingspace-db');
});
test('Account 8 rejects a conflicting Cloudflare account environment',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8',MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:'0123456789abcdef0123456789abcdef',MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1',CF_ACCOUNT_ID:target});
 assert.notEqual(r.status,0);assert.equal(r.config,null);
});

test('Account 8 requires explicit confirmation of its D1 database',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8',MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:'0123456789abcdef0123456789abcdef'});
 assert.notEqual(r.status,0);assert.equal(r.config,null);
 assert.match(r.stderr,/Confirm the Account 8 D1 database/);
});
test('Account 8 cannot reuse the Account 7 Cloudflare identity',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8',MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:target,MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1'});
 assert.notEqual(r.status,0);assert.equal(r.config,null);
 assert.match(r.stderr,/cannot reuse the legacy Account 7/);
});
test('malformed D1 IDs are rejected before configuration is generated',()=>{
 for(const id of ['11111111-1111-1111-1111-11111111111Z','------------------------------------']) {
  const r=configure({STUDIO_D1_DATABASE_ID:id});
  assert.notEqual(r.status,0);assert.equal(r.config,null);
 }
});
