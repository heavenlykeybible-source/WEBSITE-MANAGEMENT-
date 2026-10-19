import type { Env } from "../services/auth-service";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import * as WhatsApp from "../services/whatsapp-management-service";
import * as Command from "../services/ministry-command-center-service";
import * as Social from "../services/social-management-service";
import { createMediaEngineCapability, mediaEngineRequest } from "../services/integrations/media-engine-client";

const json=(data:unknown,status=200)=>withSecurityHeaders(Response.json(data,{status}));
const error=(message:string,status=400)=>json({error:{message}},status);
async function audit(env:Env,actor:number,action:string,targetType:string,targetId:number|null,reason?:string){
  await env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,reason,result) VALUES(?,?,?,?,?,'success')")
    .bind(actor,action,targetType,targetId,reason||null).run();
}

export async function handleWhatsAppWebhook(request:Request,env:Env){
  if(request.method==="GET")return Command.verify(request,env);
  if(request.method==="POST")return Command.webhook(request,env);
  return new Response("Method not allowed",{status:405});
}
export async function handleWhatsAppConnection(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  if(request.method==="GET"){const numbers=await Command.listNumbers(env);return json({connection:numbers.find((x:any)=>x.is_default)||numbers[0]||null,numbers});}
  try{const body=await request.json<any>();const result=await Command.saveNumber(env,body);await audit(env,actor.userId,"whatsapp.connection.save","whatsapp_account",null,String(body.phone_number_id||""));return json(result,201);}catch(e){return error(e instanceof Error?e.message:"WhatsApp connection could not be saved.");}
}
export async function handleWhatsAppConversations(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  const limit=Number(new URL(request.url).searchParams.get("limit")||100);return json({items:await Command.listConversations(env,limit)});
}
export async function handleWhatsAppConversation(request:Request,env:Env,id:number,action?:string){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  if(request.method==="GET"&&!action){const result=await Command.getConversation(env,id);return result?json(result):error("Conversation not found.",404);}
  if(request.method!=="POST")return error("Method not allowed.",405);
  try{
    const body=await request.json<any>().catch(()=>({}));
    if(action==="reply"){const result=await Command.adminReply(env,id,String(body.body||""));await audit(env,actor.userId,"whatsapp.reply","whatsapp_conversation",id);return json({ok:true,...result});}
    if(action==="resolve"){const r=await env.DB.prepare("UPDATE whatsapp_conversations SET status='resolved',unread_count=0,updated_at=CURRENT_TIMESTAMP WHERE conversation_id=?").bind(id).run();if(!r.meta.changes)return error("Conversation not found.",404);await env.DB.prepare("UPDATE whatsapp_notifications SET status='resolved',updated_at=CURRENT_TIMESTAMP WHERE conversation_id=? AND status!='resolved'").bind(id).run();await audit(env,actor.userId,"whatsapp.resolve","whatsapp_conversation",id);return json({ok:true});}
    if(action==="assign"){const target=body.user_id==null?null:Number(body.user_id);if(target!==null&&!Number.isSafeInteger(target))return error("Choose a valid administrator.");const r=await env.DB.prepare("UPDATE whatsapp_conversations SET assigned_to=?,updated_at=CURRENT_TIMESTAMP WHERE conversation_id=?").bind(target,id).run();if(!r.meta.changes)return error("Conversation not found.",404);await audit(env,actor.userId,"whatsapp.assign","whatsapp_conversation",id,target==null?"unassigned":"assigned to "+target);return json({ok:true});}
    return error("Unknown WhatsApp action.",404);
  }catch(e){return error(e instanceof Error?e.message:"WhatsApp action failed.");}
}
export async function handleWhatsAppContact(request:Request,env:Env,id:number){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  if(request.method!=="POST")return error("Method not allowed.",405);
  const body=await request.json<any>().catch(()=>({})),mode=String(body.access_mode||"");
  if(!["active","human_only","website_only","blocked"].includes(mode))return error("Invalid contact access mode.");
  const notes=body.notes==null?null:String(body.notes).slice(0,2000);
  const r=await env.DB.prepare("UPDATE whatsapp_contacts SET access_mode=?,notes=COALESCE(?,notes),updated_at=CURRENT_TIMESTAMP WHERE contact_id=?").bind(mode,notes,id).run();if(!r.meta.changes)return error("WhatsApp contact not found.",404);
  await audit(env,actor.userId,"whatsapp.contact.access","whatsapp_contact",id,mode);return json({ok:true});
}
export async function handleWhatsAppNumbers(request:Request,env:Env,id?:number){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  try{
    if(request.method==="GET"&&!id)return json({items:await Command.listNumbers(env)});
    if(request.method==="POST"&&!id){const body=await request.json<any>();const result=await Command.saveNumber(env,body);await audit(env,actor.userId,"whatsapp.number.save","whatsapp_account",null,String(body.phone_number_id||""));return json(result,201);}
    if(request.method==="POST"&&id){const body=await request.json<any>();const result=await Command.updateNumber(env,id,body);await audit(env,actor.userId,"whatsapp.number.update","whatsapp_account",id);return json(result);}
    return error("Method not allowed.",405);
  }catch(e){return error(e instanceof Error?e.message:"WhatsApp number action failed.");}
}
export async function handleMinistryRequests(request:Request,env:Env,kind:string){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  if(request.method!=="GET")return error("Method not allowed.",405);
  if(kind==="prayer")return json({items:await Command.listPrayer(env)});
  if(kind==="partnership")return json({items:await Command.listPartnership(env)});
  if(kind==="evangelist")return json({items:await Command.listEvangelist(env)});
  return error("Unknown request type.",404);
}
export async function handleMinistryPrograms(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  try{
    if(request.method==="GET")return json({items:await Command.listPrograms(env)});
    if(request.method==="POST"){const body=await request.json<any>();const result=await Command.saveProgram(env,body,actor.userId);await audit(env,actor.userId,"ministry.program.save","ministry_program",result.program_id);return json(result,body.program_id?200:201);}
    return error("Method not allowed.",405);
  }catch(e){return error(e instanceof Error?e.message:"Program could not be saved.");}
}

