/** Passwordless owner access. Existing Account 1 signed capabilities remain supported. */
export interface StudioAuthEnv {
 STUDIO_SSO_SECRET?:string; CONTROL_ROOM_URL?:string;
 LIVE_STATUS_KV:KVNamespace; ASSETS?:Fetcher;
}
export type StudioOwner={sub:string;role:string;name:string;iat:number;exp:number;nonce:string};
const cookieName='__Host-hk-studio';
const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers});
const random=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
function cookie(req:Request,name:string){return (req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
function setCookie(name:string,value:string,age:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;}
function redirect(url:string,cookies:string[]=[]){const h=new Headers(headers);h.set('location',url);for(const c of cookies)h.append('set-cookie',c);return new Response(null,{status:303,headers:h});}
export function controlOrigin(env:StudioAuthEnv){const u=new URL(env.CONTROL_ROOM_URL||'');if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('CONTROL_ROOM_URL must be the control room HTTPS origin.');return u.origin;}
function configured(env:StudioAuthEnv){try{return typeof env.STUDIO_SSO_SECRET==='string'&&env.STUDIO_SSO_SECRET.length>=32&&!!controlOrigin(env);}catch{return false;}}
export async function studioOwner(req:Request,env:StudioAuthEnv):Promise<StudioOwner|null>{
 const id=cookie(req,cookieName);if(!/^[a-f0-9]{64}$/.test(id))return null;
 const raw=await env.LIVE_STATUS_KV.get('studio-session:'+id);if(!raw)return null;
 try{const owner=JSON.parse(raw);if(owner.role!=='Super Administrator'||typeof owner.sub!=='string'||!owner.sub.startsWith('control-room:')||!Number.isSafeInteger(owner.exp)||owner.exp<=Math.floor(Date.now()/1000))return null;return owner;}catch{return null;}
}
export async function studioAuthRoute(req:Request,env:StudioAuthEnv):Promise<Response|null>{
 const u=new URL(req.url),p=u.pathname;
 if(p==='/auth/start'&&req.method==='GET'){
  if(!configured(env))return json({error:'Studio sign-in needs CONTROL_ROOM_URL and STUDIO_SSO_SECRET configured on this existing Worker.'},503);
  const state=random(),target=new URL('/studio/connect',controlOrigin(env));target.searchParams.set('state',state);
  return redirect(target.href,[setCookie('__Host-hk-studio-state',state,300)]);
 }
 if(p==='/auth/callback'&&req.method==='GET'){
  if(!configured(env))return json({error:'Studio sign-in is not configured.'},503);
  const state=u.searchParams.get('state')||'',code=u.searchParams.get('code')||'';
  if(!/^[a-f0-9]{64}$/.test(state)||!/^[a-f0-9]{64}$/.test(code)||cookie(req,'__Host-hk-studio-state')!==state)return json({error:'Sign-in could not be confirmed. Open Studio again from the control room.'},401);
  let response:Response;try{response=await fetch(controlOrigin(env)+'/api/studio/redeem',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json',authorization:'Bearer '+env.STUDIO_SSO_SECRET},body:JSON.stringify({state,code,audience:u.origin})});}catch{return json({error:'Control room could not be reached. Open Studio again to retry.'},502);}
  if(!response.ok)return json({error:'Sign-in expired or was denied. Open Studio again from the control room.'},401);
  const owner=await response.json() as Partial<StudioOwner>;
  if(owner.role!=='Super Administrator'||typeof owner.sub!=='string'||!/^control-room:\d+$/.test(owner.sub)||typeof owner.name!=='string')return json({error:'Control room returned an invalid identity.'},502);
  const now=Math.floor(Date.now()/1000),id=random();
  await env.LIVE_STATUS_KV.put('studio-session:'+id,JSON.stringify({...owner,iat:now,exp:now+43200,nonce:id}),{expirationTtl:43200});
  return redirect('/',[setCookie(cookieName,id,43200),setCookie('__Host-hk-studio-state','',0)]);
 }
 if(p==='/auth/logout'&&req.method==='POST'){
  if(req.headers.get('origin')!==u.origin)return json({error:'Cross-origin request denied'},403);
  const id=cookie(req,cookieName);if(/^[a-f0-9]{64}$/.test(id))await env.LIVE_STATUS_KV.delete('studio-session:'+id);
  return new Response(null,{status:204,headers:{...headers,'Set-Cookie':setCookie(cookieName,'',0)}});
 }
 if(p==='/api/studio/me'&&req.method==='GET'){const owner=await studioOwner(req,env);return owner?json({name:owner.name,expires_at:owner.exp}):json({error:'Open Studio from the control room to sign in.'},401);}
 if(p==='/'&&['GET','HEAD'].includes(req.method)){
  if(await studioOwner(req,env))return env.ASSETS?env.ASSETS.fetch(req):json({error:'Studio assets are not configured'},503);
  return new Response(req.method==='HEAD'?null:'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Heavenly Key Studio</title><body style="font:18px system-ui;max-width:640px;margin:12vh auto;padding:24px"><h1>Heavenly Key Studio</h1><p>Use your control room owner account to enter Studio.</p><a href="/auth/start">Continue with control room</a></body></html>',{headers:{...headers,'content-type':'text/html;charset=utf-8'}});
 }
 if(p.startsWith('/js/')||p.startsWith('/css/')||p.startsWith('/assets/'))return env.ASSETS?env.ASSETS.fetch(req):json({error:'Asset not found'},404);
 return null;
}
