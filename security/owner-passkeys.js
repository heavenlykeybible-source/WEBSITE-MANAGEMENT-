import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';

// Public keys only. Device biometrics never leave the authenticator.
export function createOwnerPasskeyRoutes({json,fail,body,reauthenticate,audit,withOperationLock}) {
 const prefix=user=>'owner-passkey:'+user.id+':';
 const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const base64=a=>btoa(String.fromCharCode(...a));
 const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
 const save=(env,key,value)=>env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').bind(key,JSON.stringify(value)).run();
 async function list(env,user){const r=await env.DB.prepare('SELECT key,value_json FROM settings WHERE key LIKE ?').bind(prefix(user)+'%').all();return r.results.map(r=>({...JSON.parse(r.value_json),key:r.key}));}
 async function challenge(env,user,kind,origin,options,requestId){await save(env,'passkey-challenge:'+user.id+':'+kind,{challenge:options.challenge,origin,requestId,expires:Date.now()+300000});}
 async function consume(env,user,kind,origin,requestId){const r=await env.DB.prepare('DELETE FROM settings WHERE key=? RETURNING value_json').bind('passkey-challenge:'+user.id+':'+kind).first();if(!r)fail('Verification expired. Try again.',403);const c=JSON.parse(r.value_json);if(c.expires<Date.now()||c.origin!==origin||c.requestId!==requestId)fail('Verification expired or does not match this request.',403);return c;}
 async function consumeProof(env,user,password){
  if(typeof password!=='string'||!password.startsWith('passkey:'))return false;
  if(user.role!=='owner'||user.kind==='member')fail('Owner verification required',403);
  const r=await env.DB.prepare('DELETE FROM settings WHERE key=? RETURNING value_json').bind('passkey-proof:'+await digest(password.slice(8))).first();
  if(!r)fail('Device confirmation expired or already used.',403);
  const p=JSON.parse(r.value_json);if(p.user!==user.id||p.expires<Date.now())fail('Device confirmation expired.',403);return true;
 }
 async function routes(req,env,user,sub,m){
  if(!sub.startsWith('passkeys'))return null;
  if(user.kind==='member'||user.role!=='owner')fail('Owner access required',403);
  const url=new URL(req.url),origin=url.origin,rpID=url.hostname;
  if(url.protocol!=='https:')fail('Passkeys require HTTPS',403);
  if(m==='GET'&&sub==='passkeys')return json({credentials:(await list(env,user)).map(c=>({id:c.id,label:c.label,created_at:c.created_at})),rpId:rpID});
  if(m!=='POST')fail('Method not allowed',405);
  if(req.headers.get('origin')!==origin)fail('Use the Control Room to verify your device.',403);
  const b=await body(req),requestId=String(b.request_id||'');
  if(requestId.length>100)fail('Invalid verification request');
  return withOperationLock(env,'owner-passkeys:'+user.id,async()=>{
   if(sub==='passkeys/register/options'){
    await reauthenticate(env,user,b.password);
    const existing=await list(env,user);if(existing.length>=8)fail('You can register up to eight passkeys.');
    const options=await generateRegistrationOptions({rpName:'Heavenly Key Control Room',rpID,userName:user.username,userID:new TextEncoder().encode('owner:'+user.id),attestationType:'none',supportedAlgorithmIDs:[-7,-257],excludeCredentials:existing.map(c=>({id:c.id,transports:c.transports})),authenticatorSelection:{residentKey:'preferred',userVerification:'required',authenticatorAttachment:'platform'}});
    await challenge(env,user,'register',origin,options,requestId);return json(options);
   }
   if(sub==='passkeys/register/verify'){
    const c=await consume(env,user,'register',origin,requestId);let result;
    try{result=await verifyRegistrationResponse({response:b.credential,expectedChallenge:c.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});}catch{fail('Device registration could not be verified. Try again.',403);}
    if(!result.verified||!result.registrationInfo)fail('Device registration not verified',403);
    const credential=result.registrationInfo.credential;
    await save(env,prefix(user)+await digest(credential.id),{id:credential.id,publicKey:base64(credential.publicKey),counter:credential.counter,transports:credential.transports||[],label:String(b.label||'Owner device').slice(0,80),created_at:new Date().toISOString()});
    await audit(env,user.username,'passkey-registered','Owner device');return json({verified:true});
   }
   if(sub==='passkeys/authenticate/options'){
    const credentials=await list(env,user);if(!credentials.length)fail('Register your device in AI permissions first.',409);
    const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:credentials.map(c=>({id:c.id,transports:c.transports}))});await challenge(env,user,'authenticate',origin,options,requestId);return json(options);
   }
   if(sub==='passkeys/authenticate/verify'){
    const c=await consume(env,user,'authenticate',origin,requestId),credential=(await list(env,user)).find(c=>c.id===b.credential?.id);if(!credential)fail('This device is not registered to the owner.',403);let result;
    try{result=await verifyAuthenticationResponse({response:b.credential,expectedChallenge:c.challenge,expectedOrigin:origin,expectedRPID:rpID,credential:{id:credential.id,publicKey:bytes(credential.publicKey),counter:credential.counter,transports:credential.transports},requireUserVerification:true});}catch{fail('Device verification failed or was cancelled. Use your password or try again.',403);}
    if(!result.verified)fail('Device verification failed',403);
    const {key,...stored}=credential;stored.counter=result.authenticationInfo.newCounter;await save(env,key,stored);
    const token=crypto.randomUUID()+crypto.randomUUID();await save(env,'passkey-proof:'+await digest(token),{user:user.id,expires:Date.now()+60000});
    // Prune expired verification records, never credentials or other settings.
    await env.DB.prepare("DELETE FROM settings WHERE (key LIKE 'passkey-proof:%' OR key LIKE 'passkey-challenge:%') AND json_extract(value_json,'$.expires')<?").bind(Date.now()).run();
    await audit(env,user.username,'passkey-verified',requestId);return json({verified:true,request_id:requestId,proof:'passkey:'+token});
   }
   if(sub==='passkeys/remove'){
    await reauthenticate(env,user,b.password);await env.DB.prepare('DELETE FROM settings WHERE key=?').bind(prefix(user)+await digest(String(b.id||''))).run();await audit(env,user.username,'passkey-removed','Owner device');return json({ok:true});
   }
   fail('Unknown passkey endpoint',404);
  });
 }
 async function login(req,env){
  const url=new URL(req.url);if(req.method!=='POST'||url.protocol!=='https:'||req.headers.get('origin')!==url.origin)fail('Use the secure Control Room sign-in page.',403);
  const b=await body(req),identifier=String(b.user||'').trim().toLowerCase();if(!identifier||identifier.length>200)fail('Enter your Control Room username first',400);
  const ip='pk:'+(req.headers.get('cf-connecting-ip')||'unknown'),attempts=await env.DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE ip=? AND ts>?').bind(ip,Date.now()-600000).first();if((attempts?.n||0)>=10)fail('Too many device sign-in attempts. Try again later.',429);
  await env.DB.prepare('INSERT INTO login_attempts(ip,ts) VALUES(?,?)').bind(ip,Date.now()).run();
  const user=await env.DB.prepare("SELECT * FROM users WHERE (username=? OR email=?) AND status='active' AND role='owner' AND kind='staff'").bind(identifier,identifier).first();if(!user)fail('Use password sign-in to register your device first.',401);
  const credentials=await list(env,user);if(!credentials.length)fail('Use password sign-in, then register Face ID / fingerprint in AI permissions.',401);
  if(url.pathname.endsWith('/options')){const options=await generateAuthenticationOptions({rpID:url.hostname,userVerification:'required',allowCredentials:credentials.map(c=>({id:c.id,transports:c.transports}))}),requestId=crypto.randomUUID();await challenge(env,user,'login',url.origin,options,requestId);return {options,requestId};}
  const nonce=((req.headers.get('cookie')||'').match(/(?:^|;\s*)cr_passkey_login=([^;]+)/)||[])[1];if(!nonce||nonce!==b.request_id)fail('Device sign-in expired. Start again.',403);
  return withOperationLock(env,'owner-passkeys:'+user.id,async()=>{const pending=await consume(env,user,'login',url.origin,nonce),credential=credentials.find(c=>c.id===b.credential?.id);if(!credential)fail('Device sign-in could not be verified.',403);let verified;try{verified=await verifyAuthenticationResponse({response:b.credential,expectedChallenge:pending.challenge,expectedOrigin:url.origin,expectedRPID:url.hostname,credential:{id:credential.id,publicKey:bytes(credential.publicKey),counter:credential.counter,transports:credential.transports},requireUserVerification:true});}catch{fail('Device sign-in could not be verified.',403);}if(!verified.verified)fail('Device sign-in could not be verified.',403);const {key,...saved}=credential;saved.counter=verified.authenticationInfo.newCounter;await save(env,key,saved);await audit(env,user.username,'passkey-login',ip);return {user};});
 }
 return {routes,consumeProof,login};
}
