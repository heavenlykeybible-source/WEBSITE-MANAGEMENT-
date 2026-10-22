const cookieName='__Host-hkem-owner';
const hex=(bytes:ArrayBuffer)=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async(text:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
async function passwordHash(password:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256))}
function equal(a:string,b:string){let difference=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)difference|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return difference===0}
export async function ownerSession(request:Request,db:D1Database){
 const value=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!value||! /^[a-f0-9]{64}$/.test(value))return null;
 const row=await db.prepare('SELECT actor FROM cms_owner_sessions WHERE session_hash=? AND expires_at>?').bind(await digest(value),Math.floor(Date.now()/1000)).first<{actor:string}>();
 return row?.actor||null;
}
export async function setOwnerPassword(db:D1Database,password:string,actor:string){
 if(typeof password!=='string'||password.length<14||password.length>200)throw Object.assign(Error('Use a password of 14 to 200 characters.'),{status:400});
 const salt=crypto.randomUUID()+crypto.randomUUID(),hash=await passwordHash(password,salt);
 await db.batch([
  db.prepare('INSERT INTO cms_owner_password(id,password_hash,salt,updated_by) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET password_hash=excluded.password_hash,salt=excluded.salt,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP').bind(hash,salt,actor),
  db.prepare('DELETE FROM cms_owner_sessions'),
  db.prepare("INSERT INTO cms_audit(actor,action,target) VALUES(?,'owner-password-set','owner-signin')").bind(actor)
 ]);
 return {ok:true};
}
export async function ownerLogin(request:Request,db:D1Database,password:string){
 const ip=request.headers.get('CF-Connecting-IP')||'unknown',now=Math.floor(Date.now()/1000);
 const bucket='login:'+await digest(ip)+':'+Math.floor(now/900);
 const count=await db.prepare('INSERT INTO cms_ai_limits(bucket_key,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET count=count+1 WHERE count<8 RETURNING count').bind(bucket,now+1800).all();
 if(!count.results.length)return {ok:false,status:429,error:'Too many sign-in attempts. Please wait 15 minutes.'};
 const stored=await db.prepare('SELECT password_hash,salt,updated_by FROM cms_owner_password WHERE id=1').first<{password_hash:string;salt:string;updated_by:string}>();
 if(!stored)return {ok:false,status:503,error:'The owner password has not been set up. Use the protected Control Room to create it.'};
 if(typeof password!=='string'||password.length>200||!equal(await passwordHash(password,stored.salt),stored.password_hash))return {ok:false,status:401,error:'Sign-in failed. Check your owner password.'};
 const bytes=crypto.getRandomValues(new Uint8Array(32)),token=hex(bytes.buffer);
 await db.prepare('INSERT INTO cms_owner_sessions(session_hash,actor,expires_at) VALUES(?,?,?)').bind(await digest(token),stored.updated_by,now+28800).run();
 return {ok:true,cookie:cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800'};
}
export async function ownerLogout(request:Request,db:D1Database){
 const value=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(value)await db.prepare('DELETE FROM cms_owner_sessions WHERE session_hash=?').bind(await digest(value)).run();
 return cookieName+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
}
export function generatedPassword(){return 'HK-'+hex(crypto.getRandomValues(new Uint8Array(16)).buffer)}
