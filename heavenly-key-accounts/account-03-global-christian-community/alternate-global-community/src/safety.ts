import type {Env,SessionUser} from './types';
const text=(v:any,n:number)=>String(v??'').trim().slice(0,n);
export async function mySafety(env:Env,userId:number){
 const [requests,decisions]=await Promise.all([
 env.DB.prepare('SELECT request_id,kind,decision_id,details,status,response,created_at,reviewed_at FROM safety_requests WHERE user_id=? ORDER BY request_id DESC LIMIT 100').bind(userId).all(),
 env.DB.prepare("SELECT decision_id,action,reason,created_at FROM safety_decisions WHERE subject_user_id=? ORDER BY decision_id DESC LIMIT 100").bind(userId).all()]);
 const restrictions=await env.DB.prepare("SELECT reason,status,created_at FROM account_restrictions WHERE user_id=? ORDER BY restriction_id DESC LIMIT 20").bind(userId).all();return {requests:requests.results,decisions:decisions.results,restrictions:restrictions.results};
}
export async function submitRequest(env:Env,userId:number,input:any){
 const kind=text(input.kind,20),details=text(input.details,3000);if(!['appeal','access','deletion','correction','privacy','safety'].includes(kind)||details.length<10)throw new Error('Choose a request type and give at least 10 characters of detail.');
 const decisionId=kind==='appeal'?Number(input.decisionId):null;
 if(kind==='appeal'&&(!Number.isSafeInteger(decisionId)||!await env.DB.prepare("SELECT 1 FROM safety_decisions WHERE decision_id=? AND subject_user_id=? AND action='remove'").bind(decisionId,userId).first()))throw new Error('Choose a moderation decision belonging to your account.');
 if(kind==='appeal'&&await env.DB.prepare("SELECT 1 FROM safety_requests WHERE user_id=? AND decision_id=? AND status='pending'").bind(userId,decisionId).first())throw new Error('An appeal of this decision is already pending.');
 const row=await env.DB.prepare('INSERT INTO safety_requests(user_id,kind,decision_id,details) VALUES(?,?,?,?) RETURNING request_id').bind(userId,kind,decisionId,details).first<any>();return {requestId:row.request_id};
}
export async function requestQueue(env:Env){return (await env.DB.prepare("SELECT r.*,p.display_name FROM safety_requests r JOIN profiles p ON p.user_id=r.user_id WHERE r.status='pending' ORDER BY r.request_id LIMIT 200").all()).results;}
export async function reviewRequest(env:Env,actor:SessionUser,id:number,input:any){
 if(!['administrator','owner'].includes(actor.role))throw Object.assign(new Error('Administrator access required.'),{status:403});
 const response=text(input.response,3000);if(response.length<10)throw new Error('Explain the outcome in at least 10 characters.');
 const request=await env.DB.prepare("SELECT r.*,d.actor_user_id original_actor FROM safety_requests r LEFT JOIN safety_decisions d ON d.decision_id=r.decision_id WHERE r.request_id=? AND r.status='pending'").bind(id).first<any>();if(!request)throw new Error('Pending request unavailable.');
 if(request.kind==='appeal'&&request.original_actor===actor.userId)throw Object.assign(new Error('A different administrator must review this appeal.'),{status:403});
 const queries=[env.DB.prepare("UPDATE safety_requests SET status='resolved',response=?,reviewer_user_id=?,reviewed_at=datetime('now') WHERE request_id=? AND status='pending'").bind(response,actor.userId,id),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'request_response','request',?,?)").bind(actor.userId,id,response)];
 if(input.restore===true){
  if(request.kind!=='appeal')throw new Error('Only an appeal can restore content.');
  const decision=await env.DB.prepare('SELECT cr.target_type,cr.target_id,d.created_at FROM safety_decisions d JOIN content_reports cr ON cr.report_id=d.report_id WHERE d.decision_id=?').bind(request.decision_id).first<any>();
  const targets:Record<string,[string,string,string]>={post:['posts','post_id','active'],comment:['comments','comment_id','active'],message:['messages','message_id','delivered'],space:['spaces','space_id','active'],group:['groups','group_id','active']};
  if(!decision||!targets[decision.target_type])throw new Error('This decision cannot be restored here.');
  if(await env.DB.prepare("SELECT 1 FROM safety_decisions newer JOIN content_reports cr ON cr.report_id=newer.report_id WHERE cr.target_type=? AND cr.target_id=? AND newer.action='remove' AND newer.decision_id>?").bind(decision.target_type,decision.target_id,request.decision_id).first())throw new Error('A newer restriction requires its own review.');
  const [table,key,status]=targets[decision.target_type];queries.push(env.DB.prepare(`UPDATE ${table} SET status=? WHERE ${key}=?`).bind(status,decision.target_id));
  queries.push(env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'appeal_restore',?,?,?)").bind(actor.userId,decision.target_type,decision.target_id,response));
 }
 await env.DB.batch(queries);
 return {status:'resolved'};
}

