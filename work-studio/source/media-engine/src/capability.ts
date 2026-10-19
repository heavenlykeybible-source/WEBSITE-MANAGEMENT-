export type Capability = { sub:string; role:string; iat:number; exp:number; nonce:string };
const roles = new Set(['Administrator','Super Administrator','Deputy Super Administrator']);
/** Compatible with Core's 60-second grants; reject malformed or overlong grants. */
export async function verifyCapability(token:string, secret:string, now=Math.floor(Date.now()/1000)):Promise<Capability|null>{
 if(!secret || typeof token!=='string' || token.length>4096)return null;
 const parts=token.split('.');if(parts.length!==2)return null;
 const [encoded,signature]=parts;if(!encoded||!/^[0-9a-f]{64}$/i.test(signature))return null;
 try{
  const p=JSON.parse(atob(encoded));
  if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.sub!=='string'||!p.sub.trim()||p.sub.length>128||typeof p.nonce!=='string'||!/^[0-9a-f]{32}$/i.test(p.nonce)||!roles.has(p.role)||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||p.iat<0||p.exp<=now||p.iat>now+30||p.exp<=p.iat||p.exp-p.iat>60)return null;
  const bytes=Uint8Array.from(signature.match(/../g)!,x=>parseInt(x,16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(encoded))?p:null;
 }catch{return null;}
}
