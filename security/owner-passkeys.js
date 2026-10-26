import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';

// Public keys only. Device biometrics never leave the authenticator.
export function createOwnerPasskeyRoutes({json,fail,body,reauthenticate,audit,withOperationLock,createLoginSession}) {
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
    await save(env,prefix(user)+await digest(credential.id),{id:credential.id,publicKey:base64(credential.publicKey),counter:credential.counter,rpId:rpID,transports:credential.transports||[],label:String(b.label||'Owner device').slice(0,80),created_at:new Date().toISOString()});
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
 async function loginRoutes(req,env){
  const url=new URL(req.url),origin=url.origin,rpID=url.hostname;
  if(req.method!=='POST'||!['/api/passkey-login/options','/api/passkey-login/verify'].includes(url.pathname))return null;
  if(url.protocol!=='https:'||req.headers.get('origin')!==origin||req.headers.get('sec-fetch-site')==='cross-site')fail('Use the secure Control Room sign-in page.',403);
  const ip='passkey-login:'+(req.headers.get('cf-connecting-ip')||'unknown'),now=Date.now();
  const attempts=await env.DB.prepare('SELECT COUNT(*) n FROM login_attempts WHERE ip=? AND ts>?').bind(ip,now-600000).first();if(attempts.n>=20)fail('Too many sign-in requests. Wait ten minutes.',429);
  await env.DB.prepare('INSERT INTO login_attempts(ip,ts) VALUES(?,?)').bind(ip,now).run();
  await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'passkey-login:%' AND json_extract(value_json,'$.expires')<?").bind(now).run();
  const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(String(b.request_id||'')))fail('Invalid sign-in request');
  const clear='cr_passkey_login=; Path=/api/passkey-login; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
  if(url.pathname.endsWith('/options')){
   const identifier=String(b.user||'').trim().toLowerCase();if(!identifier||identifier.length>200)fail('Enter your username or email first');
   const user=await env.DB.prepare("SELECT * FROM users WHERE (lower(username)=? OR lower(email)=?) AND role='owner' AND kind='staff' AND status='active'").bind(identifier,identifier).first();
   const credentials=user?(await list(env,user)).filter(c=>!c.rpId||c.rpId===rpID):[];
   if(!user||!credentials.length)fail('Use your password first, then register this device under AI permissions.',409);
   const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:credentials.map(c=>({id:c.id,transports:c.transports}))});
   const nonce=crypto.randomUUID()+crypto.randomUUID();await save(env,'passkey-login:'+await digest(nonce),{user:user.id,pass_ver:user.pass_ver,origin,requestId:b.request_id,challenge:options.challenge,expires:now+300000});
   const response=json(options);response.headers.set('set-cookie','cr_passkey_login='+nonce+'; Path=/api/passkey-login; HttpOnly; Secure; SameSite=Strict; Max-Age=300');return response;
  }
  const nonce=(req.headers.get('cookie')||'').match(/(?:^|;\s*)cr_passkey_login=([a-f0-9-]{72})(?:;|$)/)?.[1];if(!nonce)fail('Sign-in expired. Try again.',403);
  const row=await env.DB.prepare('DELETE FROM settings WHERE key=? RETURNING value_json').bind('passkey-login:'+await digest(nonce)).first();if(!row)fail('Sign-in expired or already used.',403);
  const pending=JSON.parse(row.value_json);if(pending.origin!==origin||pending.requestId!==b.request_id||pending.expires<now)fail('Sign-in request does not match or expired.',403);
  return withOperationLock(env,'owner-passkeys:'+pending.user,async()=>{
   const user=await env.DB.prepare("SELECT * FROM users WHERE id=? AND role='owner' AND kind='staff' AND status='active'").bind(pending.user).first();if(!user||user.pass_ver!==pending.pass_ver)fail('Account changed. Sign in again.',403);
   const credential=(await list(env,user)).find(c=>c.id===b.credential?.id&&(!c.rpId||c.rpId===rpID));if(!credential)fail('Unregistered sign-in device',403);
   const handle=b.credential?.response?.userHandle,expected=btoa('owner:'+user.id).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');if(handle&&handle!==expected)fail('Device belongs to a different account',403);
   let verified;try{verified=await verifyAuthenticationResponse({response:b.credential,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,credential:{id:credential.id,publicKey:bytes(credential.publicKey),counter:credential.counter,transports:credential.transports},requireUserVerification:true});}catch{fail('Device sign-in could not be verified. Try your password.',403);}
   if(!verified.verified)fail('Device sign-in failed',403);
   const {key,...stored}=credential;stored.counter=verified.authenticationInfo.newCounter;await save(env,key,stored);
   await env.DB.prepare("UPDATE users SET last_login=datetime('now') WHERE id=?").bind(user.id).run();await audit(env,user.username,'passkey-login',rpID);
   const response=await createLoginSession(env,user);response.headers.append('set-cookie',clear);return response;
  });
 }
 return {routes,consumeProof,loginRoutes};
}
