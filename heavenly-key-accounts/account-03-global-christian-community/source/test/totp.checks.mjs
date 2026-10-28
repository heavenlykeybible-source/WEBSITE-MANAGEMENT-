import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync} from 'node:fs';

test('TOTP matches published RFC 6238 SHA-1 vectors and base32 round trips',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'totp-'));
 try{
  const target=join(dir,'totp.mjs');writeFileSync(target,stripTypeScriptTypes(readFileSync(new URL('../src/totp.ts',import.meta.url),'utf8')));
  const {totpAt,encodeBase32,decodeBase32,matchTotp,sealTotp,openTotp,generateRecoveryCodes,recoveryCodeHash}=await import(pathToFileURL(target).href),secret=new TextEncoder().encode('12345678901234567890');
  for(const [seconds,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']])assert.equal(await totpAt(secret,seconds*1000,8),expected);
  assert.deepEqual(decodeBase32(encodeBase32(secret)),secret);assert.throws(()=>decodeBase32('BAD!'));assert.throws(()=>decodeBase32('A'));
  const code=await totpAt(secret,60000);assert.equal(await matchTotp(secret,code,60000,0),2);assert.equal(await matchTotp(secret,code,60000,2),null);assert.equal(await matchTotp(secret,'xxxxxx',60000,0),null);
  const key='test-only-secret-at-least-32-characters',sealed=await sealTotp(secret,key,1);assert(!sealed.includes('12345678901234567890'));assert.deepEqual(await openTotp(sealed,key,1),secret);await assert.rejects(openTotp(sealed,key,2));await assert.rejects(openTotp(sealed,key+'other',1));
  const codes=generateRecoveryCodes();assert.equal(new Set(codes).size,8);assert(codes.every(c=>/^[a-f0-9]{32}$/.test(c)));const hash=await recoveryCodeHash(codes[0],1);assert.match(hash,/^[a-f0-9]{64}$/);assert.notEqual(hash,await recoveryCodeHash(codes[0],2));await assert.rejects(recoveryCodeHash('bad',1));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('authenticator enrollment encrypts secrets and consumes recovery codes once',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'authenticator-')),db=new DatabaseSync(':memory:');
 try{
  const migrations=new URL('../migrations/',import.meta.url);for(const file of readdirSync(migrations).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL(file,migrations),'utf8'));
  db.prepare("INSERT INTO users(user_id,email,password_hash,password_salt) VALUES(1,'member@example.invalid','unused','unused')").run();
  for(const name of ['totp','account-authenticator']){let source=stripTypeScriptTypes(readFileSync(new URL('../src/'+name+'.ts',import.meta.url),'utf8'));source=source.replace(/from "\.\/totp"/g,'from "./totp.mjs"');writeFileSync(join(dir,name+'.mjs'),source);}
  const T=await import(pathToFileURL(join(dir,'totp.mjs')).href),A=await import(pathToFileURL(join(dir,'account-authenticator.mjs')).href);
  const statement=(sql,params=[])=>({sql,params,bind(...v){return statement(sql,v)},async first(){return db.prepare(sql).get(...params)||null},async run(){return {meta:{changes:Number(db.prepare(sql).run(...params).changes)}}}});
  const env={SESSION_SECRET:'test-only-secret-at-least-32-characters',DB:{prepare:sql=>statement(sql),async batch(items){db.exec('BEGIN');try{const results=items.map(item=>{db.prepare(item.sql).run(...item.params);return {meta:{changes:Number(db.prepare('SELECT changes() n').get().n)}}});db.exec('COMMIT');return results}catch(e){db.exec('ROLLBACK');throw e}}}};
  const setup=await A.beginSetup(env,1,'member@example.invalid');assert.equal(setup.recoveryCodes.length,8);assert.equal(await A.isEnabled(env,1),false);assert(!JSON.stringify(db.prepare('SELECT * FROM account_authenticators').get()).includes(setup.secret));
  assert.notEqual(db.prepare('SELECT code_hash FROM authenticator_recovery_codes').get().code_hash,setup.recoveryCodes[0]);
  const code=await T.totpAt(T.decodeBase32(setup.secret),Date.now());await A.confirmSetup(env,1,setup.setupId,code);assert.equal(await A.isEnabled(env,1),true);assert.equal(db.prepare('SELECT session_version FROM users').get().session_version,1);
  assert.equal(await A.verifySecondFactor(env,1,code),false);assert.equal(await A.verifySecondFactor(env,1,setup.recoveryCodes[0]),true);assert.equal(await A.verifySecondFactor(env,1,setup.recoveryCodes[0]),false);
  await assert.rejects(A.beginSetup(env,1,'member@example.invalid'),/already enabled/);
  db.prepare("INSERT INTO users(user_id,email,password_hash,password_salt) VALUES(2,'another@example.invalid','unused','unused')").run();
  const expired=await A.beginSetup(env,2,'another@example.invalid');db.prepare('UPDATE account_authenticators SET expires_at=? WHERE user_id=2').run(Date.now()-1);
  await assert.rejects(A.confirmSetup(env,2,expired.setupId,await T.totpAt(T.decodeBase32(expired.secret),Date.now())),/expired/);assert.equal(await A.isEnabled(env,2),false);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
