import type {Env} from "./types";
import {getSession,requireRole,createSession,sessionCookie,hashPassword} from "./auth";
type Provider="google"|"facebook";
type Config={clientId:string;clientSecret:string;enabled:boolean};
const encoder=new TextEncoder();
function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
const hex=(b:Uint8Array)=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const un64=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const provider=(p:string):Provider=>{if(p!=="google"&&p!=="facebook")fail("Unknown sign-in provider.");return p as Provider;};
const cookie=(request:Request,name:string)=>{const value=(request.headers.get("Cookie")||"").split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));return value?.slice(name.length+1)||"";};
const flowCookie=(name:string,value:string)=>name+"="+value+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(value?600:0);
async function encryptionKey(env:Env){if(!env.SESSION_SECRET)fail("Social sign-in settings are unavailable.",503);return crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",encoder.encode("social-settings:"+env.SESSION_SECRET)),"AES-GCM",false,["encrypt","decrypt"]);}
async function config(env:Env,p:Provider):Promise<Config>{const stored=await env.SESSIONS.get("social-config:"+p);if(stored){try{const sealed=JSON.parse(stored);return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:un64(sealed.iv),additionalData:encoder.encode(p)},await encryptionKey(env),un64(sealed.data))));}catch{fail("Saved social sign-in settings could not be read. Ask the administrator to reconnect.",503);}}
 return {clientId:(p==="google"?env.GOOGLE_CLIENT_ID:env.FACEBOOK_APP_ID)||"",clientSecret:(p==="google"?env.GOOGLE_CLIENT_SECRET:env.FACEBOOK_APP_SECRET)||"",enabled:true};}
export async function providerStatus(env:Env){const items=[];for(const p of ["google","facebook"] as Provider[]){try{const c=await config(env,p);items.push({provider:p,label:p==="google"?"Google":"Facebook",ready:!!(c.enabled&&c.clientId&&c.clientSecret)});}catch{items.push({provider:p,label:p==="google"?"Google":"Facebook",ready:false});}}return {items};}
export async function settings(env:Env,origin:string){const items=[];for(const p of ["google","facebook"] as Provider[]){let c:Config={clientId:"",clientSecret:"",enabled:false},unreadable=false;try{c=await config(env,p);}catch{unreadable=true;}items.push({provider:p,clientId:c.clientId,secretConfigured:!!c.clientSecret,enabled:c.enabled,ready:!!(c.enabled&&c.clientId&&c.clientSecret),unreadable,callbackUrl:origin+"/api/auth/social/"+p+"/callback"});}return {items};}
export async function saveSettings(env:Env,p:string,b:any){const key=provider(p);let old:Config={clientId:"",clientSecret:"",enabled:false};try{old=await config(env,key);}catch{if(!b.clientSecret)fail("Enter the secret again to reconnect.");}
 const next:Config={clientId:String(b.clientId||"").trim(),clientSecret:String(b.clientSecret||"").trim()||old.clientSecret,enabled:b.enabled===true};
 if(next.clientId.length>300||next.clientSecret.length>1000||/\s/.test(next.clientId+next.clientSecret))fail("Check the app ID and secret.");
 if(next.enabled&&(!next.clientId||!next.clientSecret))fail("Enter the app ID and secret before enabling sign-in.");
 const iv=crypto.getRandomValues(new Uint8Array(12)),sealed=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:encoder.encode(key)},await encryptionKey(env),encoder.encode(JSON.stringify(next)));
 await env.SESSIONS.put("social-config:"+key,JSON.stringify({iv:b64(iv),data:b64(new Uint8Array(sealed))}));return {ok:true};}
async function flow(env:Env,state:string,p:string,payload:any){await env.DB.prepare("DELETE FROM social_login_flows WHERE expires_at<?").bind(Date.now()).run();await env.DB.prepare("INSERT INTO social_login_flows(state,provider,payload,expires_at) VALUES(?,?,?,?)").bind(state,p,JSON.stringify(payload),Date.now()+600000).run();}
export async function start(request:Request,env:Env,p:string,b:any){const key=provider(p),c=await config(env,key);if(!c.enabled||!c.clientId||!c.clientSecret)fail("This sign-in option is awaiting administrator setup.",503);
 const user=await getSession(request,env);if(b.link===true&&(!user||user.status!=="active"))fail("Sign in to your existing account before connecting a provider.",401);
 const state=random(),verifier=random(),nonce=random(),origin=new URL(request.url).origin,callback=origin+"/api/auth/social/"+key+"/callback";
 await flow(env,state,key,{verifier,nonce,callback,linkUserId:b.link===true?user?.userId:null});
 const u=new URL(key==="google"?"https://accounts.google.com/o/oauth2/v2/auth":"https://www.facebook.com/v26.0/dialog/oauth");
 u.searchParams.set("client_id",c.clientId);u.searchParams.set("redirect_uri",callback);u.searchParams.set("response_type","code");u.searchParams.set("state",state);
 u.searchParams.set("scope",key==="google"?"openid email profile":"public_profile,email");
 if(key==="google"){u.searchParams.set("nonce",nonce);u.searchParams.set("code_challenge",b64(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(verifier)))));u.searchParams.set("code_challenge_method","S256");u.searchParams.set("prompt","select_account");}
 return {url:u.href,cookie:flowCookie("gc_social_state",state)};}
