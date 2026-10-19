import type { Env } from './auth-service';

/** All comment/reaction entry points must obey the parent content's visibility. */
export async function canAccessContent(env:Env,type:string,id:number,userId:number|null,write=false):Promise<boolean>{
 if(!Number.isSafeInteger(id)||id<1)return false;
 if(type==='discussion'){
  const r=await env.DB.prepare("SELECT locked FROM discussions WHERE discussion_id=? AND status='active'").bind(id).first<{locked:number}>();return !!r&&(!write||!r.locked);
 }
 if(type==='testimony')return !!await env.DB.prepare("SELECT 1 FROM testimonies WHERE testimony_id=? AND approval_status='approved'").bind(id).first();
 if(type==='question')return !!await env.DB.prepare("SELECT 1 FROM questions WHERE question_id=? AND status='active'").bind(id).first();
 if(type==='prayer_request'){
  const r=await env.DB.prepare("SELECT visibility,user_id FROM prayer_requests WHERE prayer_id=? AND status='active'").bind(id).first<{visibility:string;user_id:number}>();
  if(!r)return false;if(r.visibility==='public')return true;if(!userId)return false;if(r.user_id===userId)return true;
  return !!await env.DB.prepare("SELECT 1 FROM users u JOIN roles r ON r.role_id=u.role_id WHERE u.user_id=? AND u.status='active' AND r.role_name IN ('Super Administrator','Deputy Super Administrator')").bind(userId).first();
 }
 if(type==='group_post'){
  const r=await env.DB.prepare("SELECT g.group_id,g.visibility FROM group_posts p JOIN groups g ON g.group_id=p.group_id WHERE p.post_id=? AND p.status='active' AND g.status='active'").bind(id).first<{group_id:number;visibility:string}>();
  if(!r)return false;if(!write&&r.visibility==='public')return true;if(!userId)return false;
  return !!await env.DB.prepare("SELECT 1 FROM group_members WHERE group_id=? AND user_id=? AND join_status='approved'").bind(r.group_id,userId).first();
 }
 return false;
}
