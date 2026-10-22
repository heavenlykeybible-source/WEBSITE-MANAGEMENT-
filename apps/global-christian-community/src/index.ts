import type {Env} from "./types";
import {passwordError} from "../public/password-policy.js";
import {hashPassword,verifyPassword,createSession,getSession,destroySession,sessionCookie,clearSessionCookie,requireRole} from "./auth";
import * as S from "./services";
import * as Calls from "./calls";
import * as Safety from "./safety";
import * as Stewardship from "./stewardship";
import * as Social from "./social-auth";
import * as Adverts from "./adverts";
import * as Editorial from "./ministry-editorial";
import * as Active from "./active";
import * as Care from "./community-care";

const security=(headers=new Headers())=>{
  headers.set("X-Content-Type-Options","nosniff");headers.set("X-Frame-Options","DENY");headers.set("Referrer-Policy","strict-origin-when-cross-origin");
  headers.set("Permissions-Policy","camera=(self), microphone=(self), geolocation=()");
  return headers;
};
const json=(data:unknown,status=200,extra?:Record<string,string>)=>{const h=security(new Headers({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...(extra||{})}));return new Response(JSON.stringify(data),{status,headers:h});};
const error=(message:string,status=400)=>json({error:{message}},status);
async function body(request:Request){
  if(!(request.headers.get("Content-Type")||"").toLowerCase().startsWith("application/json"))throw Object.assign(new Error("Send application/json."),{status:415});
  const limit=131072;if(Number(request.headers.get("Content-Length"))>limit)throw Object.assign(new Error("Request too large."),{status:413});
  const reader=request.body?.getReader();if(!reader)throw new Error("Send a valid JSON object.");
  const parts:Uint8Array[]=[];let total=0;try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw Object.assign(new Error("Request too large."),{status:413});}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||Array.isArray(value)||typeof value!=="object")throw new Error();return value;}catch{throw new Error("Send a valid JSON object.");}
}
async function sourceKey(request:Request){const address=request.headers.get("CF-Connecting-IP")||"local";const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(address));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");}
const cleanEmail=(v:any)=>String(v||"").trim().toLowerCase().slice(0,160);
const validEmail=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

async function rate(env:Env,key:string,max:number,seconds:number){
  const k="rate:"+key,raw=await env.SESSIONS.get(k),state=raw?JSON.parse(raw):{n:0};if(state.n>=max)return false;state.n++;await env.SESSIONS.put(k,JSON.stringify(state),{expirationTtl:seconds});return true;
}
async function me(request:Request,env:Env){const u=await getSession(request,env);if(!u)throw Object.assign(new Error("Please sign in."),{status:401});return u;}

