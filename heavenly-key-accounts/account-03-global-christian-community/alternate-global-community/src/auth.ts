import type {Env,SessionUser,Role} from "./types";

const enc=new TextEncoder();
const hex=(bytes:Uint8Array)=>[...bytes].map(b=>b.toString(16).padStart(2,"0")).join("");
const fromHex=(value:string)=>new Uint8Array(value.match(/.{1,2}/g)?.map(x=>parseInt(x,16))||[]);
const cookie=(request:Request,name:string)=>{
  const raw=request.headers.get("Cookie")||"";
  for(const part of raw.split(";")){const [k,...v]=part.trim().split("=");if(k===name){try{return decodeURIComponent(v.join("="));}catch{return "";}}}
  return "";
};
const randomHex=(n=32)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return hex(b);};

async function derive(password:string,saltHex:string,pepper:string,iterations=100000){
  if(!pepper)throw Object.assign(new Error("Account service unavailable."),{status:503});
  const key=await crypto.subtle.importKey("raw",enc.encode(password+pepper),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:fromHex(saltHex),iterations},key,256);
  return hex(new Uint8Array(bits));
}
export async function hashPassword(password:string,pepper:string){
  const salt=randomHex(16);return {salt,hash:"pbkdf2-sha256$100000$"+await derive(password,salt,pepper)};
}
export async function verifyPassword(password:string,salt:string,expected:string,pepper:string){
  const version=expected.match(/^pbkdf2-sha256\$100000\$([a-f0-9]{64})$/),digest=version?version[1]:expected;
  if(!/^[a-f0-9]{64}$/.test(digest))return false;
  const got=await derive(password,salt,pepper,version?100000:210000);if(got.length!==digest.length)return false;let diff=0;for(let i=0;i<got.length;i++)diff|=got.charCodeAt(i)^digest.charCodeAt(i);return diff===0;
}
export async function createSession(env:Env,user:SessionUser){
  const id=randomHex(32);await env.SESSIONS.put("session:"+id,JSON.stringify(user),{expirationTtl:60*60*24*30});return id;
}
export async function getSession(request:Request,env:Env):Promise<SessionUser|null>{
  const id=cookie(request,"gc_session");if(!/^[a-f0-9]{64}$/.test(id))return null;
  const raw=await env.SESSIONS.get("session:"+id);if(!raw)return null;
  try{
    const s=JSON.parse(raw) as SessionUser;
    const current=await env.DB.prepare("SELECT role,status FROM users WHERE user_id=?").bind(s.userId).first<any>();
    if(!current||!["active","restricted"].includes(current.status))return null;
    return {userId:s.userId,role:current.role as Role,status:current.status};
  }catch{return null;}
}
export async function destroySession(request:Request,env:Env){const id=cookie(request,"gc_session");if(id)await env.SESSIONS.delete("session:"+id);}
export const sessionCookie=(id:string)=>"gc_session="+encodeURIComponent(id)+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(60*60*24*30);
export const clearSessionCookie=()=>"gc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";

const levels:Record<Role,number>={member:1,moderator:2,administrator:3,owner:4};
export async function requireUser(request:Request,env:Env){return getSession(request,env);}
export async function requireRole(request:Request,env:Env,min:Role){const u=await getSession(request,env);return u&&u.status==="active"&&levels[u.role]>=levels[min]?u:null;}


