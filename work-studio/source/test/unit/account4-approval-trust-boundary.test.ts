import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const trustedSha='b36dde78ced6a0fe92ba3bdf8cf1d4c348d99b22';
const candidateSha='0123456789abcdef0123456789abcdef01234567';
const secret='unit-test-only-approval-secret';
const verifier='scripts/verify-account4-approval.mjs';

function proofFor(account:string, sha:string, expiry:number) {
 const exp=String(expiry);
 const signature=createHmac('sha256',secret)
  .update('hkem-account4-owner-approval-v1:'+account+':'+sha+':'+exp)
  .digest('hex');
 return exp+'.'+signature;
}
function verify(account:string, sha:string, proof:string) {
 return spawnSync(process.execPath,[verifier,account],{
  env:{...process.env,TARGET_REF:sha,APPROVAL_PROOF:proof,APPROVAL_SECRET:secret},
  encoding:'utf8'
 });
}

describe('production release approval independent of candidate code',()=>{
 for(const [account,workflow] of [
  ['1','.github/workflows/cloudflare-production.yml'],
  ['2','.github/workflows/cloudflare-media-engine.yml'],
  ['3','.github/workflows/cloudflare-global-community.yml']
 ]){
  it('Account '+account+' runs only the immutable policy verifier before promotion',()=>{
   const text=readFileSync(workflow,'utf8');
   expect(text).toContain('ref: '+trustedSha);
   expect(text).toContain('path: .trusted-account4-approval');
   expect(text).toContain('persist-credentials: false');
   const invocation='run: node .trusted-account4-approval/scripts/verify-account4-approval.mjs '+account;
   expect(text).toContain(invocation);
   expect(text).not.toContain('run: node scripts/verify-account4-approval.mjs');
   expect(text.indexOf('path: .trusted-account4-approval')).toBeLessThan(text.indexOf(invocation));
   expect(text.indexOf(invocation)).toBeLessThan(text.indexOf('Promote approved Account '+account+' release'));
  });
 }

 it('accepts a correct short-lived owner signature for the exact account and SHA',()=>{
  const p=proofFor('1',candidateSha,Math.floor(Date.now()/1000)+600);
  expect(verify('1',candidateSha,p).status).toBe(0);
 });
 it('rejects an approval for another account',()=>{
  const p=proofFor('1',candidateSha,Math.floor(Date.now()/1000)+600);
  expect(verify('2',candidateSha,p).status).not.toBe(0);
 });
 it('rejects an approval for another release SHA',()=>{
  const p=proofFor('1',candidateSha,Math.floor(Date.now()/1000)+600);
  expect(verify('1','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',p).status).not.toBe(0);
 });
 it('rejects an expired approval',()=>{
  const p=proofFor('1',candidateSha,Math.floor(Date.now()/1000)-60);
  expect(verify('1',candidateSha,p).status).not.toBe(0);
 });
 it('rejects a forged approval',()=>{
  const exp=Math.floor(Date.now()/1000)+600;
  expect(verify('1',candidateSha,String(exp)+'.'+'0'.repeat(64)).status).not.toBe(0);
 });
 it('rejects malformed release SHA',()=>{
  const p=proofFor('1',candidateSha,Math.floor(Date.now()/1000)+600);
  expect(verify('1','main',p).status).not.toBe(0);
 });
});
