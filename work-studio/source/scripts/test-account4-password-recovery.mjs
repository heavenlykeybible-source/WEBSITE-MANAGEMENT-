import test from 'node:test';
import assert from 'node:assert/strict';
const {forgotPage,resetPage,sendReset,completeReset}=await import('file:///tmp/hkem-account4-password-recovery.mjs');
const origin='https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev';
function env(){
  const db=new Map(),kv=new Map(),mail=[];
  const e={
    DB:{prepare(sql){return {bind(...args){return {
      async first(){if(!sql.startsWith('SELECT value'))throw Error('Unexpected select '+sql);const value=db.get(args[0]);return value===undefined?null:{value}},
      async run(){
        if(sql.startsWith('INSERT INTO account4_security_state')){db.set(args[0],args[1]);return {meta:{changes:1}};}
        if(sql.startsWith('DELETE FROM account4_security_state')){const ok=db.get(args[0])===args[1];if(ok)db.delete(args[0]);return {meta:{changes:ok?1:0}};}
        throw Error('Unexpected query '+sql);
      }
    }}}}},
    RECOVERY_STATE:{async get(k){return kv.get(k)||null},async put(k,v){kv.set(k,v)},async delete(k){kv.delete(k)}},
    GITHUB_CONTROL_TOKEN:'test-only-control-secret-for-password-hmac-2026',
    RESET_EMAIL_FROM:'security@verified-example.org',
    RESET_EMAIL:{async send(m){mail.push(m);return {messageId:'test-message'}}}
  };
  return {e,db,kv,mail};
}
const req=(url,method='GET',body)=>new Request(origin+url,{method,headers:method==='POST'?{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'}:{},body});
test('forgot-password mobile page is HTML and does not contain a secret',async()=>{
  const r=forgotPage(),html=await r.text();
  assert.equal(r.status,200);assert.match(html,/name="viewport"/);assert.match(html,/Reset your password/);
  assert.doesNotMatch(html,/token=[0-9a-f]{64}/);
});
test('email reset is restricted to configured admin inbox and stores only token hash',async()=>{
  const {e,db,mail}=env();
  const r=await sendReset(req('/forgot-password','POST',''),e);
  assert.equal(r.status,200);assert.equal(mail.length,1);
  assert.equal(mail[0].to,'emmanuel2026miracle@gmail.com');
  const link=mail[0].text.match(/https:\/\/\S+token=([0-9a-f]{64})/);
  assert.ok(link,'one-time reset link must be present in the email');
  assert.ok(!JSON.stringify([...db]).includes(link[1]),'database must not store reset token');
  const form=await resetPage(new Request(link[0])).text();assert.match(form,/Choose new password/);
});
test('password reset is single-use, rotates password hash, and blocks reuse',async()=>{
  const {e,db,mail}=env();
  await sendReset(req('/forgot-password','POST',''),e);
  const token=mail[0].text.match(/token=([0-9a-f]{64})/)[1];
  const password='MyLongTestPassword-2026';
  const data=new URLSearchParams({token,password,confirm:password});
  const first=await completeReset(req('/reset-password','POST',data),e);
  assert.equal(first.status,200);
  assert.match(db.get('hkem-control-password-v2'),/^hmac-v3\$/);
  assert.ok(!db.has('hkem-control-password-reset-v1'));
  const second=await completeReset(req('/reset-password','POST',data),e);
  assert.equal(second.status,400);
});
test('rejects expired tokens, mismatched passwords and absent email binding',async()=>{
  const {e,db,mail}=env();
  await sendReset(req('/forgot-password','POST',''),e);
  const token=mail[0].text.match(/token=([0-9a-f]{64})/)[1];
  assert.equal((await completeReset(req('/reset-password','POST',new URLSearchParams({token,password:'MyLongTestPassword-2026',confirm:'not-matching'})),e)).status,400);
  const item=JSON.parse(db.get('hkem-control-password-reset-v1'));item.expiresAt=1;db.set('hkem-control-password-reset-v1',JSON.stringify(item));
  assert.equal((await completeReset(req('/reset-password','POST',new URLSearchParams({token,password:'MyLongTestPassword-2026',confirm:'MyLongTestPassword-2026'})),e)).status,400);
  const noEmail={...e,RESET_EMAIL:undefined};
  assert.equal((await sendReset(req('/forgot-password','POST',''),noEmail)).status,503);
});