async function route(request:Request,env:Env,ctx?:ExecutionContext):Promise<Response>{
  const url=new URL(request.url),p=url.pathname,m=request.method;
  if(m==="OPTIONS")return new Response(null,{status:204,headers:security(new Headers({"Allow":"GET,POST,PATCH,DELETE,OPTIONS"}))});
  if(!p.startsWith("/api/"))return error("Not found.",404);
  if(!["GET","HEAD","OPTIONS"].includes(m)){if(request.headers.get("Sec-Fetch-Site")==="cross-site")return error("Cross-site action denied.",403);const origin=request.headers.get("Origin");if(origin&&origin!==url.origin)return error("Use global.heavenlykey.org to perform this action.",403);}

  if(!['GET','HEAD','OPTIONS'].includes(m)&&!p.startsWith('/api/auth/')&&!p.startsWith('/api/calls')){const writer=await getSession(request,env);if(writer&&!await rate(env,'write:'+writer.userId,180,600))return error('Please slow down and try again shortly.',429);}

  if(p==="/api/auth/social/providers"&&m==="GET")return json(await Social.providerStatus(env));
  if(p==="/api/auth/social/pending"&&m==="GET"){const f=await Social.pending(request,env);return json({provider:f.provider,name:f.person.name,email:f.person.email});}
  if(p==="/api/auth/social/complete"&&m==="POST"){
    if(!await rate(env,"social-register:"+await sourceKey(request),10,3600))return error("Please wait before creating another account.",429);
    const result=await Social.complete(request,env,await body(request));const response=json({ok:true},201);response.headers.append("Set-Cookie",result.cookie);response.headers.append("Set-Cookie",result.clear);return response;
  }
  {const match=p.match(/^\/api\/auth\/social\/(google|facebook)\/(start|callback)$/);if(match){
    if(match[2]==="callback"&&m==="GET")return Social.callback(request,env,match[1]);
    if(match[2]==="start"&&m==="POST"){if(!await rate(env,"social-start:"+await sourceKey(request),20,900))return error("Too many sign-in attempts. Please wait.",429);const result=await Social.start(request,env,match[1],await body(request));return json({url:result.url},200,{"Set-Cookie":result.cookie});}
  }}
  if(p==='/api/care/status'&&m==='GET')return json({enabled:Care.enabled(env)});
  if(p==="/api/health"&&m==="GET")return json({ok:true,service:"global-community",deployment:"active"});
  if(p==="/api/auth/register"&&m==="POST"){
    const b=await body(request),email=cleanEmail(b.email),password=String(b.password||""),fullName=String(b.fullName||"").trim(),displayName=String(b.displayName||fullName).trim();
    if(b.ageConfirmed!==true||b.standardsAccepted!==true)return error("Confirm you are 18 or older and have read the Community rules and privacy notice.");
    if(!validEmail(email))return error("Enter a valid email address.");
    if(fullName.length<2||fullName.length>100)return error("Enter your name using 2 to 100 characters.");
    const passwordIssue=passwordError(password);if(passwordIssue)return error(passwordIssue);
    if(!await rate(env,"register-source:"+await sourceKey(request),10,3600))return error("Please wait before registering another account.",429);
    if(!await rate(env,"register:"+email,5,3600))return error("Please wait before trying to register again.",429);
    if(await env.DB.prepare("SELECT 1 FROM users WHERE email=?").bind(email).first())return error("An account already exists for this email.",409);
    const pass=await hashPassword(password,env.PASSWORD_PEPPER);
    let created;
    try{created=await env.DB.batch([
      env.DB.prepare("INSERT INTO users(email,password_hash,password_salt) VALUES(?,?,?) RETURNING user_id,role,status").bind(email,pass.hash,pass.salt),
      env.DB.prepare("INSERT INTO profiles(user_id,full_name,display_name,country,location_visibility,church_visibility,work_visibility,global_connections_visibility) SELECT user_id,?,?,?,'private','private','private','private' FROM users WHERE email=?").bind(fullName,displayName.slice(0,60),String(b.country||"").trim().slice(0,80)||null,email),
      env.DB.prepare("INSERT INTO account_acknowledgements(user_id,policy_version,adult_attestation) SELECT user_id,'2026-10-05',1 FROM users WHERE email=?").bind(email)
    ]);}catch(err:any){if(/UNIQUE constraint failed: users.email/.test(String(err?.message)))return error("An account already exists for this email. Please sign in.",409);throw err;}
    const row:any=created[0].results?.[0];if(!row)throw new Error("Account could not be created.");
    const id=await createSession(env,{userId:Number(row.user_id),role:row.role,status:row.status});
    return json({ok:true,userId:Number(row.user_id)},201,{"Set-Cookie":sessionCookie(id)});
  }
  if(p==="/api/auth/login"&&m==="POST"){
    const b=await body(request),email=cleanEmail(b.email),password=String(b.password||"");
    if(password.length>128||!validEmail(email))return error("Email or password is incorrect.",401);
    if(!await rate(env,"login-source:"+await sourceKey(request),40,900))return error("Too many attempts. Please wait.",429);
    if(!await rate(env,"login:"+email,12,900))return error("Too many attempts. Please wait before trying again.",429);
    const row=await env.DB.prepare("SELECT user_id,password_hash,password_salt,role,status FROM users WHERE email=?").bind(email).first<any>();
    if(!row||!["active","restricted"].includes(row.status)||!await verifyPassword(password,row.password_salt,row.password_hash,env.PASSWORD_PEPPER))return error("Email or password is incorrect.",401);
    const id=await createSession(env,{userId:Number(row.user_id),role:row.role,status:row.status});
    return json({ok:true,userId:Number(row.user_id),role:row.role},200,{"Set-Cookie":sessionCookie(id)});
  }
  const current=await getSession(request,env);
  if(current?.status==='restricted'&&!['/api/me','/api/me/safety','/api/me/requests','/api/auth/logout','/api/care/preferences'].includes(p))return error('Your account is locked pending administrator review. Open Safety & privacy to read the reason and request review.',403);
  // Timed restrictions do not change account roles/status or release administrator locks.
  if(p==='/api/care/preferences'&&['GET','PATCH'].includes(m)){const u=await me(request,env);Care.requireCare(env);return json(m==='GET'?await Care.preferences(env,u.userId):await Care.savePreferences(env,u.userId,await body(request)));}
  if(p==='/api/care/today'&&m==='GET'){const u=await me(request,env);Care.requireCare(env);return json(await Care.today(env,u.userId));}
  if(p==='/api/admin/care/readings'&&m==='GET'){const u=await requireRole(request,env,'administrator');if(!u)return error('Administrator access required.',403);Care.requireCare(env);return json(await Care.adminReadings(env));}
  {const x=p.match(/^\/api\/admin\/care\/readings\/(\d+)$/);if(x&&m==='PATCH'){const u=await requireRole(request,env,'administrator');if(!u)return error('Administrator access required.',403);Care.requireCare(env);return json(await Care.approveReading(env,u,Number(x[1]),await body(request)));}}
  if(p==="/api/admin/adverts/images"&&m==="POST"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Adverts.uploadImage(env,admin,request),201);}
  {const match=p.match(/^\/api\/adverts\/images\/([a-f0-9-]{36})$/);if(match&&m==="GET"){const image=await Adverts.image(env,match[1]);if(!image)return error("Advert image unavailable.",404);return new Response(image.body,{headers:security(new Headers({"Content-Type":image.mime,"Cache-Control":"public, max-age=60","ETag":image.etag}))});}}
  if(p==="/api/adverts"&&m==="GET")return json(await Adverts.publicAdverts(env));
  if(p==="/api/admin/social-signin"&&m==="GET"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Social.settings(env,url.origin));}
  {const match=p.match(/^\/api\/admin\/social-signin\/(google|facebook)$/);if(match&&m==="POST"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);const result=await Social.saveSettings(env,match[1],await body(request));await env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'social_signin_settings','provider',0,?)").bind(admin.userId,match[1]).run();return json(result);}}
  if(p==="/api/admin/adverts"&&m==="GET"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);const before=Number(url.searchParams.get("before")||0);if(!Number.isSafeInteger(before)||before<0)return error("Invalid advert cursor.");return json(await Adverts.listAdverts(env,before));}
  if(p==="/api/admin/adverts"&&m==="POST"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Adverts.saveAdvert(env,admin,await body(request)),201);}
  {const match=p.match(/^\/api\/admin\/adverts\/(\d+)$/);if(match&&m==="PATCH"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Adverts.saveAdvert(env,admin,await body(request),Number(match[1])));}}
  if(p==="/api/me/safety"&&m==="GET"){const u=await me(request,env);return json(await Safety.mySafety(env,u.userId));}
  if(p==="/api/me/requests"&&m==="POST"){const u=await me(request,env);if(!await rate(env,"requests:"+u.userId,10,3600))return error("Please wait before submitting another request.",429);return json(await Safety.submitRequest(env,u.userId,await body(request)),201);}
  if(p==="/api/moderation/requests"&&m==="GET"){const u=await requireRole(request,env,"administrator");if(!u)return error("Administrator access required.",403);return json({items:await Safety.requestQueue(env)});}
  {const x=p.match(/^\/api\/moderation\/requests\/(\d+)$/);if(x&&m==="POST"){const u=await requireRole(request,env,"administrator");if(!u)return error("Administrator access required.",403);return json(await Safety.reviewRequest(env,u,Number(x[1]),await body(request)));}}
  if(p==="/api/community-ai")return error("AI features are disabled.",404);
  if(p==="/api/ministry/profiles"&&m==="GET")return json({organization:"Heavenly Key Evangelistic Movement",items:Editorial.ministryProfiles});
  if(p==="/api/ministry/admin/activation-preview"&&m==="GET"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Editorial.draftActivationPreview(env));}
  if(p==="/api/ministry/admin/activate-all"&&m==="POST"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);const input=await body(request);return json(await Editorial.activateAllDrafts(env,admin.userId,Number(input.expectedCount)));}
  if(p==="/api/ministry/posts"&&m==="GET")return json({items:await Editorial.listPosts(env,Number(url.searchParams.get("before")||0))});
  if(p==="/api/ministry/posts"&&m==="POST"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Editorial.publish(env,await body(request),admin.userId),201);}
  {const match=p.match(/^\/api\/ministry\/posts\/(\d+)$/);if(match&&["PATCH","DELETE"].includes(m)){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Editorial.changePost(env,Number(match[1]),admin.userId,m==="PATCH"?"edit":"remove",m==="PATCH"?await body(request):{}));}}
  if(p==="/api/ministry/messages"&&m==="POST"){const u=await me(request,env);return json(await Editorial.sendMessage(env,u.userId,await body(request)),201);}
  if(p==="/api/ministry/messages"&&m==="GET"){const u=await me(request,env);return json({items:await Editorial.myMessages(env,u.userId,String(url.searchParams.get("profileId")||""))});}
  if(p==="/api/ministry/admin/inbox"&&m==="GET"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json({items:await Editorial.adminInbox(env)});}
  if(p==="/api/ministry/admin/reply"&&m==="POST"){const admin=await requireRole(request,env,"administrator");if(!admin)return error("Administrator access required.",403);return json(await Editorial.reply(env,await body(request),admin.userId),201);}
  if(p==="/api/active/preferences"&&m==="GET"){const u=await me(request,env);return json(await Active.preferences(env,u.userId));}
  if(p==="/api/active/preferences"&&m==="PATCH"){const u=await me(request,env);return json(await Active.updatePreferences(env,u.userId,await body(request)));}
  if(p==="/api/active"&&m==="GET"){const u=await me(request,env);return json({items:await Active.list(env,u.userId),...await Active.preferences(env,u.userId)});}
  {const a=p.match(/^\/api\/active\/(\d+)$/);if(a){const u=await me(request,env),id=Number(a[1]);if(!Number.isSafeInteger(id)||id<1)return error('This ACTIVE content is unavailable.',404);if(m==='GET'){const items=await Active.list(env,u.userId,id);return items.length?json({item:items[0]}):error('This ACTIVE content is unavailable.',404);}if(m==='POST')return json(await Active.publish(env,u.userId,id),201);if(m==='DELETE')return json(await Active.remove(env,u.userId,id));}}
  if(p==="/api/me"&&m==="GET"){const u=await me(request,env);return json({user:u,profile:await S.publicProfile(env,u.userId,u.userId),growth:await S.growthSummary(env,u.userId)});}
  if(p==="/api/me/profile"&&m==="PATCH"){const u=await me(request,env);await S.updateProfile(env,u.userId,await body(request));return json({ok:true,profile:await S.publicProfile(env,u.userId,u.userId)});}

  {const x=p.match(/^\/api\/profiles\/(\d+)$/);if(x&&m==="GET"){const viewer=await getSession(request,env),profile=await S.publicProfile(env,Number(x[1]),viewer?.userId||null);return profile?json({profile}):error("Profile not found.",404);}}
  {const x=p.match(/^\/api\/global-connect\/(profile|space)\/(\d+)$/);if(x&&m==="POST"){const u=await me(request,env);return json(await S.toggleGlobalConnect(env,u.userId,x[1] as any,Number(x[2])));}}
  {const x=p.match(/^\/api\/global-connections\/(\d+)$/);if(x&&m==="GET"){const viewer=await getSession(request,env),profile=await S.publicProfile(env,Number(x[1]),viewer?.userId||null);if(!profile)return error("Profile not found.",404);if(profile.globalConnections===null&&viewer?.userId!==Number(x[1]))return error("This member keeps their Global Connections private.",403);return json({items:await S.listConnections(env,Number(x[1]))});}}

  if(p==="/api/spaces"&&m==="GET"){const u=await getSession(request,env);return json({items:await S.listSpaces(env,url.searchParams.get("category")||undefined,u?.userId||null)});}
  if(p==="/api/spaces"&&m==="POST"){const u=await me(request,env);return json(await S.createSpace(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/spaces\/([a-z0-9-]+)$/);if(x&&m==="GET"){const space=await S.getSpace(env,x[1]);if(!space)return error("Space not found.",404);const u=await getSession(request,env);let canManage=false;if(u)canManage=!!await env.DB.prepare("SELECT 1 FROM space_members WHERE space_id=? AND user_id=?").bind(space.space_id,u.userId).first();let canEdit=false,connected=false;if(u){canEdit=!!await env.DB.prepare("SELECT 1 FROM space_members WHERE space_id=? AND user_id=? AND role IN ('owner','administrator')").bind(space.space_id,u.userId).first();connected=!!await env.DB.prepare("SELECT 1 FROM global_connections WHERE user_id=? AND target_type='space' AND target_id=?").bind(u.userId,space.space_id).first();}return json({space:{...space,canManage,canEdit,connected}});}if(x&&m==="PATCH"){const u=await me(request,env),space=await S.getSpace(env,x[1]);if(!space)return error("Space not found.",404);return json(await S.updateSpace(env,u.userId,space.space_id,await body(request)));}}

  if(p==="/api/groups"&&m==="GET"){const u=await getSession(request,env);return json({items:await S.listGroups(env,u?.userId||null)});}
  {const x=p.match(/^\/api\/groups\/(\d+)$/);if(x&&m==='GET'){const u=await getSession(request,env);return json({group:await S.groupDetail(env,u?.userId||null,Number(x[1]))});}if(x&&m==='PATCH'){const u=await me(request,env);return json(await S.updateGroup(env,u.userId,Number(x[1]),await body(request)));}}
  {const x=p.match(/^\/api\/groups\/(\d+)\/members$/);if(x&&m==='GET'){const u=await me(request,env);return json({items:await S.groupMembers(env,u.userId,Number(x[1]))});}}
  {const x=p.match(/^\/api\/groups\/(\d+)\/members\/(\d+)$/);if(x&&m==='POST'){const u=await me(request,env);return json(await S.manageGroupMember(env,u.userId,Number(x[1]),Number(x[2]),await body(request)));}}
  {const x=p.match(/^\/api\/groups\/(\d+)\/leave$/);if(x&&m==='POST'){const u=await me(request,env);return json(await S.leaveGroup(env,u.userId,Number(x[1])));}}
  if(p==="/api/groups"&&m==="POST"){const u=await me(request,env);return json(await S.createGroup(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/groups\/(\d+)\/join$/);if(x&&m==="POST"){const u=await me(request,env);return json(await S.joinGroup(env,u.userId,Number(x[1])));}}

  if(p==="/api/feed"&&m==="GET"){const u=await getSession(request,env);const options={before:url.searchParams.get("before"),groupId:url.searchParams.get("groupId"),spaceId:url.searchParams.get("spaceId"),postId:url.searchParams.get("postId"),type:url.searchParams.get("type"),connections:url.searchParams.get("connections")==="1",saved:url.searchParams.get("saved")==="1"};const items=await S.feed(env,u?.userId||null,20,options);return json({items,nextBefore:items.length===20?items[items.length-1].post_id:null});}
  {const x=p.match(/^\/api\/posts\/(\d+)$/);if(x&&m==="PATCH"){const u=await me(request,env);return json(await S.editPost(env,u,Number(x[1]),await body(request)));}}
  {const x=p.match(/^\/api\/posts\/(\d+)\/save$/);if(x&&m==='POST'){const u=await me(request,env);return json(await S.savePost(env,u.userId,Number(x[1])));}}
  if(p==="/api/posts"&&m==="POST"){const u=await me(request,env);return json(await S.createPost(env,u,await body(request)),201);}
  {const x=p.match(/^\/api\/posts\/(\d+)\/reactions$/);if(x&&m==="POST"){const u=await me(request,env),b=await body(request);return json(await S.toggleReaction(env,u.userId,Number(x[1]),String(b.reactionType||"")));}}

  {const x=p.match(/^\/api\/groups\/(\d+)\/requests$/);if(x&&m==='GET'){const u=await me(request,env);return json({items:await S.groupRequests(env,u.userId,Number(x[1]))});}}
  {const x=p.match(/^\/api\/groups\/(\d+)\/requests\/(\d+)$/);if(x&&m==='POST'){const u=await me(request,env),b=await body(request);if(!['accept','decline'].includes(b.decision))return error('Choose accept or decline.');return json(await S.decideGroupRequest(env,u.userId,Number(x[1]),Number(x[2]),b.decision==='accept'));}}
  if(p==='/api/calls/config'&&m==='GET'){const u=await me(request,env);return json(await Calls.config(env,u.userId));}
  if(p==='/api/calls'&&m==='GET'){const u=await me(request,env);return json({items:await Calls.incoming(env,u.userId)});}
  if(p==='/api/calls'&&m==='POST'){const u=await me(request,env);if(!await rate(env,'call:'+u.userId,10,3600))return error('Please wait before making another call.',429);return json(await Calls.start(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/calls\/([a-f0-9-]{36})$/);if(x&&m==='GET'){const u=await me(request,env);return json(await Calls.read(env,u.userId,x[1]));}if(x&&m==='POST'){const u=await me(request,env);return json(await Calls.update(env,u.userId,x[1],await body(request)));}}

  if(p==="/api/messages"&&m==="GET"){const u=await me(request,env);return json({items:await S.inbox(env,u.userId)});}
  if(p==="/api/messages/requests"&&m==="POST"){const u=await me(request,env),b=await body(request);return json(await S.requestConversation(env,u.userId,Number(b.recipientUserId)),201);}
  {const x=p.match(/^\/api\/messages\/(\d+)\/decision$/);if(x&&m==="POST"){const u=await me(request,env),b=await body(request);if(!["accept","decline"].includes(b.decision))return error("Choose accept or decline.");return json(await S.decideConversation(env,u.userId,Number(x[1]),b.decision==="accept"));}}
  {const x=p.match(/^\/api\/messages\/(\d+)$/);if(x&&m==="GET"){const u=await me(request,env);const cursor=url.searchParams.get("before"),items=await S.messages(env,u.userId,Number(x[1]),cursor===null?undefined:Number(cursor));return json({items,nextBefore:items.length===100?items[0].message_id:null});}}
  {const x=p.match(/^\/api\/messages\/(\d+)$/);if(x&&m==="POST"){const u=await me(request,env),b=await body(request);return json(await S.sendMessage(env,u.userId,Number(x[1]),String(b.body||""),b.clientRequestId),201);}}

  if(p==="/api/prayer-circles"&&m==="GET"){const u=await getSession(request,env);return json({items:await S.listPrayerCircles(env,u?.userId||null)});}
  if(p==="/api/prayer-circles"&&m==="POST"){const u=await me(request,env);return json(await S.createPrayerCircle(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/prayer-circles\/(\d+)\/join$/);if(x&&m==="POST"){const u=await me(request,env);return json(await S.joinPrayerCircle(env,u.userId,Number(x[1])));}}

  if(p==="/api/today-with-god"&&m==="GET")return json({today:await S.today(env)});
  if(p==="/api/growth/checkin"&&m==="POST"){const u=await me(request,env);return json(await S.saveCheckin(env,u.userId,await body(request)));}
  if(p==="/api/growth"&&m==="GET"){const u=await me(request,env);return json({summary:await S.growthSummary(env,u.userId)});}
  if(p==="/api/discipleship/tracks"&&m==="GET"){const u=await getSession(request,env);return json({items:await S.discipleshipTracks(env,u?.userId||null)});}
  {const x=p.match(/^\/api\/discipleship\/lessons\/(\d+)\/complete$/);if(x&&m==="POST"){const u=await me(request,env),b=await body(request);return json(await S.completeLesson(env,u.userId,Number(x[1]),String(b.reflection||"")));}}

  if(p==="/api/salvation"&&m==="POST"){if(!await rate(env,"salvation-source:"+await sourceKey(request),10,3600))return error("Please wait before submitting again.",429);const u=await getSession(request,env);return json(await S.salvationDecision(env,u?.userId||null,await body(request)),201);}
  if(p==="/api/notifications/read"&&m==="POST"){const u=await me(request,env),b=await body(request);return json(await S.readNotifications(env,u.userId,b.ids));}
  if(p==="/api/notifications"&&m==="GET"){const u=await me(request,env);return json({items:await S.notifications(env,u.userId),unreadCount:await S.unreadNotificationCount(env,u.userId)});}
  if(p==="/api/discover"&&m==="GET"){const u=await getSession(request,env);return json({items:await S.discoverProfiles(env,u?.userId||null,url.searchParams.get("q")||"",url.searchParams.get("country")||"")});}
  {const x=p.match(/^\/api\/posts\/(\d+)\/comments$/);if(x&&m==="GET"){const u=await getSession(request,env);return json({items:await S.listComments(env,Number(x[1]),u?.userId||null)});}}
  {const x=p.match(/^\/api\/posts\/(\d+)\/comments$/);if(x&&m==="POST"){const u=await me(request,env),b=await body(request);return json(await S.addComment(env,u.userId,Number(x[1]),String(b.body||""),b.parentCommentId?Number(b.parentCommentId):undefined),201);}}
  {const x=p.match(/^\/api\/members\/(\d+)\/block$/);if(x&&m==="POST"){const u=await me(request,env);return json(await S.blockMember(env,u.userId,Number(x[1])));}}
  {const x=p.match(/^\/api\/groups\/(\d+)\/reports(?:\/(\d+)\/review)?$/);if(x){const u=await me(request,env);if(m==='GET'&&!x[2])return json({items:await Stewardship.groupReports(env,u,Number(x[1]))});if(m==='POST'&&x[2])return json(await Stewardship.reviewGroupReport(env,u,Number(x[1]),Number(x[2]),await body(request)));}}
  if(p==='/api/moderation/flags'&&m==='GET'){const u=await requireRole(request,env,'moderator');if(!u)return error('Site moderator access required.',403);return json({items:await Stewardship.flagQueue(env,u)});}
  {const x=p.match(/^\/api\/moderation\/flags\/(\d+)\/review$/);if(x&&m==='POST'){const u=await requireRole(request,env,'moderator');if(!u)return error('Site moderator access required.',403);return json(await Stewardship.reviewFlag(env,u,Number(x[1]),await body(request)));}}
  if(p==='/api/moderation/accounts'&&m==='GET'){const u=await requireRole(request,env,'administrator');if(!u)return error('Site administrator access required.',403);return json({items:await Stewardship.accountQueue(env,u)});}
  {const x=p.match(/^\/api\/moderation\/accounts\/(\d+)$/);if(x&&m==='POST'){const u=await requireRole(request,env,'administrator');if(!u)return error('Site administrator access required.',403);return json(await Stewardship.restrictAccount(env,u,Number(x[1]),await body(request)));}}
  if(p==="/api/reports"&&m==="POST"){const u=await me(request,env);if(!await rate(env,"reports:"+u.userId,20,3600))return error("Please wait before sending another report.",429);return json(await S.reportContent(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/prayer-items\/(\d+)(?:\/(support|reminder|updates))?$/);if(x){const u=await me(request,env);Care.requireCare(env);const id=Number(x[1]);if(!Number.isSafeInteger(id)||id<1)return error('Invalid prayer request.');if(!x[2]&&m==='GET')return json(await Care.prayer(env,u.userId,id));if(!x[2]&&m==='DELETE'){const b=await body(request);return json(await Care.updatePrayer(env,u.userId,id,{kind:'closed',body:'',requestKey:b.requestKey}));}if(x[2]==='support'&&m==='DELETE')return json(await Care.stopSupport(env,u.userId,id));if(x[2]==='support'&&m==='PATCH')return json(await Care.support(env,u.userId,id,await body(request)));if(x[2]==='reminder'&&m==='PATCH')return json(await Care.reminder(env,u.userId,id,await body(request)));if(x[2]==='updates'&&m==='POST')return json(await Care.updatePrayer(env,u.userId,id,await body(request)));}}
  if(p==="/api/prayer-items"&&m==="GET"){const u=await getSession(request,env);return json({items:Care.enabled(env)?await Care.listPrayers(env,u?.userId||null):await S.listPrayerItems(env,u?.userId||null)});}
  if(p==="/api/prayer-items"&&m==="POST"){const u=await me(request,env);return json(await S.addPrayerItem(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/prayer-items\/(\d+)\/answered$/);if(x&&m==="POST"){const u=await me(request,env),b=await body(request);const result=Care.enabled(env)?await Care.updatePrayer(env,u.userId,Number(x[1]),{kind:"testimony",body:String(b.testimony||""),requestKey:crypto.randomUUID()}):await S.markPrayerAnswered(env,u.userId,Number(x[1]),String(b.testimony||""));return json({...result,answered:true});}}
  if(p==="/api/media-policy"&&m==="GET")return json(await S.mediaPolicy(env));
  if(p==="/api/media"&&m==="GET"){const u=await me(request,env);return json({items:await S.listMyMedia(env,u.userId)});}
  if(p==="/api/media"&&m==="POST"){const u=await me(request,env);return json(await S.registerMedia(env,u.userId,await body(request)),201);}
  {const x=p.match(/^\/api\/media\/(\d+)\/object$/);if(x&&m==="PUT"){const u=await me(request,env);return json(await S.uploadMedia(env,u.userId,Number(x[1]),request),201);}
   if(x&&m==="GET"){const media=await S.publicMedia(env,Number(x[1]));if(!media)return error("Media unavailable.",404);const h=security(new Headers({"Content-Type":media.mimeType,"Cache-Control":"public, max-age=300"}));if(media.etag)h.set("ETag",media.etag);return new Response(media.body,{status:200,headers:h});}}
  if(p==="/api/moderation/media"&&m==="GET"){const admin=await requireRole(request,env,"moderator");if(!admin)return error("Moderator access required.",403);return json({items:await S.pendingMedia(env)});}
  {const x=p.match(/^\/api\/moderation\/media\/(\d+)\/(approve|reject)$/);if(x&&m==="POST"){const admin=await requireRole(request,env,"moderator");if(!admin)return error("Moderator access required.",403);const b=await body(request);return json(await S.reviewMedia(env,Number(x[1]),x[2]==="approve",String(b.reason||"")));}}
  if(p==="/api/moderation/queue"&&m==="GET"){const admin=await requireRole(request,env,"moderator");if(!admin)return error("Moderator access required.",403);return json({items:await S.moderationQueue(env)});}
  {const x=p.match(/^\/api\/moderation\/reports\/(\d+)\/review$/);if(x&&m==="POST"){const admin=await requireRole(request,env,"moderator");if(!admin)return error("Moderator access required.",403);return json(await S.reviewPostReport(env,admin,Number(x[1]),await body(request)));}}
  if(p==="/api/moderation/reports"&&m==="GET"){const admin=await requireRole(request,env,"moderator");if(!admin)return error("Moderator access required.",403);return json({items:await S.reportQueue(env)});}

  return error("API route not found.",404);
}

export default {
  async scheduled(_event:ScheduledController,env:Env):Promise<void>{
    const jobs=[['call-cleanup',()=>Calls.cleanup(env)],['social-flow-cleanup',()=>env.DB.prepare("DELETE FROM social_login_flows WHERE expires_at<?").bind(Date.now()).run()],['session-revocation-cleanup',()=>env.DB.prepare("DELETE FROM revoked_sessions WHERE expires_at<=?").bind(Date.now()).run()],['community-care',()=>Care.deliverDue(env)]] as const;
    const results=await Promise.allSettled(jobs.map(async([,run])=>run()));
    const failed=results.flatMap((r,i)=>r.status==='rejected'?[jobs[i][0]]:[]);
    if(failed.length)throw new Error('Scheduled tasks failed: '+failed.join(', '));
  },
  async fetch(request:Request,env:Env,ctx?:ExecutionContext):Promise<Response>{
    try{return await route(request,env,ctx);}
    catch(e:any){const internal=e instanceof TypeError||e instanceof ReferenceError||e instanceof SyntaxError||/D1_|SQLITE|constraint failed|no such table|binding|TypeError/i.test(String(e?.message))||!(e instanceof Error);return error(internal?"The request could not be completed. Please try again.":e.message,internal?500:Number((e as any)?.status)||400);}
  }
};