async function fetchJson(url:string,init:RequestInit={}){const r=await fetch(url,{...init,signal:AbortSignal.timeout(10000)});if(!r.ok)fail("The provider could not verify your account. Please try again.");return r.json<any>();}
export async function verifyGoogleToken(token:string,clientId:string,nonce:string){
 const parts=token.split(".");if(parts.length!==3)fail("Invalid provider identity.");
 const header=JSON.parse(new TextDecoder().decode(un64(parts[0]))),claims=JSON.parse(new TextDecoder().decode(un64(parts[1])));
 if(header.alg!=="RS256"||!header.kid||!["https://accounts.google.com","accounts.google.com"].includes(claims.iss)||claims.aud!==clientId||(claims.azp&&claims.azp!==clientId)||claims.nonce!==nonce||!Number.isFinite(claims.exp)||claims.exp<=Date.now()/1000||!Number.isFinite(claims.iat)||claims.iat>Date.now()/1000+60||typeof claims.sub!=="string"||!claims.sub||claims.sub.length>255)fail("Provider identity validation failed.");
 const jwks=await fetchJson("https://www.googleapis.com/oauth2/v3/certs"),jwk=jwks.keys?.find((k:any)=>k.kid===header.kid&&k.kty==="RSA");
 if(!jwk)fail("Provider identity validation failed.");const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,un64(parts[2]),encoder.encode(parts[0]+"."+parts[1])))fail("Provider identity validation failed.");return claims;
}
async function identity(key:Provider,c:Config,code:string,f:any){const token=await fetchJson(key==="google"?"https://oauth2.googleapis.com/token":"https://graph.facebook.com/v26.0/oauth/access_token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:f.callback,code,...(key==="google"?{grant_type:"authorization_code",code_verifier:f.verifier}:{})})});
 if(key==="google"){const claims=await verifyGoogleToken(String(token.id_token||""),c.clientId,f.nonce);return {subject:claims.sub,name:String(claims.name||""),email:claims.email_verified===true?String(claims.email||"").toLowerCase():""};}
 if(!token.access_token)fail("Provider identity validation failed.");
 const check=await fetchJson("https://graph.facebook.com/v26.0/debug_token?input_token="+encodeURIComponent(token.access_token),{headers:{Authorization:"Bearer "+c.clientId+"|"+c.clientSecret}});
 const info=check.data;if(!info?.is_valid||String(info.app_id)!==c.clientId||!info.user_id||(info.expires_at&&info.expires_at<=Date.now()/1000)||(info.data_access_expires_at&&info.data_access_expires_at<=Date.now()/1000))fail("Provider identity validation failed.");
 const proofKey=await crypto.subtle.importKey("raw",encoder.encode(c.clientSecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const proof=hex(new Uint8Array(await crypto.subtle.sign("HMAC",proofKey,encoder.encode(token.access_token))));
 const profile=await fetchJson("https://graph.facebook.com/v26.0/me?fields=id,name,email&appsecret_proof="+proof,{headers:{Authorization:"Bearer "+token.access_token}});
 if(String(profile.id)!==String(info.user_id))fail("Provider identity validation failed.");return {subject:String(profile.id),name:String(profile.name||""),email:String(profile.email||"").toLowerCase()};
}
export async function callback(request:Request,env:Env,p:string){
 const origin=new URL(request.url).origin,h=new Headers({"Cache-Control":"no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"});h.append("Set-Cookie",flowCookie("gc_social_state",""));
 try{const key=provider(p),url=new URL(request.url),state=url.searchParams.get("state")||"";
 if(!/^[a-f0-9]{64}$/.test(state)||state!==cookie(request,"gc_social_state"))fail("Sign-in expired. Please start again.");
 const row=await env.DB.prepare("DELETE FROM social_login_flows WHERE state=? AND provider=? AND expires_at>? RETURNING payload").bind(state,key,Date.now()).first<any>();if(!row)fail("Sign-in expired. Please start again.");
 if(url.searchParams.has("error"))fail("Sign-in cancelled.");
 const f=JSON.parse(row.payload);if(f.callback!==origin+"/api/auth/social/"+key+"/callback")fail("Sign-in expired. Please start again.");
 const code=url.searchParams.get("code")||"";if(!code||code.length>4096)fail("Provider verification failed.");
 const c=await config(env,key);if(!c.enabled)fail("This sign-in option is paused.");
 const person=await identity(key,c,code,f);
 const linked=await env.DB.prepare("SELECT u.user_id,u.role,u.status FROM social_identities i JOIN users u ON u.user_id=i.user_id WHERE i.provider=? AND i.subject=?").bind(key,person.subject).first<any>();
 if(f.linkUserId){const current=await getSession(request,env);if(!current||current.userId!==f.linkUserId||current.status!=="active")fail("Sign in again before connecting this provider.");
 if(linked&&Number(linked.user_id)!==current.userId)fail("That social account is already connected to another member.");
 const existing=await env.DB.prepare("SELECT subject FROM social_identities WHERE provider=? AND user_id=?").bind(key,current.userId).first<any>();if(existing&&existing.subject!==person.subject)fail("This member already has a different account connected for this provider.");
 if(!linked)await env.DB.prepare("INSERT INTO social_identities(provider,subject,user_id) VALUES(?,?,?)").bind(key,person.subject,current.userId).run();
 h.set("Location",origin+"/account.html?socialConnected="+key);
 }else if(linked){if(!["active","restricted"].includes(linked.status))fail("Account access is unavailable. Contact ministry support.");
 const id=await createSession(env,{userId:Number(linked.user_id),role:linked.role,status:linked.status});h.append("Set-Cookie",sessionCookie(id));h.set("Location",origin+(linked.status==="restricted"?"/safety.html":"/"));
 }else{const pending=random();await flow(env,pending,key,{...person,name:person.name.slice(0,100),email:person.email.slice(0,160),kind:"onboard"});h.append("Set-Cookie",flowCookie("gc_social_pending",pending));h.set("Location",origin+"/account.html?social=complete");}
 }catch(e:any){const safe=e?.message==="Sign-in cancelled."?"cancelled":"failed";h.set("Location",origin+"/account.html?socialError="+safe);}
 return new Response(null,{status:303,headers:h});}
export async function pending(request:Request,env:Env){const id=cookie(request,"gc_social_pending");if(!/^[a-f0-9]{64}$/.test(id))fail("Sign-in expired. Please start again.");const row=await env.DB.prepare("SELECT provider,payload FROM social_login_flows WHERE state=? AND expires_at>?").bind(id,Date.now()).first<any>();if(!row)fail("Sign-in expired. Please start again.");const p=JSON.parse(row.payload);if(p.kind!=="onboard")fail("Sign-in expired. Please start again.");return {id,provider:provider(row.provider),person:p};}
export async function complete(request:Request,env:Env,b:any){if(b.ageConfirmed!==true||b.standardsAccepted!==true)fail("Confirm you are 18 or older and have read the community rules and privacy notice.");
 const f=await pending(request,env),name=String(b.fullName||f.person.name||"").trim(),email=String(f.person.email||b.email||"").trim().toLowerCase();
 if(name.length<2||name.length>100||email.length>160||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail("Enter your name and a valid email address.");
 if(await env.DB.prepare("SELECT 1 FROM users WHERE email=?").bind(email).first())fail("This email already has an account. Sign in to your existing account, then connect your social account from Account & security.",409);
 const taken=await env.DB.prepare("DELETE FROM social_login_flows WHERE state=? AND expires_at>? RETURNING state").bind(f.id,Date.now()).first();if(!taken)fail("Sign-in expired. Please start again.");
 const pass=await hashPassword(random(),env.PASSWORD_PEPPER),created=await env.DB.batch([
 env.DB.prepare("INSERT INTO users(email,password_hash,password_salt) VALUES(?,?,?) RETURNING user_id,role,status").bind(email,pass.hash,pass.salt),
 env.DB.prepare("INSERT INTO profiles(user_id,full_name,display_name,location_visibility,church_visibility,work_visibility,global_connections_visibility) SELECT user_id,?,?,'private','private','private','private' FROM users WHERE email=?").bind(name,name.slice(0,60),email),
 env.DB.prepare("INSERT INTO social_identities(provider,subject,user_id) SELECT ?,?,user_id FROM users WHERE email=?").bind(f.provider,f.person.subject,email),
 env.DB.prepare("INSERT INTO account_acknowledgements(user_id,policy_version,adult_attestation) SELECT user_id,'2026-10-05',1 FROM users WHERE email=?").bind(email)
 ]);
 const row:any=created[0].results?.[0];const id=await createSession(env,{userId:Number(row.user_id),role:row.role,status:row.status});return {cookie:sessionCookie(id),clear:flowCookie("gc_social_pending","")};
}