export async function handleMinistryContacts(request:Request,env:Env){
 const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
 if(request.method!=="GET")return error("Method not allowed.",405);
 const limit=Number(new URL(request.url).searchParams.get("limit")||300);return json({items:await Command.listContacts(env,limit)});
}
export async function handleWhatsAppDirectAccess(request:Request,env:Env){
 const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
 if(request.method!=="POST")return error("Method not allowed.",405);
 try{const body=await request.json<any>();const result=await Command.saveDirectAccessContact(env,body);await audit(env,actor.userId,"whatsapp.direct_access.save","whatsapp_contact",Number(result?.contact_id)||null,String(result?.wa_id||""));return json({ok:true,contact:result},201);}catch(e){return error(e instanceof Error?e.message:"Direct access number could not be saved.");}
}
export async function handleMinistryFollowups(request:Request,env:Env,id?:number){
 const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
 try{
  if(request.method==="GET"&&!id){const limit=Number(new URL(request.url).searchParams.get("limit")||300);return json({items:await Command.listFollowups(env,limit)});}
  if(request.method==="POST"&&!id){const body=await request.json<any>();const result=await Command.saveFollowup(env,body);await audit(env,actor.userId,"ministry.followup.create","ministry_followup",result.followup_id);return json(result,201);}
  if(request.method==="POST"&&id){const body=await request.json<any>();const result=await Command.updateFollowup(env,id,body);await audit(env,actor.userId,"ministry.followup.update","ministry_followup",id,String(body.status||"pending"));return json(result);}
  return error("Method not allowed.",405);
 }catch(e){return error(e instanceof Error?e.message:"Follow-up action failed.");}
}
export async function handleMinistryActivity(request:Request,env:Env){
 const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
 if(request.method!=="GET")return error("Method not allowed.",405);
 const limit=Number(new URL(request.url).searchParams.get("limit")||200);return json({items:await Command.listActivity(env,limit)});
}
export async function handleMinistrySettings(request:Request,env:Env){
 const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
 try{if(request.method==="GET")return json({settings:await Command.getSettings(env)});if(request.method==="POST"){const body=await request.json<Record<string,unknown>>();return json({settings:await Command.saveSettings(env,body,actor.userId)});}return error("Method not allowed.",405);}catch(e){return error(e instanceof Error?e.message:"Ministry settings could not be saved.");}
}
export async function handleMinistryRequestStatus(request:Request,env:Env,kind:"prayer"|"partnership"|"evangelist",id:number){
 const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
 if(request.method!=="POST")return error("Method not allowed.",405);
 try{const body=await request.json<any>();const result=await Command.updateRequestStatus(env,kind,id,String(body.status||""));await audit(env,actor.userId,"ministry."+kind+".status","ministry_request",id,String(body.status||""));return json(result);}catch(e){return error(e instanceof Error?e.message:"Request status update failed.");}
}
export async function handleMinistryDashboard(request:Request,env:Env){
 const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
 if(request.method!=="GET")return error("Method not allowed.",405);return json(await Command.dashboardSummary(env));
}

