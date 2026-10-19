import type { Env } from "./auth-service";
import { encryptField, decryptField } from "./encryption-service";
import { createMediaEngineCapability, mediaEngineRequest } from "./integrations/media-engine-client";

export type SocialPlatform="facebook"|"instagram"|"youtube"|"tiktok"|"x"|"linkedin";
const encoder=new TextEncoder();
const platforms:SocialPlatform[]=["facebook","instagram","youtube","tiktok","x","linkedin"];

const cfg:Record<SocialPlatform,{id:keyof Env;secret:keyof Env;auth:string;token:string;scope:string}>={
 facebook:{id:"META_CLIENT_ID",secret:"META_CLIENT_SECRET",auth:"https://www.facebook.com/v24.0/dialog/oauth",token:"https://graph.facebook.com/v24.0/oauth/access_token",scope:"pages_show_list,pages_read_engagement,pages_manage_posts"},
 instagram:{id:"META_CLIENT_ID",secret:"META_CLIENT_SECRET",auth:"https://www.facebook.com/v24.0/dialog/oauth",token:"https://graph.facebook.com/v24.0/oauth/access_token",scope:"pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish"},
 youtube:{id:"GOOGLE_CLIENT_ID",secret:"GOOGLE_CLIENT_SECRET",auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token",scope:"https://www.googleapis.com/auth/youtube"},
 tiktok:{id:"TIKTOK_CLIENT_KEY",secret:"TIKTOK_CLIENT_SECRET",auth:"https://www.tiktok.com/v2/auth/authorize/",token:"https://open.tiktokapis.com/v2/oauth/token/",scope:"user.info.basic,video.publish"},
 x:{id:"X_CLIENT_ID",secret:"X_CLIENT_SECRET",auth:"https://twitter.com/i/oauth2/authorize",token:"https://api.x.com/2/oauth2/token",scope:"tweet.read tweet.write users.read offline.access"},
 linkedin:{id:"LINKEDIN_CLIENT_ID",secret:"LINKEDIN_CLIENT_SECRET",auth:"https://www.linkedin.com/oauth/v2/authorization",token:"https://www.linkedin.com/oauth/v2/accessToken",scope:"openid profile w_member_social"}
};

function base64Url(bytes:Uint8Array){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function pkce(){const bytes=crypto.getRandomValues(new Uint8Array(32)),verifier=base64Url(bytes);const digest=await crypto.subtle.digest("SHA-256",encoder.encode(verifier));return {verifier,challenge:base64Url(new Uint8Array(digest))};}
async function oauthCredentials(env:Env,platform:SocialPlatform){
 const c=cfg[platform],envId=String((env as any)[c.id]||""),envSecret=String((env as any)[c.secret]||"");
 if(envId&&envSecret)return {id:envId,secret:envSecret,c,source:"environment" as const};
 const row=await env.DB.prepare("SELECT client_id,client_secret_ciphertext,client_secret_iv,configured FROM social_provider_apps WHERE platform=?").bind(platform).first<any>();
 if(row?.configured&&row.client_id&&row.client_secret_ciphertext&&row.client_secret_iv&&env.ENCRYPTION_KEY){
  const secret=await decryptField(String(row.client_secret_ciphertext),String(row.client_secret_iv),env.ENCRYPTION_KEY);
  return {id:String(row.client_id),secret,c,source:"dashboard" as const};
 }
 throw new Error(platform+" OAuth developer-app credentials are not configured.");
}
function callbackUrl(env:Env,origin:string){return env.SOCIAL_OAUTH_REDIRECT_URL||origin.replace(/\/$/,"")+"/api/social/connections/callback";}

export async function setupStatus(env:Env,origin:string){
 const dbRows=await env.DB.prepare("SELECT platform,configured,updated_at FROM social_provider_apps").all<any>();
 const byPlatform=new Map((dbRows.results||[]).map((r:any)=>[String(r.platform),r]));
 return platforms.map(platform=>{const c=cfg[platform],envConfigured=!!(env as any)[c.id]&&!!(env as any)[c.secret],db=byPlatform.get(platform) as any;return {platform,credentials_configured:envConfigured||Boolean(db?.configured),credential_source:envConfigured?"environment":db?.configured?"dashboard":"none",updated_at:db?.updated_at||null,callback_url:callbackUrl(env,origin)};});
}


export async function saveProviderApp(env:Env,platform:SocialPlatform,clientId:string,clientSecret:string,actorId:number){
 if(!platforms.includes(platform))throw new Error("Unsupported social platform.");
 if(!env.ENCRYPTION_KEY)throw new Error("Encrypted credential storage is not configured.");
 const id=clientId.trim(),secret=clientSecret.trim();
 if(id.length<3||id.length>300)throw new Error("Enter a valid provider client/app ID.");
 if(secret.length<6||secret.length>1000)throw new Error("Enter a valid provider client/app secret.");
 const targets:SocialPlatform[]=platform==="facebook"||platform==="instagram"?["facebook","instagram"]:[platform];
 for(const target of targets){
  const sealed=await encryptField(secret,env.ENCRYPTION_KEY);
  await env.DB.prepare(`INSERT INTO social_provider_apps(platform,client_id,client_secret_ciphertext,client_secret_iv,configured,updated_by,updated_at)
  VALUES(?,?,?,?,1,?,CURRENT_TIMESTAMP)
  ON CONFLICT(platform) DO UPDATE SET client_id=excluded.client_id,client_secret_ciphertext=excluded.client_secret_ciphertext,client_secret_iv=excluded.client_secret_iv,configured=1,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
  .bind(target,id,sealed.ciphertext,sealed.iv,actorId).run();
 }
 return {platform,configured:true,configured_platforms:targets};
}
export async function removeProviderApp(env:Env,platform:SocialPlatform){
 if(!platforms.includes(platform))throw new Error("Unsupported social platform.");
 const targets:SocialPlatform[]=platform==="facebook"||platform==="instagram"?["facebook","instagram"]:[platform];
 for(const target of targets)await env.DB.prepare("DELETE FROM social_provider_apps WHERE platform=?").bind(target).run();
 return {platform,configured:false,removed_platforms:targets};
}

export async function startConnection(env:Env,platform:SocialPlatform,actorId:number,origin:string){
 if(!platforms.includes(platform))throw new Error("Unsupported platform.");
 const p=await oauthCredentials(env,platform),state=crypto.randomUUID(),flow=await pkce(),redirect=callbackUrl(env,origin);
 await env.DB.prepare("INSERT INTO social_connection_states(state_id,platform,redirect_uri,code_verifier,expires_at,status,created_by) VALUES(?,?,?,?,?,'pending',?)")
  .bind(state,platform,redirect,flow.verifier,new Date(Date.now()+30*60*1000).toISOString(),actorId).run();
 const u=new URL(p.c.auth);u.searchParams.set(platform==="tiktok"?"client_key":"client_id",p.id);u.searchParams.set("redirect_uri",redirect);u.searchParams.set("response_type","code");u.searchParams.set("state",state);u.searchParams.set("scope",p.c.scope);
 if(platform==="youtube"){u.searchParams.set("access_type","offline");u.searchParams.set("prompt","consent");u.searchParams.set("include_granted_scopes","true");}
 if(platform==="x"){u.searchParams.set("code_challenge",flow.challenge);u.searchParams.set("code_challenge_method","S256");}
 return {authorization_url:u.toString(),callback_url:redirect};
}

class ProviderRejectedError extends Error{}
async function providerJson(url:string,init:RequestInit={}){
 const r=await fetch(url,init),raw=await r.text();let data:any=null;try{data=raw?JSON.parse(raw):null;}catch{}
 if(!r.ok)throw new ProviderRejectedError(data?.error?.message||data?.error_description||data?.message||raw||("Provider request failed ("+r.status+")"));
 return {response:r,data};
}
async function saveCredential(env:Env,id:string,platform:SocialPlatform,displayName:string,accountRef:string,credential:Record<string,unknown>,tokenExpiry?:string|null){
 if(!env.ENCRYPTION_KEY)throw new Error("Encrypted credential storage is not configured.");
 const sealed=await encryptField(JSON.stringify(credential),env.ENCRYPTION_KEY);
 await env.DB.prepare(`INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status,token_expiry,updated_at)
 VALUES(?,?,?,?,?,?,1,'connected',?,CURRENT_TIMESTAMP)
 ON CONFLICT(id) DO UPDATE SET display_name=excluded.display_name,account_ref=excluded.account_ref,credential_ciphertext=excluded.credential_ciphertext,credential_iv=excluded.credential_iv,active=1,connection_status='connected',token_expiry=excluded.token_expiry,updated_at=CURRENT_TIMESTAMP`)
 .bind(id,platform,displayName,accountRef,sealed.ciphertext,sealed.iv,tokenExpiry||null).run();
}

export async function completeConnection(env:Env,url:URL){
 const state=url.searchParams.get("state")||"",code=url.searchParams.get("code")||"";
 const row=await env.DB.prepare("SELECT * FROM social_connection_states WHERE state_id=? AND status='pending' AND expires_at>CURRENT_TIMESTAMP").bind(state).first<any>();
 if(!row)throw new Error("Invalid or expired social connection state.");if(!code)throw new Error("Authorization was not completed.");
 const platform=String(row.platform) as SocialPlatform,p=await oauthCredentials(env,platform);
 const body=new URLSearchParams({client_id:p.id,client_secret:p.secret,code,grant_type:"authorization_code",redirect_uri:String(row.redirect_uri)});
 if(platform==="tiktok"){body.set("client_key",p.id);body.delete("client_id");}
 if(platform==="x")body.set("code_verifier",String(row.code_verifier||""));
 const tokenResult=await providerJson(p.c.token,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
 let token=tokenResult.data;if(!token?.access_token)throw new Error("Provider did not return an access token.");
 const graph=env.META_GRAPH_VERSION||"v24.0";
 if(platform==="facebook"||platform==="instagram"){
  const exchange=new URL(`https://graph.facebook.com/${graph}/oauth/access_token`);exchange.searchParams.set("grant_type","fb_exchange_token");exchange.searchParams.set("client_id",p.id);exchange.searchParams.set("client_secret",p.secret);exchange.searchParams.set("fb_exchange_token",token.access_token);
  try{const longer=await providerJson(exchange.toString());if(longer.data?.access_token)token={...token,...longer.data};}catch{}
 }
 const expiry=token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000).toISOString():null;
 const baseCredential:any={access_token:token.access_token,refresh_token:token.refresh_token,expires_in:token.expires_in,token_type:token.token_type};
 if(platform==="facebook"||platform==="instagram"||platform==="youtube"){
  let options:any[]=[];
  if(platform==="youtube"){
   const {data}=await providerJson("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",{headers:{authorization:"Bearer "+token.access_token}});
   options=(data?.items||[]).map((ch:any)=>({id:String(ch.id),name:String(ch.snippet?.title||"YouTube channel"),kind:"channel"}));
   if(!options.length)throw new Error("No YouTube channel was returned for this Google account.");
  }else{
   const {data}=await providerJson(`https://graph.facebook.com/${graph}/me/accounts?fields=id,name,instagram_business_account`,{headers:{authorization:"Bearer "+token.access_token}});
   const pages=data?.data||[];
   if(platform==="facebook")options=pages.map((page:any)=>({id:String(page.id),name:String(page.name||"Facebook Page"),kind:"page"}));
   else options=pages.filter((page:any)=>page.instagram_business_account?.id).map((page:any)=>({id:String(page.instagram_business_account.id),name:String(page.name||"Instagram professional account"),kind:"instagram",page_id:String(page.id)}));
   if(!options.length)throw new Error(platform==="facebook"?"No Facebook Pages were returned for this account.":"No Instagram professional account linked to a managed Facebook Page was returned.");
  }
  if(!env.ENCRYPTION_KEY)throw new Error("Encrypted credential storage is not configured.");
  const sealed=await encryptField(JSON.stringify(baseCredential),env.ENCRYPTION_KEY);
  await env.DB.prepare("UPDATE social_connection_states SET status='selecting',selection_options=?,pending_credential_ciphertext=?,pending_credential_iv=?,pending_token_expiry=? WHERE state_id=?")
    .bind(JSON.stringify(options),sealed.ciphertext,sealed.iv,expiry,state).run();
  return {platform,state_id:state,requires_selection:true,options,created_by:Number(row.created_by)||null};
 }
 let accountRef="",displayName=platform+" account",credential:any={...baseCredential};
 if(platform==="tiktok"){const {data}=await providerJson("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",{headers:{authorization:"Bearer "+token.access_token}});accountRef=data?.data?.user?.open_id||"";displayName=data?.data?.user?.display_name||displayName;}
 else if(platform==="x"){const {data}=await providerJson("https://api.x.com/2/users/me",{headers:{authorization:"Bearer "+token.access_token}});accountRef=data?.data?.id||"";displayName=data?.data?.name||displayName;}
 else if(platform==="linkedin"){const {data}=await providerJson("https://api.linkedin.com/v2/userinfo",{headers:{authorization:"Bearer "+token.access_token}});accountRef=data?.sub?("urn:li:person:"+data.sub):"";displayName=data?.name||displayName;}
 if(!accountRef)throw new Error("Provider did not return an account identifier.");
 await saveCredential(env,platform+"_"+accountRef,platform,displayName,accountRef,credential,expiry);
 await env.DB.prepare("UPDATE social_connection_states SET status='completed' WHERE state_id=?").bind(state).run();
 return {platform,account_id:platform+"_"+accountRef,display_name:displayName,created_by:Number(row.created_by)||null,requires_selection:false};
}

export async function getConnectionSelection(env:Env,state:string,actorId:number){
 const row=await env.DB.prepare("SELECT state_id,platform,selection_options,created_by,expires_at,status FROM social_connection_states WHERE state_id=? AND status='selecting' AND expires_at>CURRENT_TIMESTAMP").bind(state).first<any>();
 if(!row||Number(row.created_by)!==actorId)throw new Error("This account-selection session is invalid or expired.");
 return {state_id:String(row.state_id),platform:String(row.platform) as SocialPlatform,options:JSON.parse(String(row.selection_options||"[]"))};
}

export async function completeConnectionSelection(env:Env,state:string,selectionInput:string|string[],actorId:number){
 const row=await env.DB.prepare("SELECT * FROM social_connection_states WHERE state_id=? AND status='selecting' AND expires_at>CURRENT_TIMESTAMP").bind(state).first<any>();
 if(!row||Number(row.created_by)!==actorId)throw new Error("This account-selection session is invalid or expired.");
 if(!env.ENCRYPTION_KEY)throw new Error("Encrypted credential storage is not configured.");
 const platform=String(row.platform) as SocialPlatform,options=JSON.parse(String(row.selection_options||"[]"));
 const requested=(Array.isArray(selectionInput)?selectionInput:[selectionInput]).map(v=>String(v||"").trim()).filter(Boolean);
 const selectionIds=[...new Set(requested)];
 if(!selectionIds.length)throw new Error("Choose at least one account or Page.");
 const selected=selectionIds.map(id=>options.find((o:any)=>String(o.id)===id)).filter(Boolean);
 if(selected.length!==selectionIds.length)throw new Error("One or more selected accounts are no longer available.");
 const raw=await decryptField(String(row.pending_credential_ciphertext),String(row.pending_credential_iv),env.ENCRYPTION_KEY),base=JSON.parse(raw);
 const access=String(base.access_token||"");if(!access)throw new Error("Provider authorization token is missing.");
 const expiry=row.pending_token_expiry?String(row.pending_token_expiry):null;
 const connected:any[]=[];
 if(platform==="youtube"){
  const {data}=await providerJson("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",{headers:{authorization:"Bearer "+access}});
  const channels=data?.items||[];
  for(const item of selected){
   const channel=channels.find((ch:any)=>String(ch.id)===String(item.id));if(!channel)throw new Error("A selected YouTube channel is no longer available.");
   const accountRef=String(channel.id),displayName=String(channel.snippet?.title||item.name||"YouTube channel");
   await saveCredential(env,platform+"_"+accountRef,platform,displayName,accountRef,{...base},expiry);
   connected.push({account_id:platform+"_"+accountRef,display_name:displayName});
  }
 }else if(platform==="facebook"||platform==="instagram"){
  const graph=env.META_GRAPH_VERSION||"v24.0";
  const {data}=await providerJson(`https://graph.facebook.com/${graph}/me/accounts?fields=id,name,access_token,instagram_business_account`,{headers:{authorization:"Bearer "+access}});
  const pages=data?.data||[];
  for(const item of selected){
   let accountRef="",displayName=String(item.name||platform+" account"),credential:any={...base};
   if(platform==="facebook"){
    const page=pages.find((p:any)=>String(p.id)===String(item.id));if(!page)throw new Error("A selected Facebook Page is no longer available.");
    accountRef=String(page.id);displayName=String(page.name||displayName);credential.access_token=page.access_token;credential.user_access_token=access;
   }else{
    const page=pages.find((p:any)=>String(p.instagram_business_account?.id||"")===String(item.id));if(!page)throw new Error("A selected Instagram professional account is no longer available.");
    accountRef=String(item.id);credential.access_token=page.access_token;credential.user_access_token=access;credential.facebook_page_id=String(page.id);
    try{const {data:ig}=await providerJson(`https://graph.facebook.com/${graph}/${encodeURIComponent(accountRef)}?fields=id,username,name`,{headers:{authorization:"Bearer "+page.access_token}});displayName=String(ig?.username||ig?.name||page.name||displayName);}catch{displayName=String(page.name||displayName);}
   }
   await saveCredential(env,platform+"_"+accountRef,platform,displayName,accountRef,credential,expiry);
   connected.push({account_id:platform+"_"+accountRef,display_name:displayName});
  }
 }else throw new Error("This provider does not require account selection.");
 await env.DB.prepare("UPDATE social_connection_states SET status='completed',selection_options=NULL,pending_credential_ciphertext=NULL,pending_credential_iv=NULL,pending_token_expiry=NULL WHERE state_id=?").bind(state).run();
 return {platform,accounts:connected,account_id:connected[0]?.account_id||null,display_name:connected[0]?.display_name||null,connected_count:connected.length};
}

export async function cancelConnectionSelection(env:Env,state:string,actorId:number){
 const r=await env.DB.prepare("UPDATE social_connection_states SET status='cancelled',selection_options=NULL,pending_credential_ciphertext=NULL,pending_credential_iv=NULL,pending_token_expiry=NULL WHERE state_id=? AND created_by=? AND status IN ('pending','selecting')").bind(state,actorId).run();
 if(!r.meta.changes)throw new Error("This connection session is already closed or expired.");
 return {cancelled:true};
}

export async function liveAuthorizationStatus(env:Env){
 const accounts=await env.DB.prepare("SELECT id,platform,display_name,active,connection_status FROM social_managed_accounts ORDER BY platform,display_name").all<any>();
 const active=new Map<string,any>();
 for(const row of accounts.results||[])if(row.active&&row.connection_status==='connected'&&!active.has(String(row.platform)))active.set(String(row.platform),row);
 return platforms.map(platform=>{
  const account=active.get(platform);
  const autoLive=platform==='youtube'||platform==='facebook';
  const manualLive=platform==='tiktok';
  const note=platform==='youtube'?'OAuth authorization can create the YouTube live stream and RTMPS ingest automatically.'
   :platform==='facebook'?'OAuth authorization can create a Facebook Page live video and ingest URL automatically when the Page/app has Live Video API permission.'
   :platform==='linkedin'?'OAuth authorization can create LinkedIn Live ingest only when the developer app/account has approved Live Events API access.'
   :platform==='instagram'?'Instagram account authorization is used for publishing, but automatic third-party live ingest is not exposed to this integration.'
   :platform==='x'?'X account authorization is used for publishing, but this integration has no supported public X live-video ingest API.'
   :'TikTok live remains a manual RTMP/stream-key connection unless TikTok grants a supported live API to the app/account.';
  return {platform,connected:!!account,account_id:account?.id||null,display_name:account?.display_name||null,auto_live_supported:autoLive,manual_live_required:manualLive,note};
 });
}

async function activeAccountFor(env:Env,platform:SocialPlatform){
 const account=await env.DB.prepare("SELECT * FROM social_managed_accounts WHERE platform=? AND active=1 AND connection_status='connected' ORDER BY updated_at DESC LIMIT 1").bind(platform).first<any>();
 if(!account)throw new Error(platform+" account is not authorized.");
 const credential=await refreshCredentialIfNeeded(env,account,await loadCredential(env,account));
 return {account,credential};
}

export async function prepareAuthorizedLive(env:Env,platform:SocialPlatform,input:{title?:string;description?:string;format?:string}){
 const title=(input.title||"Heavenly Key Evangelistic Movement Live").slice(0,100),description=(input.description||"Heavenly Key Evangelistic Movement — Taking Christ to the Nations of the World").slice(0,5000);
 if(platform==='youtube'){
  const {credential}=await activeAccountFor(env,platform),access=String(credential.access_token||"");if(!access)throw new Error("YouTube authorization token is missing.");
  const format=String(input.format||"landscape-720"),resolution=format.includes("1080")?"1080p":"720p";
  const streamRes=await providerJson("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,contentDetails",{method:"POST",headers:{authorization:"Bearer "+access,"content-type":"application/json"},body:JSON.stringify({snippet:{title},cdn:{frameRate:"30fps",ingestionType:"rtmp",resolution},contentDetails:{isReusable:false}})});
  const stream=streamRes.data,streamId=stream?.id,ingest=stream?.cdn?.ingestionInfo;if(!streamId||!ingest?.streamName)throw new Error("YouTube did not return live ingestion details.");
  const start=new Date(Date.now()+60*1000).toISOString();
  const broadcastRes=await providerJson("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",{method:"POST",headers:{authorization:"Bearer "+access,"content-type":"application/json"},body:JSON.stringify({snippet:{title,description,scheduledStartTime:start},status:{privacyStatus:credential.youtube_privacy||"public",selfDeclaredMadeForKids:false},contentDetails:{enableAutoStart:true,enableAutoStop:true,enableDvr:true,recordFromStart:true}})});
  const broadcastId=broadcastRes.data?.id;if(!broadcastId)throw new Error("YouTube did not create the live broadcast.");
  await providerJson("https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?part=id,contentDetails&id="+encodeURIComponent(broadcastId)+"&streamId="+encodeURIComponent(streamId),{method:"POST",headers:{authorization:"Bearer "+access}});
  const server=String(ingest.rtmpsIngestionAddress||ingest.ingestionAddress||"");if(!server)throw new Error("YouTube did not return an RTMP/RTMPS ingest address.");
  return {platform,url:server.replace(/\/+$/,"")+"/"+String(ingest.streamName).replace(/^\/+/,''),provider_id:broadcastId};
 }
 if(platform==='facebook'){
  const {account,credential}=await activeAccountFor(env,platform),access=String(credential.access_token||"");if(!access)throw new Error("Facebook authorization token is missing.");
  const graph=env.META_GRAPH_VERSION||"v24.0",endpoint=`https://graph.facebook.com/${graph}/${encodeURIComponent(String(account.account_ref))}/live_videos`;
  const body=new URLSearchParams({access_token:access,status:"LIVE_NOW",title,description});
  const {data}=await providerJson(endpoint,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const url=String(data?.secure_stream_url||data?.stream_url||"");if(!url)throw new Error("Facebook authorized successfully, but the Page/app did not return a live ingest URL. Check Live Video API permission/eligibility.");
  return {platform,url,provider_id:data?.id||null};
 }
 if(platform==='linkedin')throw new Error("LinkedIn is authorized, but automatic Live ingest requires approved LinkedIn Live Events API access. Enable that product on the LinkedIn developer app first.");
 if(platform==='instagram')throw new Error("Instagram authorization is connected for publishing, but this integration does not have a supported automatic Instagram Live ingest API.");
 if(platform==='x')throw new Error("X authorization is connected for publishing, but this integration does not have a supported public X live-video ingest API.");
 throw new Error("TikTok live uses the manual RTMP/stream-key connector.");
}

export async function verifyAuthorizedLive(env:Env,platform:SocialPlatform,providerId:string){
 if(!providerId)throw new Error("Provider live identifier is missing.");
 if(platform==="youtube"){
  const {credential}=await activeAccountFor(env,platform),access=String(credential.access_token||"");if(!access)throw new Error("YouTube authorization token is missing.");
  const {data}=await providerJson("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=status&id="+encodeURIComponent(providerId),{headers:{authorization:"Bearer "+access}});
  const item=data?.items?.[0],status=String(item?.status?.lifeCycleStatus||"unknown");
  return {platform,provider_id:providerId,status,confirmed:status==="live",waiting:["ready","testing","created"].includes(status)};
 }
 if(platform==="facebook"){
  const {credential}=await activeAccountFor(env,platform),access=String(credential.access_token||"");if(!access)throw new Error("Facebook authorization token is missing.");
  const graph=env.META_GRAPH_VERSION||"v24.0";
  const {data}=await providerJson(`https://graph.facebook.com/${graph}/${encodeURIComponent(providerId)}?fields=status`,{headers:{authorization:"Bearer "+access}});
  const status=String(data?.status||"unknown").toUpperCase();
  return {platform,provider_id:providerId,status,confirmed:status==="LIVE",waiting:["SCHEDULED_LIVE","UNPUBLISHED","PREVIEW"].includes(status)};
 }
 return {platform,provider_id:providerId,status:"unsupported",confirmed:false,waiting:false,unsupported:true};
}

export async function listAccounts(env:Env){
 const r=await env.DB.prepare("SELECT id,platform,display_name,account_ref,active,connection_status,token_expiry,connected_at,updated_at FROM social_managed_accounts ORDER BY platform,display_name").all();
 return r.results;
}
export async function setAccountState(env:Env,id:string,active:boolean){
 const row=await env.DB.prepare("SELECT active,connection_status FROM social_managed_accounts WHERE id=?").bind(id).first<any>();
 if(!row)throw new Error("Social account not found.");
 if(active&&String(row.connection_status)!=="connected")throw new Error("Reconnect this social account before enabling it.");
 if(!active&&Boolean(row.active)){
  const count=await env.DB.prepare("SELECT COUNT(*) AS n FROM social_publish_jobs WHERE account_id=? AND status IN ('queued','publishing')").bind(id).first<{n:number}>();
  if(Number(count?.n||0)>0)throw new Error("This account has queued or publishing posts. Finish or cancel them before disabling automatic publication.");
 }
 await env.DB.prepare("UPDATE social_managed_accounts SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(active?1:0,id).run();
}
export async function removeAccount(env:Env,id:string){
 const active=await env.DB.prepare("SELECT COUNT(*) AS n FROM social_publish_jobs WHERE account_id=? AND status IN ('queued','publishing')").bind(id).first<{n:number}>();
 if(Number(active?.n||0)>0)throw new Error("This account has queued or publishing posts. Finish or cancel them before removing the connection.");
 // Historical receipts remain auditable: disconnect rather than deleting their foreign key.
 const r=await env.DB.prepare("UPDATE social_managed_accounts SET active=0,connection_status='disconnected',credential_ciphertext='',credential_iv='',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
 if(!r.meta.changes)throw new Error("Social account not found.");
}

async function loadCredential(env:Env,account:any){
 if(!env.ENCRYPTION_KEY)throw new Error("Encrypted credential storage is not configured.");
 const raw=await decryptField(String(account.credential_ciphertext),String(account.credential_iv),env.ENCRYPTION_KEY);return JSON.parse(raw);
}
async function refreshCredentialIfNeeded(env:Env,account:any,credential:any){
 const platform=String(account.platform) as SocialPlatform,expiry=account.token_expiry?new Date(account.token_expiry).getTime():NaN;
 if(!Number.isFinite(expiry)||expiry>Date.now()+5*60*1000||!credential?.refresh_token||platform==="facebook"||platform==="instagram")return credential;
 const p=await oauthCredentials(env,platform),body=new URLSearchParams({grant_type:"refresh_token",refresh_token:String(credential.refresh_token)});
 if(platform==="tiktok"){body.set("client_key",p.id);body.set("client_secret",p.secret);}
 else {body.set("client_id",p.id);body.set("client_secret",p.secret);}
 const refreshed=await providerJson(p.c.token,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
 const next={...credential,...refreshed.data,refresh_token:refreshed.data?.refresh_token||credential.refresh_token};
 const nextExpiry=refreshed.data?.expires_in?new Date(Date.now()+Number(refreshed.data.expires_in)*1000).toISOString():account.token_expiry;
 await saveCredential(env,String(account.id),platform,String(account.display_name),String(account.account_ref),next,nextExpiry);
 account.token_expiry=nextExpiry;
 return next;
}
function token(context:any){const t=context.credential?.access_token;if(typeof t!=="string"||!t)throw new Error("Account access token is missing.");return t;}

async function publishProvider(env:Env,account:any,text:string,mediaUrls:string[],mediaType?:string|null){
 const credential=await refreshCredentialIfNeeded(env,account,await loadCredential(env,account)),context={account,credential},platform=String(account.platform) as SocialPlatform;
 const graph=env.META_GRAPH_VERSION||"v24.0";
 if(platform==="facebook"){
  const page=encodeURIComponent(account.account_ref),access=token(context);
  const auth={"authorization":"Bearer "+access,"content-type":"application/x-www-form-urlencoded"};
  if(!mediaUrls.length){
   const {data}=await providerJson(`https://graph.facebook.com/${graph}/${page}/feed`,{method:"POST",headers:auth,body:new URLSearchParams({message:text})});
   return {status:"published",id:data?.id};
  }
  if(["video","reel","short"].includes(String(mediaType))){
   const {data}=await providerJson(`https://graph.facebook.com/${graph}/${page}/videos`,{method:"POST",headers:auth,body:new URLSearchParams({file_url:mediaUrls[0],description:text})});
   // A video upload acknowledgement can precede processing/availability.
   return {status:"publishing",id:data?.id};
  }
  const {data}=await providerJson(`https://graph.facebook.com/${graph}/${page}/photos`,{method:"POST",headers:auth,body:new URLSearchParams({url:mediaUrls[0],message:text})});
  return {status:"published",id:data?.post_id||data?.id};
 }
 if(platform==="instagram"){
  if(!mediaUrls[0])throw new Error("Instagram requires image or video media.");
  const access=token(context),id=encodeURIComponent(account.account_ref),create=new URL(`https://graph.facebook.com/${graph}/${id}/media`);
  const graphHeaders={"authorization":"Bearer "+access};
  const video=["video","reel","short"].includes(String(mediaType));
  const form=new URLSearchParams({caption:text,...(video?{media_type:"REELS",video_url:mediaUrls[0]}:{image_url:mediaUrls[0]})});
  const {data:container}=await providerJson(create.toString(),{method:"POST",headers:{...graphHeaders,"content-type":"application/x-www-form-urlencoded"},body:form});
  if(!container?.id)throw new Error("Instagram did not return a media container.");
  // Photos also need provider media processing, not just Reels.
  let ready=false;
  for(let i=0;i<12;i++){
   const q=new URL(`https://graph.facebook.com/${graph}/${encodeURIComponent(String(container.id))}`);
   q.searchParams.set("fields","status_code,status");
   const {data}=await providerJson(q.toString(),{headers:graphHeaders});
   if(data?.status_code==="FINISHED"){ready=true;break;}
   if(["ERROR","EXPIRED"].includes(data?.status_code))throw new Error("Instagram media processing failed.");
   if(i<11)await new Promise(r=>setTimeout(r,2500));
  }
  if(!ready)throw new Error("Instagram media processing has not finished. Check status before attempting another post.");
  const pub=new URL(`https://graph.facebook.com/${graph}/${id}/media_publish`);
  const {data}=await providerJson(pub.toString(),{method:"POST",headers:{...graphHeaders,"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({creation_id:String(container.id)})});
  return {status:"published",id:data?.id};
 }
 if(platform==="x"){
  if(mediaUrls.length)throw new Error("X media upload is not enabled yet; publish text-only posts to X.");if(!text)throw new Error("X requires text.");
  const {data}=await providerJson("https://api.x.com/2/tweets",{method:"POST",headers:{authorization:"Bearer "+token(context),"content-type":"application/json"},body:JSON.stringify({text})});return {status:"published",id:data?.data?.id};
 }
 if(platform==="linkedin"){
  if(mediaUrls.length)throw new Error("LinkedIn media upload is not enabled yet; publish text-only posts to LinkedIn.");if(!text)throw new Error("LinkedIn requires text.");
  const version=credential.linkedin_version||"202601";const {response}=await providerJson("https://api.linkedin.com/rest/posts",{method:"POST",headers:{authorization:"Bearer "+token(context),"content-type":"application/json","x-restli-protocol-version":"2.0.0","linkedin-version":String(version)},body:JSON.stringify({author:account.account_ref,commentary:text,visibility:"PUBLIC",distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false})});return {status:"published",id:response.headers.get("x-restli-id")||undefined};
 }
 if(platform==="tiktok"){
  throw new Error("TikTok automatic Direct Post is disabled until approved, creator-authorized public publishing is implemented.");
 }
 if(platform==="youtube"){
  if(!mediaUrls[0])throw new Error("YouTube requires video media.");if(mediaType==="image")throw new Error("YouTube requires video media.");
  const metadata={snippet:{title:(text||"Heavenly Key Evangelistic Movement").slice(0,100),description:text||"Heavenly Key Evangelistic Movement — Taking Christ to the Nations of the World\nhttps://heavenlykey.org"},status:{privacyStatus:credential.youtube_privacy||"public"}};
  const init=await providerJson("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{method:"POST",headers:{authorization:"Bearer "+token(context),"content-type":"application/json","x-upload-content-type":"video/*"},body:JSON.stringify(metadata)});const uploadUrl=init.response.headers.get("location");if(!uploadUrl)throw new Error("YouTube did not return an upload URL.");
  const source=await fetch(mediaUrls[0]);if(!source.ok||!source.body)throw new Error("Unable to fetch video source.");const up=await fetch(uploadUrl,{method:"PUT",headers:{"content-type":source.headers.get("content-type")||"video/mp4"},body:source.body});const raw=await up.text();let data:any={};try{data=raw?JSON.parse(raw):{};}catch{}if(!up.ok)throw new Error(data?.error?.message||raw||"YouTube upload failed.");return {status:"published",id:data?.id};
 }
 throw new Error("Unsupported platform.");
}

async function mediaSig(secret:string,id:number,exp:number){const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,encoder.encode(id+":"+exp));return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,"0")).join("");}
export async function signedMediaUrl(env:Env,id:number,ttlSeconds=1800){if(!env.MEDIA_ENGINE_SHARED_SECRET)throw new Error("Media signing is not configured.");const base=String(env.PUBLIC_SITE_URL||"").replace(/\/$/,"");if(!/^https:\/\//.test(base))throw new Error("Public social-media URL is not configured.");const exp=Math.floor(Date.now()/1000)+ttlSeconds,sig=await mediaSig(env.MEDIA_ENGINE_SHARED_SECRET,id,exp);return `${base}/api/social-media/${id}/object?exp=${exp}&sig=${sig}`;}
export async function verifyMediaSignature(env:Env,id:number,exp:number,sig:string){if(!env.MEDIA_ENGINE_SHARED_SECRET||!Number.isSafeInteger(exp)||exp<Math.floor(Date.now()/1000)||exp>Math.floor(Date.now()/1000)+3600)return false;const expected=await mediaSig(env.MEDIA_ENGINE_SHARED_SECRET,id,exp);if(sig.length!==expected.length)return false;let d=0;for(let i=0;i<sig.length;i++)d|=sig.charCodeAt(i)^expected.charCodeAt(i);return d===0;}

/**
 * Reject unsupported provider/media combinations before a scheduled job is accepted.
 * Each job currently publishes a single file; silently ignoring extras loses content.
 */
export function checkSocialPublishCompatibility(platform:string,mediaType:string,mediaCount:number,hasText:boolean){
 if(mediaCount>1)throw new Error("Select one picture or video per post; publishing albums is not supported yet.");
 if(!mediaCount&& !hasText)throw new Error("Enter text or choose a picture or video.");
 if(mediaCount&& !["image","video","reel","short"].includes(mediaType))throw new Error("Choose an image or video supported by the selected platforms.");
 const video=["video","reel","short"].includes(mediaType);
 if(platform==="facebook")return;
 if(platform==="instagram"&&mediaCount===1)return;
 // Public TikTok Direct Post requires an audited app, creator-info privacy
 // selection, verified source ownership and explicit per-post consent.
 if(platform==="tiktok")throw new Error("TikTok automatic publishing is not certified. Use manual posting until creator privacy consent, domain verification and app audit are completed.");
 if(platform==="youtube"&&mediaCount===1&&video)return;
 if((platform==="x"||platform==="linkedin")&&mediaCount===0&&hasText)return;
 throw new Error(platform+" does not support this post type through Heavenly Key's current publishing integration.");
}
export function checkSocialCaption(platform:string,text:string){
 const count=Array.from(text).length;
 if(platform==="x"&&count>280)throw new Error("X posts exceed 280 characters. Shorten the caption before scheduling.");
 if(platform==="instagram"&&count>2200)throw new Error("Instagram captions cannot exceed 2,200 characters.");
 if(platform==="youtube"&&count>5000)throw new Error("YouTube descriptions cannot exceed 5,000 characters.");
}
export async function createPublishJobs(env:Env,input:{account_ids:string[];text?:string;media_ids?:number[];media_type?:string;publish_at?:string;publish_mode?:"post_now"|"scheduled"},actorId:number){
 const ids=[...new Set((input.account_ids||[]).map(String).filter(Boolean))];
 if(!ids.length)throw new Error("Choose at least one connected social account.");
 const mediaIds=(input.media_ids||[]).map(Number);
 if(mediaIds.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(mediaIds).size!==mediaIds.length)throw new Error("Choose valid, unique uploaded media files.");
 if(mediaIds.length>1)throw new Error("Select only one media file per post.");
 if(!input.text?.trim()&&!mediaIds.length)throw new Error("Enter text or choose media.");
 const mode=input.publish_mode==="scheduled"?"scheduled":"post_now";let when:string|null=null;
 if(mode==="scheduled"){
  if(!input.publish_at)throw new Error("Choose a date and time for a scheduled post.");
  const d=new Date(input.publish_at);
  if(!Number.isFinite(d.getTime())||d.getTime()<=Date.now())throw new Error("Choose a future publishing time.");
  when=d.toISOString();
 }else if(input.publish_at)throw new Error("POST NOW cannot contain a scheduled publishing time.");
 let mediaType=String(input.media_type||"").toLowerCase();
 let retentionCapability:string|null=null;
 if(mediaIds.length){
  if(!env.MEDIA_ENGINE_URL||!env.MEDIA_ENGINE_SHARED_SECRET)throw new Error("Media Engine must be connected before scheduling pictures or videos.");
  if(!/^https:\/\//.test(String(env.PUBLIC_SITE_URL||"")))throw new Error("Public social-media delivery URL must be configured before scheduling media.");
  const role=await env.DB.prepare("SELECT r.role_name FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=?").bind(actorId).first<{role_name:string}>();
  if(!role||!["Administrator","Super Administrator","Deputy Super Administrator"].includes(role.role_name))throw new Error("An authorized administrator is required to schedule media.");
  retentionCapability=await createMediaEngineCapability(env as any,actorId,role.role_name as "Administrator"|"Super Administrator"|"Deputy Super Administrator");
  // Inspect first: an invalid destination or incomplete upload must not
  // turn a temporary file into a permanent storage item.
  const inspect=await mediaEngineRequest(env as any,retentionCapability,`/api/media/${mediaIds[0]}/keep`,{method:"GET"});
  if(!inspect.ok)throw new Error("The selected upload cannot be inspected.");
  const details=await inspect.json() as {media_type?:string;available?:boolean;keep_media?:boolean};
  const actual=String(details.media_type||"");
  if(!details.available||!["image","video"].includes(actual))throw new Error("Choose a completed picture or video upload.");
  if(mediaType&&((mediaType==="image")!==(actual==="image")))throw new Error("Selected media type does not match the uploaded file.");
  mediaType=actual;
 }
 const validated:{id:string;platform:string}[]=[];
 for(const id of ids){
  const account=await env.DB.prepare("SELECT id,platform FROM social_managed_accounts WHERE id=? AND organization_id=1 AND active=1 AND connection_status='connected'").bind(id).first<{id:string;platform:string}>();
  if(!account)throw new Error("One selected social account is not connected.");
  checkSocialPublishCompatibility(account.platform,mediaType,mediaIds.length,Boolean(input.text?.trim()));
  checkSocialCaption(account.platform,String(input.text||""));
  validated.push(account);
 }
 if(mediaIds.length&&retentionCapability){
  const response=await mediaEngineRequest(env as any,retentionCapability,`/api/media/${mediaIds[0]}/keep`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({keep:true})});
  if(!response.ok)throw new Error("The media could not be protected against expiry before publication.");
 }
 // D1 batch operations are atomic, avoiding half-created multi-platform schedules.
 const results=await env.DB.batch(validated.map(account=>env.DB.prepare("INSERT INTO social_publish_jobs(account_id,text,media_ids,media_type,publish_at,status,created_by,organization_id,publish_mode) VALUES(?,?,?,?,?,?,?,1,?)").bind(account.id,input.text?.trim()||null,JSON.stringify(mediaIds),mediaType||null,when,mode==="scheduled"?"queued":"publishing",actorId,mode)));
 const jobs=results.map(row=>Number(row.meta.last_row_id));
 if(mode==="post_now")for(const id of jobs){try{await executeJob(env,id);}catch{}}
 return jobs;
}
export async function publishJobResults(env:Env,jobIds:number[]){
 const ids=[...new Set(jobIds.map(Number).filter(x=>Number.isSafeInteger(x)&&x>0))];if(!ids.length)return [];
 const placeholders=ids.map(()=>'?').join(',');
 const r=await env.DB.prepare(`SELECT j.job_id,j.account_id,j.status,j.provider_post_id,j.error,a.platform,a.display_name FROM social_publish_jobs j JOIN social_managed_accounts a ON a.id=j.account_id WHERE j.organization_id=1 AND j.job_id IN (${placeholders}) ORDER BY j.job_id`).bind(...ids).all<any>();
 return r.results;
}

async function cleanupDeliveredMedia(env:Env,job:any,mediaIds:number[]){
 if(!mediaIds.length||!env.MEDIA_ENGINE_URL||!env.MEDIA_ENGINE_SHARED_SECRET)return;
 // Verify individual file references, not equality of entire media arrays.
 // This guards the same image used in other scheduled jobs or destinations.
 // Only unresolved references matter; archived publication receipts should not
 // cost a growing database scan on every successful picture.
 const outstanding=await env.DB.prepare("SELECT media_ids FROM social_publish_jobs WHERE organization_id=1 AND status!='published' AND (status!='failed' OR COALESCE(error,'')!='Cancelled by administrator') AND media_ids IS NOT NULL").all<{media_ids:string}>();
 const safeIds=mediaIds.filter(id=>!(outstanding.results||[]).some(other=>{
  let refs:number[]=[];try{refs=JSON.parse(other.media_ids||"[]");}catch{return true;}
  return refs.includes(id);
 }));
 if(!safeIds.length)return;
 const actorId=Number(job.created_by);if(!Number.isSafeInteger(actorId)||actorId<1)return;
 const role=await env.DB.prepare("SELECT r.role_name FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=?").bind(actorId).first<{role_name:string}>();
 if(!role||!['Administrator','Super Administrator','Deputy Super Administrator'].includes(role.role_name))return;
 const cap=await createMediaEngineCapability(env as any,actorId,role.role_name as 'Administrator'|'Super Administrator'|'Deputy Super Administrator');
 for(const id of safeIds){
  try{
   const response=await mediaEngineRequest(env as any,cap,`/api/media/${id}/delete`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protect_broadcast:true})});
   if(!response.ok&&response.status!==404)console.warn('Scheduled social media cleanup failed',id,response.status);
  }catch(e){console.warn('Scheduled social media cleanup failed',id,e);}
 }
}

export async function executeJob(env:Env,jobId:number){
 const job=await env.DB.prepare("SELECT * FROM social_publish_jobs WHERE job_id=?").bind(jobId).first<any>();
 if(!job)throw new Error("Publish job not found.");
 if(job.status!=="publishing")throw new Error("Publish job is not in a claimable publishing state.");
 let attempted=false;
 try{
  const account=await env.DB.prepare("SELECT * FROM social_managed_accounts WHERE id=? AND active=1 AND connection_status='connected'").bind(job.account_id).first<any>();
  if(!account)throw new Error("Social account is disconnected.");
  let mediaIds:number[]=[];
  try{mediaIds=JSON.parse(job.media_ids||"[]");}catch{throw new Error("Invalid scheduled media list.");}
  const urls:string[]=[];
  for(const id of mediaIds)urls.push(await signedMediaUrl(env,Number(id),1800));
  // The provider might accept the post even when our Worker loses its reply.
  // Once an attempt begins, uncertain failures require reconciliation, not blind retries.
  attempted=true;
  const result=await publishProvider(env,account,String(job.text||""),urls,String(job.media_type||""));
  if(!result.id)throw new Error("Provider response had no publication identifier.");
  await env.DB.prepare("UPDATE social_publish_jobs SET status=?,provider_post_id=?,error=NULL,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(result.status,result.id,jobId).run();
  if(result.status==="published"){
   try{await cleanupDeliveredMedia(env,job,mediaIds);}
   catch(e){console.warn("Social media delivered but temporary cleanup failed",jobId,e instanceof Error?e.message:"unknown");}
  }
  return result;
 }catch(e){
  const message=e instanceof Error?e.message:String(e);
  if(attempted&&!(e instanceof ProviderRejectedError)){
   // Do not represent an ambiguous provider result as definitely failed.
   await env.DB.prepare("UPDATE social_publish_jobs SET error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(("Publication result unknown; check the provider before retrying. "+message).slice(0,2000),jobId).run();
  }else{
   await env.DB.prepare("UPDATE social_publish_jobs SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(message.slice(0,2000),jobId).run();
  }
  throw e;
 }
}
async function refreshTikTokJob(env:Env,job:any){
 const account=await env.DB.prepare("SELECT * FROM social_managed_accounts WHERE id=?").bind(job.account_id).first<any>();if(!account)return;
 const credential=await refreshCredentialIfNeeded(env,account,await loadCredential(env,account)),publishId=String(job.provider_post_id||"");if(!publishId)return;
 try{
  const {data}=await providerJson("https://open.tiktokapis.com/v2/post/publish/status/fetch/",{method:"POST",headers:{authorization:"Bearer "+token({credential}),"content-type":"application/json"},body:JSON.stringify({publish_id:publishId})});
  const state=String(data?.data?.status||data?.data?.status_code||"").toUpperCase();
  if(["PUBLISH_COMPLETE","PUBLISHED","SUCCESS"].includes(state)){await env.DB.prepare("UPDATE social_publish_jobs SET status='published',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(job.job_id).run();const full=await env.DB.prepare("SELECT * FROM social_publish_jobs WHERE job_id=?").bind(job.job_id).first<any>();let mediaIds:number[]=[];try{mediaIds=JSON.parse(full?.media_ids||"[]");}catch{}if(full)await cleanupDeliveredMedia(env,full,mediaIds);}
  else if(["FAILED","ERROR"].includes(state))await env.DB.prepare("UPDATE social_publish_jobs SET status='failed',error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(String(data?.data?.fail_reason||"TikTok publishing failed").slice(0,2000),job.job_id).run();
 }catch(e){
  const message=e instanceof Error?e.message:String(e);await env.DB.prepare("UPDATE social_publish_jobs SET error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(("Status check: "+message).slice(0,2000),job.job_id).run();
 }
}
async function refreshFacebookVideoJob(env:Env,job:any){
 const account=await env.DB.prepare("SELECT * FROM social_managed_accounts WHERE id=?").bind(job.account_id).first<any>();
 if(!account||!job.provider_post_id)return;
 try{
  const credential=await refreshCredentialIfNeeded(env,account,await loadCredential(env,account));
  const graph=env.META_GRAPH_VERSION||"v24.0";
  const id=encodeURIComponent(String(job.provider_post_id));
  const {data}=await providerJson(`https://graph.facebook.com/${graph}/${id}?fields=status`,{headers:{authorization:"Bearer "+token({credential})}});
  const state=String(data?.status?.video_status||"").toLowerCase();
  if(state==="ready"){
   const updated=await env.DB.prepare("UPDATE social_publish_jobs SET status='published',error=NULL,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(job.job_id).run();
   if(updated.meta.changes){
    const full=await env.DB.prepare("SELECT * FROM social_publish_jobs WHERE job_id=?").bind(job.job_id).first<any>();
    if(full){let mediaIds:number[]=[];try{mediaIds=JSON.parse(full.media_ids||"[]");}catch{}await cleanupDeliveredMedia(env,full,mediaIds);}
   }
  }else if(["error","failed"].includes(state)){
   await env.DB.prepare("UPDATE social_publish_jobs SET status='failed',error='Facebook video processing failed',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(job.job_id).run();
  }else if(!state){
   await env.DB.prepare("UPDATE social_publish_jobs SET error='Facebook did not return a video readiness status; publication awaits confirmation',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(job.job_id).run();
  }
 }catch(e){
  await env.DB.prepare("UPDATE social_publish_jobs SET error=?,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='publishing'").bind(("Video status check: "+(e instanceof Error?e.message:"unavailable")).slice(0,2000),job.job_id).run();
 }
}
export async function runDueJobs(env:Env){
 // A Worker can stop after sending a provider request but before persisting its reply.
 // Never resend these ambiguous jobs automatically: doing so risks duplicate public posts.
 await env.DB.prepare("UPDATE social_publish_jobs SET status='failed',error='Publication result unknown after interruption. Check the platform for an existing post before manually retrying.',updated_at=CURRENT_TIMESTAMP WHERE status='publishing' AND provider_post_id IS NULL AND julianday(updated_at)<=julianday('now','-20 minutes')").run();
 const due=await env.DB.prepare("SELECT job_id FROM social_publish_jobs WHERE status='queued' AND publish_at IS NOT NULL AND julianday(publish_at)<=julianday('now') ORDER BY publish_at LIMIT 10").all<any>();
 // Limit concurrency so slow provider APIs cannot block the entire due queue.
 for(let i=0;i<due.results.length;i+=3){
  await Promise.all(due.results.slice(i,i+3).map(async row=>{
   const claimed=await env.DB.prepare("UPDATE social_publish_jobs SET status='publishing',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND status='queued'").bind(row.job_id).run();
   if(!claimed.meta.changes)return;
   try{await executeJob(env,Number(row.job_id));}catch{}
  }));
 }
 const pending=await env.DB.prepare("SELECT j.job_id,j.account_id,j.provider_post_id,j.media_type,a.platform FROM social_publish_jobs j JOIN social_managed_accounts a ON a.id=j.account_id WHERE j.status='publishing' AND a.platform IN ('tiktok','facebook') AND j.provider_post_id IS NOT NULL AND (a.platform='tiktok' OR j.media_type IN ('video','reel','short')) ORDER BY j.updated_at LIMIT 10").all<any>();
 for(const row of pending.results){
  if(row.platform==='tiktok')await refreshTikTokJob(env,row);
  else await refreshFacebookVideoJob(env,row);
 }
}
export async function listJobs(env:Env,limit=100){const r=await env.DB.prepare("SELECT j.*,a.platform,a.display_name FROM social_publish_jobs j JOIN social_managed_accounts a ON a.id=j.account_id WHERE j.organization_id=1 ORDER BY j.job_id DESC LIMIT ?").bind(Math.min(Math.max(limit,1),200)).all();return r.results;}
export async function cancelScheduledJob(env:Env,jobId:number){
 const row=await env.DB.prepare("SELECT status,publish_mode,media_ids,created_by FROM social_publish_jobs WHERE job_id=? AND organization_id=1").bind(jobId).first<any>();
 if(!row)throw new Error("Scheduled post not found.");
 if(row.publish_mode!=="scheduled")throw new Error("Only scheduled posts can be cancelled.");
 if(row.status!=="queued")throw new Error("Only a queued scheduled post can be cancelled.");
 const result=await env.DB.prepare("UPDATE social_publish_jobs SET status='failed',error='Cancelled by administrator',updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=1 AND status='queued'").bind(jobId).run();
 if(!result.meta.changes)throw new Error("Scheduled post is no longer queued.");
 let mediaIds:number[]=[];try{mediaIds=JSON.parse(row.media_ids||"[]");}catch{}
 // Cancelled jobs no longer need the file. Do not retain storage indefinitely.
 try{await cleanupDeliveredMedia(env,row,mediaIds);}catch(e){console.warn("Cancelled social media cleanup failed",jobId,e instanceof Error?e.message:"unknown");}
 return {job_id:jobId,status:"cancelled"};
}

export async function retryJob(env:Env,jobId:number){
 const row=await env.DB.prepare("SELECT status,error FROM social_publish_jobs WHERE job_id=? AND organization_id=1").bind(jobId).first<any>();if(!row)throw new Error("Publish job not found.");if(row.status!=="failed")throw new Error("Only a failed publishing job can be retried.");if(String(row.error||"").includes("Publication result unknown"))throw new Error("Check the social platform for a duplicate before retrying this interrupted post.");
 await env.DB.prepare("UPDATE social_publish_jobs SET status='publishing',error=NULL,retry_count=retry_count+1,updated_at=CURRENT_TIMESTAMP WHERE job_id=? AND organization_id=1").bind(jobId).run();
 try{return await executeJob(env,jobId);}catch(e){throw e;}
}
