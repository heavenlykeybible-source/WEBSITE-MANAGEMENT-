import type { Env } from '../services/auth-service';
import { requireMinimumRole } from '../middleware/rbac';
import { withSecurityHeaders } from './auth';

const json=(body:unknown,status=200)=>withSecurityHeaders(Response.json(body,{status}));
export async function handleGroupAdmin(request:Request,env:Env,id?:number):Promise<Response>{
 const actor=await requireMinimumRole(request,env,'Administrator');
 if(!actor)return json({error:{message:'Administrator access required.'}},403);
 if(request.method==='GET'){
  if(!id){const r=await env.DB.prepare("SELECT group_id,name,description,purpose_statement,type,visibility,status FROM groups WHERE status!='deleted' ORDER BY name LIMIT 100").all();return json({items:r.results});}
  const members=await env.DB.prepare('SELECT gm.user_id,u.name,gm.role,gm.join_status FROM group_members gm JOIN users u ON u.user_id=gm.user_id WHERE gm.group_id=?').bind(id).all();
  const pending=await env.DB.prepare("SELECT r.request_id,u.name FROM group_join_requests r JOIN users u ON u.user_id=r.user_id WHERE r.group_id=? AND r.status='pending'").bind(id).all();
  const posts=await env.DB.prepare("SELECT post_id,title,body,status FROM group_posts WHERE group_id=? AND status IN ('active','hidden') ORDER BY created_at DESC LIMIT 50").bind(id).all();
  return json({members:members.results,requests:pending.results,posts:posts.results});
 }
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return json({error:{message:'Use the ministry dashboard.'}},403);
 let b:any;try{b=await request.json();}catch{return json({error:{message:'Invalid JSON.'}},400);}
 if(!id||!await env.DB.prepare("SELECT group_id FROM groups WHERE group_id=? AND status!='deleted'").bind(id).first())return json({error:{message:'Group not found.'}},404);
 if(b.action==='status'&&['active','archived'].includes(b.status))await env.DB.prepare('UPDATE groups SET status=? WHERE group_id=?').bind(b.status,id).run();
 else if(b.action==='join'&&Number.isInteger(b.requestId)&&['approved','declined'].includes(b.status)){
  const row=await env.DB.prepare("SELECT user_id FROM group_join_requests WHERE request_id=? AND group_id=? AND status='pending'").bind(b.requestId,id).first<{user_id:number}>();
  if(!row)return json({error:{message:'Pending request not found.'}},404);
  if(b.status==='approved')await env.DB.prepare("INSERT OR IGNORE INTO group_members(group_id,user_id,role,join_status) VALUES(?,?,'member','approved')").bind(id,row.user_id).run();
  await env.DB.prepare("UPDATE group_join_requests SET status=? WHERE request_id=? AND group_id=?").bind(b.status,b.requestId,id).run();
 }else if(b.action==='post'&&Number.isInteger(b.postId)&&['active','hidden'].includes(b.status)){
  const r=await env.DB.prepare('UPDATE group_posts SET status=? WHERE post_id=? AND group_id=?').bind(b.status,b.postId,id).run();if(!r.meta.changes)return json({error:{message:'Post not found.'}},404);
 }else return json({error:{message:'Invalid group action.'}},400);
 return json({ok:true});
}
