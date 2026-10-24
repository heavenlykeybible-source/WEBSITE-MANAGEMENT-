import {fetchStudioAsset} from './studio-assets';
/** Passwordless owner access. Existing Account 1 signed capabilities remain supported. */
export interface StudioAuthEnv {
 STUDIO_AUTH_MODE?:string; ADMIN_USERNAME?:string; ADMIN_PASSWORD?:string; STUDIO_SSO_SECRET?:string; CONTROL_ROOM_URL?:string;
 LIVE_STATUS_KV:KVNamespace; ASSETS?:Fetcher;
}
export type StudioOwner={sub:string;role:string;name:string;iat:number;exp:number;nonce:string;credentialVersion?:string};
const cookieName='__Host-hk-studio';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
const random=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
function cookie(req:Request,name:string){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(name:string,value:string,age:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;}
function redirect(url:string,cookies:string[]=[]){const h=new Headers(headers);h.set('location',url);for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:303,headers:h});}
export function controlOrigin(env:StudioAuthEnv){const u=new URL(env.CONTROL_ROOM_URL||'https://controlroom.heavenlykey.org');if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('CONTROL_ROOM_URL must be the control room HTTPS origin.');return u.origin;}
function localMode(env:StudioAuthEnv){return env.STUDIO_AUTH_MODE==='account2';}
function localConfigured(env:StudioAuthEnv){return localMode(env)&&!!env.ADMIN_USERNAME&&!!env.ADMIN_PASSWORD;}
async function credentialVersion(env:StudioAuthEnv){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.ADMIN_PASSWORD||''),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('studio-owner-v1:'+env.ADMIN_USERNAME)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function sameCredentials(user:string,pass:string,env:StudioAuthEnv){
 const encode=(u:string,p:string)=>new TextEncoder().encode(JSON.stringify([u,p]));
 const a=new Uint8Array(await crypto.subtle.digest('SHA-256',encode(user,pass))),b=new Uint8Array(await crypto.subtle.digest('SHA-256',encode(env.ADMIN_USERNAME||'',env.ADMIN_PASSWORD||'')));
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
function configured(env:StudioAuthEnv){try{return typeof env.STUDIO_SSO_SECRET==='string'&&env.STUDIO_SSO_SECRET.length>=32&&!!controlOrigin(env);}catch{return false;}}
export async function studioOwner(req:Request,env:StudioAuthEnv):Promise<StudioOwner|null>{
 const id=cookie(req,cookieName);if(!/^[a-f0-9]{64}$/.test(id))return null;
 const raw=await env.LIVE_STATUS_KV.get('studio-session:'+id);if(!raw)return null;
 try{const owner=JSON.parse(raw);if(!['Super Administrator','Administrator'].includes(owner.role)||typeof owner.sub!=='string'||!Number.isSafeInteger(owner.exp)||owner.exp<=Math.floor(Date.now()/1000))return null;
 if(owner.sub==='account2:owner'){if(!localConfigured(env)||owner.role!=='Super Administrator'||owner.credentialVersion!==await credentialVersion(env))return null;}
 else if(!configured(env)||!/^control-room:\d+$/.test(owner.sub))return null;
 return owner;}catch{return null;}
}
async function establishSession(owner:Partial<StudioOwner>,env:StudioAuthEnv):Promise<Response>{
 if(!['Super Administrator','Administrator'].includes(String(owner.role))||typeof owner.sub!=='string'||!(owner.sub==='account2:owner'?localConfigured(env):configured(env)&&/^control-room:\d+$/.test(owner.sub))||typeof owner.name!=='string')return json({error:'Control room returned an invalid identity.'},502);
 const now=Math.floor(Date.now()/1000),id=random();
 await env.LIVE_STATUS_KV.put('studio-session:'+id,JSON.stringify({...owner,iat:now,exp:now+43200,nonce:id}),{expirationTtl:43200});
 return redirect('/',[setCookie(cookieName,id,43200),setCookie('__Host-hk-studio-state','',0)]);
}
export function studioPublicRequest(req:Request):Request{
 const u=new URL(req.url),canonical='https://studioroom.heavenlykey.org';
 if(u.origin!=='https://heavenlykey-media.faithofourfatherstv.workers.dev'||req.headers.get('x-hk-public-origin')!==canonical)return req;
 const headers=new Headers(req.headers);if(headers.get('origin')===u.origin)headers.set('origin',canonical);
 u.hostname='studioroom.heavenlykey.org';return new Request(u,new Request(req,{headers}));
}
export async function studioAuthRoute(req:Request,env:StudioAuthEnv):Promise<Response|null>{
 req=studioPublicRequest(req);
 const u=new URL(req.url),p=u.pathname;
 if(p==='/auth/options'&&req.method==='GET')return json({controlRoom:configured(env),directAccount2:localConfigured(env)});
 if(p==='/auth/password'&&req.method==='POST'){
  if(req.headers.get('origin')!==u.origin)return json({error:'Cross-origin request denied'},403);
  if(!(localMode(env)?localConfigured(env):configured(env)))return json({error:'Studio sign-in is not configured.'},503);
  if(!req.body)return json({error:'Enter your username and password'},400);
  const reader=req.body.getReader();let length=0,text='';const decoder=new TextDecoder();
  while(true){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>2048){await reader.cancel();return json({error:'Sign-in request is too large'},413);}text+=decoder.decode(next.value,{stream:true});}text+=decoder.decode();
  let input:any;try{input=JSON.parse(text);}catch{return json({error:'Enter your username and password'},400);}
  if(!input||typeof input.user!=='string'||input.user.length>254||typeof input.pass!=='string'||!input.pass||input.pass.length>128)return json({error:'Enter your control room username and password'},400);
  if(localMode(env)){
   // KV provides a short-lived per-client login throttle; no credential is stored in it.
   const ip=req.headers.get('cf-connecting-ip')||'unknown';
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
   const key='studio-login:'+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
   const now=Date.now(),saved=await env.LIVE_STATUS_KV.get(key);let limit={count:0,until:now+600000};
   if(saved){const parsed=JSON.parse(saved);if(parsed.until>now)limit=parsed;}
   if(limit.count>=10)return json({error:'Too many sign-in attempts. Wait ten minutes, then try again.'},429);
   limit.count++;await env.LIVE_STATUS_KV.put(key,JSON.stringify(limit),{expirationTtl:600});
   if(!await sameCredentials(input.user,input.pass,env))return json({error:'Username or password was not accepted.'},401);
   await env.LIVE_STATUS_KV.delete(key);
   return establishSession({sub:'account2:owner',role:'Super Administrator',name:env.ADMIN_USERNAME!,credentialVersion:await credentialVersion(env)},env);
  }
  let response:Response;
  try{response=await fetch(controlOrigin(env)+'/api/studio/password-login',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json',authorization:'Bearer '+env.STUDIO_SSO_SECRET,'x-studio-client-ip':req.headers.get('cf-connecting-ip')||'studio-unknown'},body:JSON.stringify({user:input.user,pass:input.pass,audience:u.origin})});}catch{return json({error:'Control room could not be reached. Please try again.'},502);}
  if(response.status>=300&&response.status<400)return json({error:'The control room redirected the sign-in request. Check CONTROL_ROOM_URL; credentials were not forwarded.'},502);
  if(!response.ok){if(response.status===429)return json({error:'Too many sign-in attempts. Wait ten minutes, then try again.'},429);if(response.status===403)return json({error:'Use an active control room owner or admin account.'},403);if(response.status===401)return json({error:'Username or password was not accepted, or the Studio connection needs setup.'},401);return json({error:'Studio sign-in could not complete. Check the control room connection.'},503);}
  return establishSession(await response.json() as Partial<StudioOwner>,env);
 }
 if(p==='/auth/start'&&req.method==='GET'){
  if(!configured(env))return json({error:'Studio sign-in needs CONTROL_ROOM_URL and STUDIO_SSO_SECRET configured on this existing Worker.'},503);
  const state=random(),target=new URL('/studio/connect',controlOrigin(env));target.searchParams.set('state',state);
  return redirect(target.href,[setCookie('__Host-hk-studio-state',state,300)]);
 }
 if(p==='/auth/callback'&&req.method==='GET'){
  if(!configured(env))return json({error:'Studio sign-in is not configured.'},503);
  const state=u.searchParams.get('state')||'',code=u.searchParams.get('code')||'';
  if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(code)||cookie(req,'__Host-hk-studio-state')!==state)return json({error:'Sign-in could not be confirmed. Open Studio again from the control room.'},401);
  let response:Response;try{response=await fetch(controlOrigin(env)+'/api/studio/redeem',{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',authorization:'Bearer '+env.STUDIO_SSO_SECRET},body:JSON.stringify({state,code,audience:u.origin})});}catch{return json({error:'Control room could not be reached. Open Studio again to retry.'},502);}
  if(response.status>=300&&response.status<400)return json({error:'The control room redirected the sign-in request. Check CONTROL_ROOM_URL; credentials were not forwarded.'},502);
  if(!response.ok)return json({error:'Sign-in expired or was denied. Open Studio again from the control room.'},401);
  const owner=await response.json() as Partial<StudioOwner>;
  return establishSession(owner,env);
 }
 if(p==='/auth/logout'&&req.method==='POST'){
  if(req.headers.get('origin')!==u.origin)return json({error:'Cross-origin request denied'},403);
  const id=cookie(req,cookieName);if(/^[a-f0-9]{64}$/.test(id))await env.LIVE_STATUS_KV.delete('studio-session:'+id);
  return new Response(null,{status:204,headers:{...headers,'Set-Cookie':setCookie(cookieName,'',0)}});
 }
 if(p==='/api/studio/me'&&req.method==='GET'){const owner=await studioOwner(req,env);return owner?json({name:owner.name,expires_at:owner.exp}):json({error:'Open Studio from the control room to sign in.'},401);}
 if(p==='/'&&['GET','HEAD'].includes(req.method)){
  if(await studioOwner(req,env))return fetchStudioAsset(req,env);
  return fetchStudioAsset(new Request(new URL('/signin.html',u.origin),{method:req.method}),env);

 }
 if(p==='/signin.html'||p.startsWith('/js/')||p.startsWith('/css/')||p.startsWith('/assets/'))return fetchStudioAsset(req,env);
 return null;
}

