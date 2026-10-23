import type {Env} from './types';
import {getSession,verifyPassword,createSession,sessionCookie} from './auth';
const prefix='/api/auth/passkeys';
function fail(message:string,status=403):never{throw Object.assign(new Error(message),{status});}
const digest=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const encode=(value:Uint8Array)=>btoa(String.fromCharCode(...value));
const decode=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const cookie=(value:string,maxAge=300)=>`gc_passkey=${value}; Path=${prefix}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
export function passkeyRoutes({json,body,rate,sourceKey}:{json:(data:unknown,status?:number,headers?:Record<string,string>)=>Response;body:(r:Request)=>Promise<any>;rate:(env:Env,key:string,max:number,seconds:number)=>Promise<boolean>;sourceKey:(r:Request)=>Promise<string>}){
 return async function route(request:Request,env:Env):Promise<Response|null>{
  const url=new URL(request.url),path=url.pathname.slice(prefix.length),origin=url.origin,rpID=url.hostname;
  if(!url.pathname.startsWith(prefix+'/')&&url.pathname!==prefix)return null;
  const {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse}=await import('@simplewebauthn/server');
  if(url.protocol!=='https:')fail('Use the secure community website.');
  if(request.method!=='GET'&&(request.headers.get('Origin')!==origin||request.headers.get('Sec-Fetch-Site')==='cross-site'))fail('Use the community account page.');
  const session=await getSession(request,env);
  const list=(id:number)=>env.DB.prepare('SELECT * FROM member_passkeys WHERE user_id=? AND rp_id=?').bind(id,rpID).all<any>();
  if(path===''&&request.method==='GET'){
   if(!session)fail('Please sign in.',401);
   const rows=await list(session.userId);return json({credentials:rows.results.map(c=>({id:c.credential_id,label:c.label,created_at:c.created_at,last_used_at:c.last_used_at}))});
  }
  if(request.method!=='POST')fail('Method not allowed.',405);
  if(!await rate(env,'passkeys-source:'+await sourceKey(request),40,900))fail('Too many attempts. Please wait.',429);
  const b=await body(request);
  const user=async(id:number)=>env.DB.prepare('SELECT user_id,email,password_hash,password_salt,role,status FROM users WHERE user_id=?').bind(id).first<any>();
  const version=(u:any)=>digest(u.password_hash+':'+u.password_salt);
  async function owner(){
   if(!session||session.status!=='active')fail('Sign in to an active account.',401);
   const u=await user(session.userId);
   if(!u||u.status!=='active'||typeof b.password!=='string'||b.password.length>128||!await verifyPassword(b.password,u.password_salt,u.password_hash,env.PASSWORD_PEPPER))fail('Confirm your current password.');
   return u;
  }
  async function saveFlow(u:any,kind:string,challenge:string){
   const token=crypto.randomUUID()+crypto.randomUUID();
   await env.DB.prepare('DELETE FROM member_passkey_flows WHERE expires_at<=?').bind(Date.now()).run();
   await env.DB.prepare('INSERT INTO member_passkey_flows(token_hash,user_id,kind,origin,challenge,password_version,expires_at) VALUES(?,?,?,?,?,?,?)').bind(await digest(token),u.user_id,kind,origin,challenge,await version(u),Date.now()+300000).run();
   return cookie(token);
  }
  async function consume(kind:string){
   const token=request.headers.get('Cookie')?.match(/(?:^|;\s*)gc_passkey=([a-f0-9-]{72})(?:;|$)/)?.[1];
   if(!token)fail('Device verification expired. Try again.');
   const flow=await env.DB.prepare('DELETE FROM member_passkey_flows WHERE token_hash=? RETURNING *').bind(await digest(token)).first<any>();
   if(!flow||flow.expires_at<=Date.now()||flow.origin!==origin||flow.kind!==kind)fail('Device verification expired or was already used.');
   const u=await user(flow.user_id);
   if(!u||!['active','restricted'].includes(u.status)||await version(u)!==flow.password_version)fail('Account changed. Sign in again.');
   return {flow,u};
  }
  if(path==='/register/options'){
   const u=await owner(),existing=await list(u.user_id);if(existing.results.length>=8)fail('Remove an old passkey before adding another.',409);
   const options=await generateRegistrationOptions({rpName:'Heavenly Key Global Community',rpID,userName:u.email,userID:new TextEncoder().encode('community:'+u.user_id),attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:existing.results.map(c=>({id:c.credential_id})),authenticatorSelection:{residentKey:'preferred',userVerification:'required',authenticatorAttachment:'platform'}});
   return json(options,200,{'Set-Cookie':await saveFlow(u,'register',options.challenge)});
  }
  if(path==='/register/verify'){
   const {flow,u}=await consume('register');if(!session||session.userId!==u.user_id||u.status!=='active')fail('Sign in again before adding a device.');
   let result;try{result=await verifyRegistrationResponse({response:b.credential,expectedChallenge:flow.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});}catch{fail('Device registration could not be verified. Try again.');}
   if(!result.verified||!result.registrationInfo)fail('Device registration failed.');
   const c=result.registrationInfo.credential;
   // The conditional insert enforces the device limit even for concurrent enrollments.
   const inserted=await env.DB.prepare('INSERT INTO member_passkeys(credential_id,user_id,rp_id,public_key,counter,transports,label) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM member_passkeys WHERE user_id=? AND rp_id=?)<8 RETURNING credential_id').bind(c.id,u.user_id,rpID,encode(c.publicKey),c.counter,JSON.stringify(c.transports||[]),String(b.label||'My device').trim().slice(0,80)||'My device',u.user_id,rpID).first();
   if(!inserted)fail('Device limit reached.',409);return json({ok:true},201,{'Set-Cookie':cookie('',0)});
  }
  if(path==='/remove'){
   const u=await owner();await env.DB.prepare('DELETE FROM member_passkeys WHERE credential_id=? AND user_id=? AND rp_id=?').bind(String(b.id||''),u.user_id,rpID).run();return json({ok:true});
  }
  if(path==='/login/options'){
   const email=String(b.email||'').trim().toLowerCase();if(email.length>160||!email.includes('@'))fail('Enter your email address.',400);
   if(!await rate(env,'passkeys-email:'+await digest(email),12,900))fail('Too many attempts. Please wait.',429);
   const u=await env.DB.prepare("SELECT * FROM users WHERE email=? AND status IN ('active','restricted')").bind(email).first<any>();
   const existing=u?(await list(u.user_id)).results:[];
   // Always return a plausible challenge; do not disclose whether an email has passkeys.
   const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:existing.length?existing.map(c=>({id:c.credential_id,transports:JSON.parse(c.transports)})):[{id:crypto.randomUUID().replace(/-/g,'')} ]});
   return json(options,200,{'Set-Cookie':u&&existing.length?await saveFlow(u,'login',options.challenge):cookie(crypto.randomUUID()+crypto.randomUUID())});
  }
  if(path==='/login/verify'){
   const {flow,u}=await consume('login');
   const c=await env.DB.prepare('SELECT * FROM member_passkeys WHERE credential_id=? AND user_id=? AND rp_id=?').bind(String(b.credential?.id||''),u.user_id,rpID).first<any>();if(!c)fail('Device sign-in failed. Use your password.');
   const handle=b.credential?.response?.userHandle,expected=btoa('community:'+u.user_id).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');if(handle&&handle!==expected)fail('Device belongs to a different account.');
   let result;try{result=await verifyAuthenticationResponse({response:b.credential,expectedChallenge:flow.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:c.credential_id,publicKey:decode(c.public_key),counter:c.counter,transports:JSON.parse(c.transports)}});}catch{fail('Device sign-in failed. Use your password or try again.');}
   if(!result.verified)fail('Device sign-in failed.');
   const updated=await env.DB.prepare('UPDATE member_passkeys SET counter=?,last_used_at=CURRENT_TIMESTAMP WHERE credential_id=? AND user_id=? AND counter=? RETURNING credential_id').bind(result.authenticationInfo.newCounter,c.credential_id,u.user_id,c.counter).first();if(!updated)fail('Device changed. Try again.');
   const fresh=await user(u.user_id);if(!fresh||!['active','restricted'].includes(fresh.status)||await version(fresh)!==flow.password_version)fail('Account changed. Sign in again.');
   const id=await createSession(env,{userId:fresh.user_id,role:fresh.role,status:fresh.status});
   const response=json({ok:true,userId:fresh.user_id},200,{'Set-Cookie':sessionCookie(id)});response.headers.append('Set-Cookie',cookie('',0));return response;
  }
  fail('Unknown passkey endpoint.',404);
 };
}
