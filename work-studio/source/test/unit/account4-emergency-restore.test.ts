import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHmac} from 'node:crypto';
const trusted='4e41aad0d0c3e0388449ff3c0c6e5684d2c34b6c';
const sha='0123456789abcdef0123456789abcdef01234567';
const secret='test-only-owner-control-secret';
const file='scripts/verify-account4-restore.mjs';
const exp=Math.floor(Date.now()/1000)+600;
const make=(action:string,account:string,ref:string,seconds=exp)=>{
 const s=String(seconds);
 return s+'.'+createHmac('sha256',secret).update(action+':'+account+':'+ref+':'+s).digest('hex');
};
const run=(account:string,target:string,proof:string)=>{
 return spawnSync(process.execPath,[file,account],{encoding:'utf8',env:{
  ...process.env,TARGET_REF:target,RESTORE_PROOF:proof,APPROVAL_SECRET:secret
 }});
};
describe('emergency restore requires a separate Account 4 owner approval',()=>{
 for(const account of ['1','2','3']){
  it('Account '+account+' requires immutable independent restore authorization before candidate checkout',()=>{
   const text=readFileSync('.github/workflows/emergency-restore-account-'+account+'.yml','utf8');
   expect(text).toContain('ref: '+trusted);
   expect(text).toContain('path: .trusted-owner-restore');
   expect(text).toContain('restore_proof:');
   expect(text).toContain('secrets.HKEM_CONTROL_TOKEN');
   const invocation='run: node .trusted-owner-restore/scripts/verify-account4-restore.mjs '+account;
   expect(text).toContain(invocation);
   expect(text.indexOf(invocation)).toBeLessThan(text.indexOf('ref: ${{ inputs.target_ref }}'));
   expect(text).not.toContain('run: node scripts/verify-account4-restore.mjs');
   expect(run(account,sha,make('hkem-account4-owner-restore-v1',account,sha)).status).toBe(0);
  });
 }
 it('rejects promotion proof accidentally reused for restoration',()=>{
  expect(run('1',sha,make('hkem-account4-owner-approval-v1','1',sha)).status).not.toBe(0);
 });
 it('rejects signed proof for wrong account, SHA or altered action',()=>{
  const proof=make('hkem-account4-owner-restore-v1','1',sha);
  expect(run('2',sha,proof).status).not.toBe(0);
  expect(run('1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',proof).status).not.toBe(0);
  expect(run('1',sha,proof.replace(/.$/,c=>c==='0'?'1':'0')).status).not.toBe(0);
 });
 it('rejects expired, future and malformed proof',()=>{
  expect(run('1',sha,make('hkem-account4-owner-restore-v1','1',sha,Math.floor(Date.now()/1000)-5)).status).not.toBe(0);
  expect(run('1',sha,make('hkem-account4-owner-restore-v1','1',sha,Math.floor(Date.now()/1000)+3700)).status).not.toBe(0);
  expect(run('1','main',make('hkem-account4-owner-restore-v1','1',sha)).status).not.toBe(0);
 });
 it('requires owner password confirmation before dispatching signed restore proof',()=>{
  const text=readFileSync('recovery-control/src/index.ts','utf8');
  expect(text).toContain("!await verifyOwnerPassword(b.ownerPassword,env)");
  expect(text).toContain("'hkem-account4-owner-restore-v1:'");
  expect(text).toContain("const restore_proof=restoreExpiration+'.'+await restoreSignature(env,a,sha,restoreExpiration)");
  expect(text).toContain('restore_proof\n');
  expect(text.indexOf("!await verifyOwnerPassword(b.ownerPassword,env)")).toBeLessThan(text.indexOf('const restore_proof='));
 });
});
