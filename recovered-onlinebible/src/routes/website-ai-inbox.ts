import { requireMinimumRole } from "../middleware/rbac";
import type { Env } from "../services/auth-service";
import { withSecurityHeaders } from "./auth";
const reply=(data:unknown,status=200)=>withSecurityHeaders(Response.json(data,{status}));
type Period="all"|"week"|"month"|"year"|"last_year";
const periods:Period[]=["all","week","month","year","last_year"];
function stamp(d:Date){return d.toISOString().slice(0,19).replace("T"," ")}
function cutoff(p:Period):string|null{
 const now=new Date(),year=now.getUTCFullYear(),month=now.getUTCMonth();
 if(p==="week"){const d=new Date(now);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));d.setUTCHours(0,0,0,0);return stamp(d);}
 if(p==="month")return stamp(new Date(Date.UTC(year,month,1)));
 if(p==="year")return stamp(new Date(Date.UTC(year,0,1)));
 if(p==="last_year")return stamp(new Date(Date.UTC(year-1,0,1)));
 return null;
}
function filter(p:Period){const from=cutoff(p);if(p==="all")return {sql:"1=1",args:[] as string[]};if(p==="last_year")return {sql:"created_at >= ? AND created_at < ?",args:[from!,stamp(new Date(Date.UTC(new Date().getUTCFullYear(),0,1)))]};return {sql:"created_at >= ?",args:[from!]};}
export async function handleWebsiteAiInbox(request:Request,env:Env):Promise<Response>{
 const actor=await requireMinimumRole(request,env,"Administrator");
 if(!actor)return reply({error:"Administrator access required."},403);
 const url=new URL(request.url),period=url.searchParams.get("period") as Period||"all";
 if(!periods.includes(period))return reply({error:"Invalid period."},400);
 const db=env.DB,where=filter(period);
 if(request.method==="GET"){
   const rows=await db.prepare("SELECT id,status,visitor_name,visitor_phone,visitor_email,contact_consent,created_at,updated_at FROM website_ai_conversations WHERE "+where.sql+" ORDER BY created_at DESC LIMIT 200").bind(...where.args).all();
   return reply({conversations:rows.results,period});
 }
 if(request.method==="DELETE"){
   const body=await request.json<{confirm?:string}>().catch(()=>({confirm:""}));
   if(body.confirm!=="DELETE "+period.toUpperCase())return reply({error:"Type DELETE "+period.toUpperCase()+" to confirm permanent deletion."},400);
   // Delete messages only for matching conversations, then the conversation rows.
   const whereClause=where.sql.replaceAll("created_at","website_ai_conversations.created_at");
   const convSql="SELECT id FROM website_ai_conversations WHERE "+whereClause;
   const batch=[
     db.prepare("DELETE FROM website_ai_messages WHERE conversation_id IN ("+convSql+")").bind(...where.args),
     db.prepare("DELETE FROM website_ai_conversations WHERE "+where.sql).bind(...where.args)
   ];
   await db.batch(batch);
   return reply({success:true,period});
 }
 return reply({error:"Method not allowed"},405);
}
export async function handleWebsiteAiConversation(request:Request,env:Env,id:string):Promise<Response>{
 const actor=await requireMinimumRole(request,env,"Administrator");
 if(!actor)return reply({error:"Administrator access required."},403);
 if(!/^[a-zA-Z0-9_-]{8,100}$/.test(id))return reply({error:"Invalid ID"},400);
 if(request.method==="GET"){
   const conversation=await env.DB.prepare("SELECT * FROM website_ai_conversations WHERE id=?").bind(id).first();
   if(!conversation)return reply({error:"Not found"},404);
   const messages=await env.DB.prepare("SELECT speaker,body,created_at FROM website_ai_messages WHERE conversation_id=? ORDER BY id ASC LIMIT 500").bind(id).all();
   return reply({conversation,messages:messages.results});
 }
 if(request.method==="PATCH"){
   const data=await request.json<{status?:string}>().catch(()=>({status:""}));
   if(!["new","contacted","in_progress","resolved"].includes(data.status||""))return reply({error:"Invalid status"},400);
   await env.DB.prepare("UPDATE website_ai_conversations SET status=?,updated_at=datetime('now') WHERE id=?").bind(data.status,id).run();
   return reply({success:true});
 }
 return reply({error:"Method not allowed"},405);
}
