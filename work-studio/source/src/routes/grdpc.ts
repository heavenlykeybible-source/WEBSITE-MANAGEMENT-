
import type {Env} from "../services/auth-service";
import {requireMinimumRole} from "../middleware/rbac";
import {withSecurityHeaders} from "./auth";
import {settings,saveSettings,TEMPLATE_BODY} from "../services/grdpc-service";
const json=(d:unknown,status=200)=>withSecurityHeaders(Response.json(d,{status,headers:{"Cache-Control":"no-store"}}));
export async function handleGRDPCPublic(request:Request,env:Env){
 const c=await settings(env);return json({phone:c.phone,enabled:c.enabled});
}
export async function handleGRDPCAdmin(request:Request,env:Env){
 const actor=await requireMinimumRole(request,env,request.method==="GET"?"Administrator":"Deputy Super Administrator");if(!actor)return json({error:{message:"Authorized administrator access required."}},403);
 if(request.method==="POST"){try{const c=await saveSettings(env,await request.json());await env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,reason,result) VALUES(?,'grdpc.settings','grdpc',1,?,'success')").bind(actor.userId,c.enabled?"enabled":"paused").run();return json({config:c});}catch(e){return json({error:{message:e instanceof Error?e.message:"Unable to save reminders."}},400);}}
 const counts=await env.DB.prepare("SELECT status,COUNT(*) AS total FROM grdpc_subscribers GROUP BY status").all();
 const deliveries=await env.DB.prepare("SELECT slot,status,COUNT(*) AS total FROM grdpc_deliveries GROUP BY slot,status ORDER BY slot DESC LIMIT 30").all();
 return json({config:await settings(env),counts:counts.results,deliveries:deliveries.results,templateBody:TEMPLATE_BODY});
}
