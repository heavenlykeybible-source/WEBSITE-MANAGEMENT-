import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {encodeCBOR} from '@levischuck/tiny-cbor';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {build}=wranglerRequire('esbuild');
test('member passkeys verify real device signatures and preserve account restrictions',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'community-passkeys-'));
 const sql=new DatabaseSync(':memory:');
 try{
  for(const file of (await readdir('migrations')).filter(f=>f.endsWith('.sql')).sort())sql.exec(await readFile('migrations/'+file,'utf8'));
  sql.exec(await readFile('migrations/0020_passkeys.sql','utf8')); // Safe to apply again during deployment.
  const DB={prepare(query){const q=sql.prepare(query);let values=[];return {bind(...v){values=v;return this},async first(){return q.get(...values)||null},async all(){return {results:q.all(...values)}},async run(){return {meta:{changes:q.run(...values).changes}}}}}};
  const kv=new Map(),env={DB,PASSWORD_PEPPER:'test-pepper',SESSIONS:{async get(k){return kv.get(k)||null},async put(k,v){kv.set(k,v)},async delete(k){kv.delete(k)}}};
  await build({entryPoints:['src/passkeys.ts','src/auth.ts'],outdir:directory,bundle:true,platform:'browser',format:'esm',outExtension:{'.js':'.mjs'},target:'es2022'});
  const {hashPassword,createSession}=await import(pathToFileURL(join(directory,'auth.mjs')));
  const {passkeyRoutes}=await import(pathToFileURL(join(directory,'passkeys.mjs')));
  const password='A long fixture passphrase',pass=await hashPassword(password,env.PASSWORD_PEPPER);
  sql.prepare('INSERT INTO users(user_id,email,password_hash,password_salt) VALUES(1,?,?,?)').run('member@example.org',pass.hash,pass.salt);
  sql.prepare('INSERT INTO users(user_id,email,password_hash,password_salt) VALUES(2,?,?,?)').run('other@example.org',pass.hash,pass.salt);
  const sid=await createSession(env,{userId:1,role:'member',status:'active'}),other=await createSession(env,{userId:2,role:'member',status:'active'});
  const route=passkeyRoutes({json:(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers}),body:r=>r.json(),rate:async()=>true,sourceKey:async()=> 'test'});
  const origin='https://global.example',b64=b=>Buffer.from(b).toString('base64url'),hash=async b=>new Uint8Array(await crypto.subtle.digest('SHA-256',typeof b==='string'?new TextEncoder().encode(b):b)),concat=(...a)=>new Uint8Array(Buffer.concat(a.map(x=>Buffer.from(x))));
  async function call(path,b,cookie='',headers={origin}){return route(new Request(origin+'/api/auth/passkeys'+path,{method:b?'POST':'GET',headers:{...headers,cookie},body:b?JSON.stringify(b):undefined}),env);}
  const sessionCookie='gc_session='+sid;
  await assert.rejects(call('/register/options',{password:'wrong'},sessionCookie),e=>e.status===403);
  await assert.rejects(call('/register/options',{password},sessionCookie,{origin:'https://evil.example'}),e=>e.status===403);
  await assert.rejects(call('/register/options',{password}),e=>e.status===401);
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',keys.publicKey),cred=crypto.getRandomValues(new Uint8Array(32)),id=b64(cred);
  const cose=encodeCBOR(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x,'base64url'))],[-3,new Uint8Array(Buffer.from(jwk.y,'base64url'))]])),rpHash=await hash('global.example');
  const client=(type,challenge,source=origin)=>b64(JSON.stringify({type,challenge,origin:source,crossOrigin:false}));
  const regResponse=await call('/register/options',{password},sessionCookie),flowCookie=regResponse.headers.get('set-cookie').split(';')[0],reg=await regResponse.json();assert.equal(reg.authenticatorSelection.userVerification,'required');
  const authData=concat(rpHash,[0x45],[0,0,0,0],new Uint8Array(16),[0,32],cred,cose),attestation=encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]]));
  const registration={id,rawId:id,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:client('webauthn.create',reg.challenge),attestationObject:b64(attestation),transports:['internal']}};
  assert.equal((await call('/register/verify',{credential:registration,label:'Phone'},sessionCookie+'; '+flowCookie)).status,201);
  await assert.rejects(call('/register/verify',{credential:registration},sessionCookie+'; '+flowCookie));
  assert.equal((await (await call('',null,sessionCookie)).json()).credentials.length,1);
  assert.equal((await (await call('',null,'gc_session='+other)).json()).credentials.length,0);
  function der(signature){const a=new Uint8Array(signature),integer=p=>{let v=Array.from(p);while(v.length>1&&v[0]===0)v.shift();if(v[0]&128)v.unshift(0);return [2,v.length,...v]};const value=[...integer(a.slice(0,32)),...integer(a.slice(32))];return new Uint8Array([48,value.length,...value]);}
  async function assertion(options,counter=1,flags=5,source=origin){const data=concat(rpHash,[flags],[0,0,0,counter]),cd=client('webauthn.get',options.challenge,source),signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,concat(data,await hash(Buffer.from(cd,'base64url'))));return {id,rawId:id,type:'public-key',clientExtensionResults:{},response:{clientDataJSON:cd,authenticatorData:b64(data),signature:b64(der(signature)),userHandle:b64('community:1')}};}
  async function start(){const r=await call('/login/options',{email:'member@example.org'});return {options:await r.json(),cookie:r.headers.get('set-cookie').split(';')[0]};}
  const login=await start(),signed=await assertion(login.options);
  await assert.rejects(call('/login/verify',{credential:signed}));
  const response=await call('/login/verify',{credential:signed},login.cookie);assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/gc_session=/);
  await assert.rejects(call('/login/verify',{credential:signed},login.cookie));
  const uv=await start();await assert.rejects(call('/login/verify',{credential:await assertion(uv.options,2,1)},uv.cookie));
  const wrongOrigin=await start();await assert.rejects(call('/login/verify',{credential:await assertion(wrongOrigin.options,2,5,'https://evil.example')},wrongOrigin.cookie));
  const expired=await start();sql.exec('UPDATE member_passkey_flows SET expires_at=1');await assert.rejects(call('/login/verify',{credential:await assertion(expired.options,2)},expired.cookie));
  const changed=await start();sql.exec("UPDATE users SET password_hash='changed' WHERE user_id=1");await assert.rejects(call('/login/verify',{credential:await assertion(changed.options,2)},changed.cookie));sql.prepare('UPDATE users SET password_hash=? WHERE user_id=1').run(pass.hash);
  const restricted=await start();sql.exec("UPDATE users SET status='restricted' WHERE user_id=1");const restrictedResponse=await call('/login/verify',{credential:await assertion(restricted.options,2)},restricted.cookie);assert.equal(restrictedResponse.status,200);await assert.rejects(call('/register/options',{password},sessionCookie));
  sql.exec("UPDATE users SET status='active' WHERE user_id=1");const blocked=await start();sql.exec("UPDATE users SET status='suspended' WHERE user_id=1");await assert.rejects(call('/login/verify',{credential:await assertion(blocked.options,3)},blocked.cookie));sql.exec("UPDATE users SET status='active' WHERE user_id=1");
  await call('/remove',{id,password},'gc_session='+other);assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_passkeys').get().n,1);
  const removed=await start();await call('/remove',{id,password},sessionCookie);await assert.rejects(call('/login/verify',{credential:await assertion(removed.options,3)},removed.cookie));assert.equal(sql.prepare('SELECT COUNT(*) n FROM member_passkeys').get().n,0);
 }finally{sql.close();await rm(directory,{recursive:true,force:true});}
});
