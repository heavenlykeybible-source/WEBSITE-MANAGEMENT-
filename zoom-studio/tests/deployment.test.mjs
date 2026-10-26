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
    delete env.MEETINGSPACE_TARGET_ACCOUNT; delete env.MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID;
    delete env.MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED;
    delete env.CLOUDFLARE_ACCOUNT_ID; delete env.CF_ACCOUNT_ID;
    const result=spawnSync(process.execPath,[path.join(dir,'scripts/configure.mjs')],{env:{...env,...extra},encoding:'utf8'});
    const file=path.join(dir,'wrangler.generated.json');
    return {...result,config:fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null};
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
}
test('Account 8 is the default target and requires explicit credentials',()=>{
 const r=configure();assert.notEqual(r.status,0);assert.equal(r.config,null);
 assert.match(r.stderr,/requires a valid Cloudflare account ID/);
});
test('Account 7 Radio cannot be targeted by MeetingSpace',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'7'});
 assert.notEqual(r.status,0);assert.equal(r.config,null);
 assert.match(r.stderr,/Account 7 is Heavenly Key Radio/);
});
test('conflicting account variables prevent Account 8 deployment',()=>{
 for(const key of ['CLOUDFLARE_ACCOUNT_ID','CF_ACCOUNT_ID']) {
  const r=configure({MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:'0123456789abcdef0123456789abcdef',MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1',[key]:target});
  assert.notEqual(r.status,0);assert.equal(r.config,null);
  assert.match(r.stderr,/conflicts with Account 8/);
 }
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
 assert.equal(r.config.main,'build/meeting-worker.mjs');
 assert.equal(r.config.durable_objects.bindings[0].name,'MEETING_ROOMS');
 assert.equal(r.config.migrations[0].new_sqlite_classes[0],'MeetingRooms');
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
test('Account 8 requires deliberate approval to share its Cloudflare tenant',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8',MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:target,MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1'});
 assert.notEqual(r.status,0);assert.equal(r.config,null);
 assert.match(r.stderr,/Shared Cloudflare account detected/);
});
test('malformed D1 IDs are rejected before configuration is generated',()=>{
 for(const id of ['11111111-1111-1111-1111-11111111111Z','------------------------------------']) {
  const r=configure({STUDIO_D1_DATABASE_ID:id});
  assert.notEqual(r.status,0);assert.equal(r.config,null);
 }
});

test('same Cloudflare tenant supports isolated Account 8 only with explicit authorization',()=>{
 const r=configure({MEETINGSPACE_TARGET_ACCOUNT:'8',MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:target,MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT:'1',MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1'});
 assert.equal(r.status,0);
 assert.equal(r.config.account_id,target);
 assert.equal(r.config.name,'heavenly-key-meetingspace');
 assert.equal(r.config.d1_databases[0].database_id,database);
});
test('same tenant cannot reuse legacy shared database IDs',()=>{
 for(const legacyDb of ['9549fc74-f6a8-4cf8-a066-7cb965c59b91','c0fe5ca1-cb39-4fbb-bad0-e6b2fa8c825a']){
 const r=configure({MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:target,MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT:'1',STUDIO_D1_DATABASE_ID:legacyDb,MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1'});
 assert.notEqual(r.status,0);
 assert.match(r.stderr,/requires a dedicated D1 database/);
 }
});

test('Account 8 deploy verifies MeetingSpace health endpoint rather than just a homepage',()=>{
 const deploy=readFileSync(resolve(root,'scripts/deploy.mjs'),'utf8');
 assert.match(deploy,/RELEASE_HEALTH_PATH:'\/api\/health'/);
 assert.match(deploy,/RELEASE_HEALTH_EXPECT:JSON\.stringify\(\{ok:true,meetingConfigured:true\}\)/);
});