export async function handleWhatsAppNotifications(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  const r=await env.DB.prepare("SELECT * FROM whatsapp_notifications WHERE status!='resolved' ORDER BY CASE status WHEN 'unread' THEN 0 ELSE 1 END,created_at DESC LIMIT 200").all();return json({items:r.results});
}
export async function handleWhatsAppNotificationAction(request:Request,env:Env,id:number){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  const body=await request.json<any>().catch(()=>({})),status=String(body.status||"read");if(!["read","resolved"].includes(status))return error("Invalid notification status.");
  const r=await env.DB.prepare("UPDATE whatsapp_notifications SET status=?,updated_at=CURRENT_TIMESTAMP WHERE notification_id=?").bind(status,id).run();if(!r.meta.changes)return error("Notification not found.",404);
  await audit(env,actor.userId,"whatsapp.notification."+status,"whatsapp_notification",id);return json({ok:true});
}

export async function handleSocialSetup(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  return json({providers:await Social.setupStatus(env,new URL(request.url).origin)});
}
export async function handleSocialProviderApps(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  if(request.method==="GET")return json({providers:await Social.setupStatus(env,new URL(request.url).origin)});
  try{
    const body=await request.json<any>(),platform=String(body.platform||"") as Social.SocialPlatform;
    if(body.action==="remove"){await Social.removeProviderApp(env,platform);await audit(env,actor.userId,"social.provider-app.remove","social_provider_app",null,platform);return json({ok:true,platform});}
    const result=await Social.saveProviderApp(env,platform,String(body.client_id||""),String(body.client_secret||""),actor.userId);
    await audit(env,actor.userId,"social.provider-app.save","social_provider_app",null,platform);
    return json(result,201);
  }catch(e){return error(e instanceof Error?e.message:"Provider app configuration failed.");}
}

export async function handleSocialConnectionStart(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  try{const platform=new URL(request.url).searchParams.get("platform") as Social.SocialPlatform;const result=await Social.startConnection(env,platform,actor.userId,new URL(request.url).origin);return json(result);}catch(e){return error(e instanceof Error?e.message:"Social connection could not start.",503);}
}
export async function handleSocialConnectionCallback(request:Request,env:Env){
  const url=new URL(request.url),state=url.searchParams.get("state")||"";
  if(url.searchParams.get("error")){
    if(state)await env.DB.prepare("UPDATE social_connection_states SET status='cancelled' WHERE state_id=? AND status='pending'").bind(state).run();
    const target=new URL("/pages/admin",request.url);target.searchParams.set("social_error",url.searchParams.get("error_description")||url.searchParams.get("error")||"Authorization was cancelled.");target.hash="autopost";
    return Response.redirect(target,303);
  }
  try{
    const result=await Social.completeConnection(env,url);
    if(result.requires_selection){
      const target=new URL("/pages/admin",request.url);target.searchParams.set("social_select",String(result.state_id));target.hash="autopost";return Response.redirect(target,303);
    }
    if(result.created_by)await audit(env,result.created_by,"social.connection.complete","social_account",null,result.account_id);
    return Response.redirect(new URL("/pages/admin#autopost",request.url),303);
  }catch(e){
    const target=new URL("/pages/admin",request.url);target.searchParams.set("social_error",e instanceof Error?e.message:String(e));target.hash="autopost";return Response.redirect(target,303);
  }
}
export async function handleSocialConnectionSelection(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  const state=new URL(request.url).searchParams.get("state")||"";
  try{
    if(request.method==="GET")return json(await Social.getConnectionSelection(env,state,actor.userId));
    if(request.method==="POST"){
      const body=await request.json<any>();
      if(body.action==="cancel"){await Social.cancelConnectionSelection(env,state,actor.userId);return json({ok:true,cancelled:true});}
      const selections=Array.isArray(body.selection_ids)?body.selection_ids:String(body.selection_id||"");
      const result=await Social.completeConnectionSelection(env,state,selections,actor.userId);
      await audit(env,actor.userId,"social.connection.complete","social_account",null,result.account_id);
      return json({ok:true,...result});
    }
    return error("Method not allowed.",405);
  }catch(e){return error(e instanceof Error?e.message:"Social account selection failed.",400);}
}
export async function handleSocialAccounts(request:Request,env:Env,id?:string,action?:string){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  if(request.method==="GET"&&!id)return json({items:await Social.listAccounts(env)});
  if(!id||request.method!=="POST")return error("Method not allowed.",405);
  try{
    if(action==="state"){const b=await request.json<any>();await Social.setAccountState(env,id,Boolean(b.active));await audit(env,actor.userId,"social.account.state","social_account",null,id+":"+(b.active?"enabled":"disabled"));return json({ok:true});}
    if(action==="remove"){if(actor.level<4)return error("Owner or deputy access is required to remove a social account.",403);await Social.removeAccount(env,id);await audit(env,actor.userId,"social.account.remove","social_account",null,id);return json({ok:true});}
    return error("Unknown account action.",404);
  }catch(e){return error(e instanceof Error?e.message:"Social account action failed.");}
}
export async function handleSocialLiveAuthorization(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  if(request.method==="GET")return json({items:await Social.liveAuthorizationStatus(env)});
  try{
    const body=await request.json<any>(),platform=String(body.platform||"") as Social.SocialPlatform;
    if(platform==="tiktok")return error("TikTok live remains on the manual RTMP/stream-key connector.",400);
    const prepared=await Social.prepareAuthorizedLive(env,platform,{title:String(body.title||""),description:String(body.description||""),format:String(body.format||"landscape-720")});
    const cap=await createMediaEngineCapability(env,actor.userId,actor.roleName as any);
    const upstream=await mediaEngineRequest(env,cap,"/api/media-engine/restream/destination",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({destination:platform,url:prepared.url,enabled:true})});
    const result=await upstream.json<any>().catch(()=>({}));if(!upstream.ok)throw new Error(result?.error?.message||result?.error||"Media Engine could not save the authorized live destination.");
    await audit(env,actor.userId,"social.live.prepare","social_account",null,platform+":"+(prepared.provider_id||"prepared"));
    return json({ok:true,platform,provider_id:prepared.provider_id||null,destination:result});
  }catch(e){return error(e instanceof Error?e.message:"Authorized live destination could not be prepared.",400);}
}

