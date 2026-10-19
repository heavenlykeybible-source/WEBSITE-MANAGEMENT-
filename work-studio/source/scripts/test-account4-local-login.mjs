import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const {login,authenticated,logout,changePassword}=await import('file:///tmp/hkem-account4-local-auth.mjs');
function env(){
 const map=new Map(),security=new Map();
 return {
  DB:{prepare(sql){return {bind(key,value){return {
   async first(){return security.has(key)?{value:security.get(key)}:null},
   async run(){security.set(key,value);return {meta:{changes:1}}}
  }}}}},
  GITHUB_CONTROL_TOKEN:'test-only-very-long-signing-secret-'+('x'.repeat(42)),
  CONTROL_PASSWORD_HASH:createHash('sha256').update('TestPassword!the-secure-one').digest('hex'),
  RECOVERY_STATE:{
   async get(k){return map.get(k)||null},
   async put(k,v){map.set(k,v)},
   async delete(k){map.delete(k)}
  }
 };
}
const url='https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev/api/login';
const req=(username,password,origin=new URL(url).origin)=>new Request(url,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({username,password})
});
test('normal password login sets secure signed session, no Cloudflare Access required',async()=>{
 const e=env();
 assert.equal(await authenticated(new Request(url),e),false);
 const wrong=await login(req('admin','wrong!'),e);
 assert.equal(wrong.status,401);
 const valid=await login(req('admin','TestPassword!the-secure-one'),e);
 assert.equal(valid.status,200);
 const cookie=valid.headers.get('Set-Cookie');
 assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);
 const loggedIn=new Request(url,{headers:{Cookie:cookie.split(';')[0]}});
 assert.equal(await authenticated(loggedIn,e),true);
 const loggedOut=logout();
 assert.match(loggedOut.headers.get('Set-Cookie'),/Max-Age=0/);
});
test('reject cross-origin login and rate limit brute-force',async()=>{
 const e=env();
 assert.equal((await login(req('admin','TestPassword!the-secure-one','https://attacker.invalid'),e)).status,403);
 for(let i=0;i<5;i++)assert.equal((await login(req('admin','bad'+i),e)).status,401);
 assert.equal((await login(req('admin','TestPassword!the-secure-one'),e)).status,429);
});
test('session cookies are not forgeable',async()=>{
 const e=env();
 const attempt=new Request(url,{headers:{Cookie:'hk_control_session='+encodeURIComponent('9999999999:12345678-1234-4123-8123-123456789abc~'+'a'.repeat(64))}});
 assert.equal(await authenticated(attempt,e),false);
});

test('admin can rotate dashboard password without resetting the website admin account or losing it on redeploy',async()=>{
 const e=env();
 const first=await login(req('admin','TestPassword!the-secure-one'),e);
 const cookie=first.headers.get('Set-Cookie')?.split(';')[0];
 const newPassword='SafelyRotated-Owner-Secret-12345';
 const changeRequest=new Request(url.replace('/api/login','/api/password/change'),{
  method:'POST',headers:{Origin:new URL(url).origin,'Content-Type':'application/json',Cookie:cookie},
  body:JSON.stringify({currentPassword:'TestPassword!the-secure-one',newPassword})
 });
 const changed=await changePassword(changeRequest,e);assert.equal(changed.status,200);
 assert.match(changed.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal(await authenticated(new Request(url,{headers:{Cookie:cookie}}),e),false,'Older sessions must be revoked');
 const old=await login(req('admin','TestPassword!the-secure-one'),e);assert.equal(old.status,401);
 const newer=await login(req('admin',newPassword),e);assert.equal(newer.status,200);
 // The legacy Cloudflare secret remains unchanged, but persistent D1 override wins.
 assert.equal(e.CONTROL_PASSWORD_HASH,createHash('sha256').update('TestPassword!the-secure-one').digest('hex'));
});

test('native password-manager-friendly form redirects on successful login without exposing secrets',async()=>{
 const e=env(),origin=new URL(url).origin;
 const body=new URLSearchParams({username:'admin',password:'TestPassword!the-secure-one'});
 const request=new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body});
 const result=await login(request,e);
 assert.equal(result.status,303);
 assert.equal(result.headers.get('Location'),'/');
 assert.match(result.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Strict/);
 const invalid=new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:'wrong-credential'})});
 const rejected=await login(invalid,e);
 assert.equal(rejected.status,401);
 assert.match(rejected.headers.get('Content-Type'),/text\/html/);
 assert.match(await rejected.text(),/Incorrect username or password/);
});

test('iPhone/Safari same-origin form login accepts missing Origin only with browser evidence',async()=>{
 const e=env();
 const data=new URLSearchParams({username:'admin',password:'TestPassword!the-secure-one'});
 const form=(headers)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...headers},body:data});
 const safari=await login(form({'Sec-Fetch-Site':'same-origin'}),e);
 assert.equal(safari.status,303,'Same-site mobile form must sign in');
 const legacy=await login(form({Referer:new URL(url).origin+'/'}),e);
 assert.equal(legacy.status,303,'Legacy browser with same-origin Referer must sign in');
 const noProof=await login(form({}),e);
 assert.equal(noProof.status,403,'Missing Origin with no same-origin evidence must not bypass protection');
 const forged=await login(form({'Sec-Fetch-Site':'cross-site',Referer:new URL(url).origin+'/'}),e);
 assert.equal(forged.status,403,'Cross-site browser metadata must be blocked');
 const crossOrigin=await login(form({Origin:'https://foreign.example','Sec-Fetch-Site':'same-origin'}),e);
 assert.equal(crossOrigin.status,403,'Explicit cross-origin form must remain blocked');
 const jsonWithoutOrigin=await login(new Request(url,{method:'POST',headers:{'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'},body:JSON.stringify({username:'admin',password:'TestPassword!the-secure-one'})}),e);
 assert.equal(jsonWithoutOrigin.status,403,'JSON API must retain mandatory Origin');
});
