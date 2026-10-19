import type { Env } from "../services/auth-service";
import { requireMinimumRole, getRoleLevel, canActorActOnTarget } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";

const json=(data:unknown,status=200)=>withSecurityHeaders(Response.json(data,{status}));
const fail=(message:string,status=400)=>json({error:{message}},status);

export async function handleAdminUsers(request:Request,env:Env){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");
  if(!actor)return fail("Owner or deputy access is required.",403);
  const url=new URL(request.url),q=(url.searchParams.get("q")||"").trim().slice(0,120);
  const rows=q
    ? await env.DB.prepare(`SELECT u.user_id,u.name,u.email,u.country,u.status,u.created_at,r.role_name
       FROM users u JOIN roles r ON r.role_id=u.role_id
       WHERE (u.name LIKE ? OR u.email LIKE ?) ORDER BY u.created_at DESC LIMIT 100`).bind("%"+q+"%","%"+q+"%").all<any>()
    : await env.DB.prepare(`SELECT u.user_id,u.name,u.email,u.country,u.status,u.created_at,r.role_name
       FROM users u JOIN roles r ON r.role_id=u.role_id ORDER BY u.created_at DESC LIMIT 100`).all<any>();
  const items=(rows.results||[]).map((row:any)=>({...row,role_level:getRoleLevel(String(row.role_name)),can_manage:row.user_id!==actor.userId&&actor.level>getRoleLevel(String(row.role_name))}));
  return json({items,actor:{user_id:actor.userId,role_name:actor.roleName,role_level:actor.level}});
}

export async function handleAdminUserRole(request:Request,env:Env,targetUserId:number){
  const actor=await requireMinimumRole(request,env,"Deputy Super Administrator");
  if(!actor)return fail("Owner or deputy access is required.",403);
  if(targetUserId===actor.userId)return fail("You cannot change your own administrator role.",400);
  const body=await request.json<{roleName?:string}>().catch(()=>null);
  const roleName=body?.roleName?.trim()||"";
  const allowed=["Member","Moderator","Administrator","Deputy Super Administrator"];
  if(!allowed.includes(roleName))return fail("Choose a valid assignable role.");
  const desiredLevel=getRoleLevel(roleName);
  if(desiredLevel<0||desiredLevel>=actor.level)return fail("You can only assign a role below your own level.",403);
  const target=await env.DB.prepare(`SELECT u.user_id,u.name,u.email,u.status,r.role_name
    FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=?`).bind(targetUserId).first<any>();
  if(!target)return fail("User not found.",404);
  if(target.status!=="active")return fail("Only active users can be assigned administrator roles.");
  if(!await canActorActOnTarget(env,actor.userId,targetUserId))return fail("You cannot change the role of this user.",403);
  const role=await env.DB.prepare("SELECT role_id FROM roles WHERE role_name=?").bind(roleName).first<{role_id:number}>();
  if(!role)return fail("Role configuration is unavailable.",500);
  const previous=String(target.role_name);
  if(previous===roleName)return json({ok:true,roleName,message:"No change was needed."});
  await env.DB.prepare("UPDATE users SET role_id=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?").bind(role.role_id,actor.userId,targetUserId).run();
  await env.DB.prepare("INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,reason,result) VALUES(?,'account.role.change','user',?,?, 'success')").bind(actor.userId,targetUserId,previous+" -> "+roleName).run();
  return json({ok:true,roleName,message:"Role updated successfully."});
}
