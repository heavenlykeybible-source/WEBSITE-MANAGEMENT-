import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('..',import.meta.url));
test('Simple registration: long passphrases, sign-in, consent and atomic account creation',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'registration-')),db=new DatabaseSync(':memory:');
 try{
 for(const file of readdirSync(path.join(base,'migrations')).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(path.join(base,'migrations',file),'utf8'));
 for(const file of readdirSync(path.join(base,'src')).filter(x=>x.endsWith('.ts'))){
 let source=stripTypeScriptTypes(readFileSync(path.join(base,'src',file),'utf8'));
 source=source.replace(/from (["'])\.\/([a-z-]+)\1/g,(_,q,n)=>'from '+q+'./'+n+'.mjs'+q);
 source=source.replace(/from (["'])\.\.\/public\/([a-z-]+\.js)\1/g,(_,q,n)=>'from '+q+pathToFileURL(path.join(base,'public',n)).href+q);
 writeFileSync(path.join(dir,file.replace(/\.ts$/,'.mjs')),source);}
 const worker=(await import(pathToFileURL(path.join(dir,'index.mjs')).href)).default;
 const entries=new Map();let failAcknowledgement=false;
 const statement=(sql,params=[])=>({sql,params,bind(...p){return statement(sql,p);},async first(){return db.prepare(sql).get(...params)||null;},async all(){return {results:db.prepare(sql).all(...params)};},async run(){const r=db.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};}});
 const env={DB:{prepare:sql=>statement(sql),async batch(items){db.exec('BEGIN');try{const result=[];for(const item of items){if(failAcknowledgement&&item.sql.includes('INSERT INTO account_acknowledgements'))throw new Error('Simulated profile acknowledgement failure');result.push({results:db.prepare(item.sql).all(...item.params),meta:{changes:db.prepare('SELECT changes() n').get().n}});}db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},SESSIONS:{async get(k){return entries.get(k)||null;},async put(k,v){entries.set(k,v);},async delete(k){entries.delete(k);}},PASSWORD_PEPPER:'local-test-only',MEDIA:{}};
 let ip=0;async function request(route,data,cookie){const r=await worker.fetch(new Request('https://example.invalid'+route,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.'+(++ip),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined}),env);return {status:r.status,data:await r.json(),cookie:r.headers.get('Set-Cookie')?.split(';')[0]};}
 const input={email:'simple@example.invalid',fullName:'Test Member',password:'ChristIsMyHope2026',ageConfirmed:true,standardsAccepted:true};
 for(const password of ['Short9','A'.repeat(14),'A'.repeat(129)])assert.equal((await request('/api/auth/register',{...input,password})).status,400);
 assert.equal((await request('/api/auth/register',{...input,ageConfirmed:false})).status,400);
 const created=await request('/api/auth/register',input);assert.equal(created.status,201,JSON.stringify(created));assert.ok(created.cookie?.startsWith('gc_session='));
 const account=db.prepare('SELECT * FROM users WHERE email=?').get(input.email);assert.ok(account.password_hash.startsWith('pbkdf2-sha256$100000$'));assert.notEqual(account.password_hash,input.password);
 const profile=db.prepare('SELECT * FROM profiles WHERE user_id=?').get(account.user_id);assert.equal(profile.display_name,input.fullName);assert.equal(profile.location_visibility,'private');assert.equal(profile.country,null);
 assert.equal((await request('/api/me',null,created.cookie)).status,200);
 assert.equal((await request('/api/auth/register',input)).status,409);
 assert.equal((await request('/api/auth/login',{email:input.email,password:'Wrong passphrase'})).status,401);
 assert.equal((await request('/api/auth/login',{email:input.email,password:input.password})).status,200);
 failAcknowledgement=true;assert.notEqual((await request('/api/auth/register',{...input,email:'rollback@example.invalid'})).status,201);assert.equal(db.prepare('SELECT COUNT(*) n FROM users WHERE email=?').get('rollback@example.invalid').n,0);failAcknowledgement=false;
 const same={...input,email:'parallel@example.invalid'};const pair=await Promise.all([request('/api/auth/register',same),request('/api/auth/register',same)]);assert.deepEqual(pair.map(x=>x.status).sort(),[201,409]);assert.equal(db.prepare('SELECT COUNT(*) n FROM users WHERE email=?').get(same.email).n,1);
 // Administrator approval, existing-session lock enforcement, login for appeal, and unlock.
 const admin=await request('/api/auth/register',{...input,email:'safety-admin@example.invalid'});db.prepare("UPDATE users SET role='administrator' WHERE user_id=?").run(admin.data.userId);
 assert.equal((await request('/api/moderation/accounts/'+account.user_id,{action:'lock',note:'Reviewed repeated violations in context.'},admin.cookie)).status,200);
 assert.equal((await request('/api/posts',{postFormat:'article',title:'Attempt after lock',body:'Christ gives hope.'},created.cookie)).status,403);
 assert.equal((await request('/api/messages',null,created.cookie)).status,403);
 const restricted=await request('/api/auth/login',{email:input.email,password:input.password});assert.equal(restricted.status,200);
 assert.equal((await request('/api/me',null,restricted.cookie)).data.user.status,'restricted');
 const safety=await request('/api/me/safety',null,restricted.cookie);assert.equal(safety.status,200);assert.equal(safety.data.restrictions[0].status,'active');
 assert.equal((await request('/api/me/requests',{kind:'safety',details:'Please review the reason for my account lock.'},restricted.cookie)).status,201);
 assert.equal((await request('/api/moderation/accounts/'+account.user_id,{action:'unlock',note:'Reviewed member request and restored access.'},admin.cookie)).status,200);
 assert.equal((await request('/api/me',null,restricted.cookie)).data.user.status,'active');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
