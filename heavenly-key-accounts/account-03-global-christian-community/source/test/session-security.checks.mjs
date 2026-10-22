import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const base=new URL('../',import.meta.url);
const dir=mkdtempSync(join(tmpdir(),'community-session-security-'));
writeFileSync(join(dir,'auth.mjs'),stripTypeScriptTypes(readFileSync(new URL('src/auth.ts',base),'utf8')));
const auth=await import(pathToFileURL(join(dir,'auth.mjs')).href);
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
function fixture(){
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(new URL('migrations/',base)).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(new URL('migrations/'+file,base),'utf8'));
 db.prepare("INSERT INTO users(user_id,email,password_hash,password_salt) VALUES(1,'session@example.invalid','unused','unused')").run();
 const kv=new Map(),env={DB:{prepare(sql){return{bind(...args){const stmt=db.prepare(sql);return{first:async()=>stmt.get(...args)||null,run:async()=>stmt.run(...args)}}}}},SESSIONS:{get:async k=>kv.get(k)||null,put:async(k,v)=>kv.set(k,v),delete:async k=>kv.delete(k)}};
 const user={userId:1,role:'member',status:'active'};
 const request=id=>new Request('https://community.example.invalid/api/me',{headers:{Cookie:'gc_session='+id}});
 return{db,env,kv,user,request};
}
test('logout rejects a stale KV session and stores only its digest',async()=>{
 const f=fixture();try{const id=await auth.createSession(f.env,f.user),raw=f.kv.get('session:'+id),req=f.request(id);
 assert.equal((await auth.getSession(req,f.env)).userId,1);
 await auth.destroySession(req,f.env);f.kv.set('session:'+id,raw);
 assert.equal(await auth.getSession(req,f.env),null);
 const row=f.db.prepare('SELECT * FROM revoked_sessions').get();assert.match(row.token_hash,/^[a-f0-9]{64}$/);assert.notEqual(row.token_hash,id);
 await auth.destroySession(req,f.env);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM revoked_sessions').get().n,1);
 }finally{f.db.close();}
});
test('logout remains revoked when KV deletion fails',async()=>{
 const f=fixture();try{const id=await auth.createSession(f.env,f.user),req=f.request(id);f.env.SESSIONS.delete=async()=>{throw Error('KV unavailable');};
 await assert.rejects(auth.destroySession(req,f.env));assert.equal(await auth.getSession(req,f.env),null);
 }finally{f.db.close();}
});
test('roles and account restrictions are checked against the current database',async()=>{
 const f=fixture();try{const id=await auth.createSession(f.env,{...f.user,role:'owner'}),req=f.request(id);
 assert.equal(await auth.requireRole(req,f.env,'moderator'),null);
 f.db.prepare("UPDATE users SET role='administrator' WHERE user_id=1").run();assert.equal((await auth.requireRole(req,f.env,'administrator')).role,'administrator');
 f.db.prepare("UPDATE users SET role='member' WHERE user_id=1").run();assert.equal(await auth.requireRole(req,f.env,'administrator'),null);
 f.db.prepare("UPDATE users SET status='restricted' WHERE user_id=1").run();assert.equal((await auth.getSession(req,f.env)).status,'restricted');assert.equal(await auth.requireRole(req,f.env,'member'),null);
 for(const status of ['suspended','banned']){f.db.prepare('UPDATE users SET status=? WHERE user_id=1').run(status);assert.equal(await auth.getSession(req,f.env),null);}
 }finally{f.db.close();}
});
test('expiry, malformed identity and unknown session tokens fail closed',async()=>{
 const f=fixture();try{const id=await auth.createSession(f.env,f.user),req=f.request(id);const original=JSON.parse(f.kv.get('session:'+id));
 for(const patch of [{expiresAt:Date.now()-1},{expiresAt:'tomorrow'},{userId:-1},{userId:'1'},{userId:1.5}]){f.kv.set('session:'+id,JSON.stringify({...original,...patch}));assert.equal(await auth.getSession(req,f.env),null);}
 assert.equal(await auth.getSession(f.request('b'.repeat(64)),f.env),null);assert.equal(await auth.getSession(f.request('%xx'),f.env),null);
 }finally{f.db.close();}
});
test('revoking one device preserves another device and legacy TTL sessions',async()=>{
 const f=fixture();try{const a=await auth.createSession(f.env,f.user),b=await auth.createSession(f.env,f.user);assert.notEqual(a,b);
 await auth.destroySession(f.request(a),f.env);assert.equal((await auth.getSession(f.request(b),f.env)).userId,1);
 f.kv.set('session:'+b,JSON.stringify(f.user));assert.equal((await auth.getSession(f.request(b),f.env)).userId,1);
 const cookie=auth.sessionCookie(b);for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert(cookie.includes(flag));
 }finally{f.db.close();}
});
test('missing revocation migration denies authentication',async()=>{
 const f=fixture();try{const id=await auth.createSession(f.env,f.user);f.db.exec('DROP TABLE revoked_sessions');assert.equal(await auth.getSession(f.request(id),f.env),null);await assert.rejects(auth.destroySession(f.request(id),f.env));}finally{f.db.close();}
});
