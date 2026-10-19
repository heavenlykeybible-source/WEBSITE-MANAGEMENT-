/** Owner credentials use local salted digests. Existing member credentials and roles are preserved. */
export async function centralOwnerLogin(env:{DB:D1Database;OWNER_DASHBOARD_PASSWORD_HASH?:string;OWNER_DASHBOARD_PASSWORD_SALT?:string},password:string,_unused?:unknown,report:(stage:string)=>void=()=>{}):Promise<number|null>{
 if(typeof password!=='string'||password.length<14||password.length>200)return null;
 const records=await env.DB.prepare("SELECT u.user_id FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.role_name='Super Administrator' AND u.status='active' ORDER BY u.user_id LIMIT 2").all<{user_id:number}>();
 if(records.results.length!==1){report('owner-record-count-'+records.results.length);return null}
 const salt=env.OWNER_DASHBOARD_PASSWORD_SALT,expected=env.OWNER_DASHBOARD_PASSWORD_HASH;
 if(!salt||!expected||! /^[a-f0-9]{64}$/.test(expected)){report('owner-password-not-configured');return null}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const digest=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 const actual=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 let different=expected.length^actual.length;for(let i=0;i<expected.length;i++)different|=expected.charCodeAt(i)^actual.charCodeAt(i);
 if(different){report('credentials-not-confirmed');return null}
 return records.results[0].user_id;
}