export async function handleSocialLiveVerification(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");if(!actor)return error("Owner or deputy access is required.",403);
  if(request.method!=="POST")return error("Method not allowed.",405);
  try{
    const body=await request.json<any>(),platform=String(body.platform||"") as Social.SocialPlatform,providerId=String(body.provider_id||"");
    return json(await Social.verifyAuthorizedLive(env,platform,providerId));
  }catch(e){return error(e instanceof Error?e.message:"Live provider verification failed.",400);}
}

export async function handleSocialPublish(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  try{
    const body=await request.json<any>(),mode=body.publish_mode==="scheduled"?"scheduled":"post_now";
    const jobs=await Social.createPublishJobs(env,{account_ids:body.account_ids||[],text:body.text,media_ids:body.media_ids||[],media_type:body.media_type,publish_at:body.publish_at,publish_mode:mode},actor.userId);
    for(const id of jobs)await audit(env,actor.userId,mode==="post_now"?"social.publish.post_now":"social.publish.schedule","social_publish_job",id);
    if(mode==="scheduled")return json({job_ids:jobs,status:"queued",publish_mode:mode},202);
    const results=await Social.publishJobResults(env,jobs),failed=results.filter((x:any)=>x.status==="failed"),pending=results.filter((x:any)=>x.status==="publishing"),published=results.filter((x:any)=>x.status==="published");
    const status=failed.length===results.length?"failed":failed.length?"completed_with_errors":pending.length?"publishing":"published";
    return json({job_ids:jobs,status,publish_mode:mode,summary:{total:results.length,published:published.length,publishing:pending.length,failed:failed.length},results},201);
  }catch(e){return error(e instanceof Error?e.message:"Social publishing failed.",400);}
}
export async function handleSocialJobAction(request:Request,env:Env,id:number,action:string){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  if(request.method!=="POST"||!["retry","cancel"].includes(action))return error("Method not allowed.",405);
  try{
    if(action==="cancel"){const result=await Social.cancelScheduledJob(env,id);await audit(env,actor.userId,"social.publish.cancel","social_publish_job",id);return json({ok:true,result});}
    const result=await Social.retryJob(env,id);await audit(env,actor.userId,"social.publish.retry","social_publish_job",id);return json({ok:true,result});
  }catch(e){return error(e instanceof Error?e.message:"Publishing job action failed.",400);}
}
export async function handleSocialJobs(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Administrator");if(!actor)return error("Administrator access required.",403);
  const limit=Number(new URL(request.url).searchParams.get("limit")||100);return json({items:await Social.listJobs(env,limit)});
}
export async function handleSignedSocialMedia(request:Request,env:Env,id:number){
  const url=new URL(request.url),exp=Number(url.searchParams.get("exp")),sig=String(url.searchParams.get("sig")||"");
  if(!await Social.verifyMediaSignature(env,id,exp,sig))return new Response("Expired or invalid media link",{status:403});
  if(!env.MEDIA_ENGINE_URL||!env.MEDIA_ENGINE_SHARED_SECRET)return new Response("Media service unavailable",{status:503});
  try{const cap=await createMediaEngineCapability(env,0,"Administrator");const upstream=await mediaEngineRequest(env,cap,`/api/media/${id}/preview`,{method:request.method==="HEAD"?"HEAD":"GET",headers:request.headers.has("Range")?{Range:request.headers.get("Range")!}:{}});const headers=new Headers(upstream.headers);headers.set("Cache-Control","private, max-age=300");headers.set("Access-Control-Allow-Origin","*");return new Response(upstream.body,{status:upstream.status,headers});}catch{return new Response("Media unavailable",{status:503});}
}
