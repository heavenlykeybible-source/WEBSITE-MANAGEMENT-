import type {Env,SessionUser} from './types';
const note=(v:any)=>String(v||'').trim().slice(0,1000);
const staff=(u:SessionUser)=>['moderator','administrator','owner'].includes(u.role);
const admin=(u:SessionUser)=>['administrator','owner'].includes(u.role);
const forbidden=(message:string)=>Object.assign(new Error(message),{status:403});
export async function routeReport(env:Env,reporter:number,input:any){
 const type=input.targetType,id=Number(input.targetId);
 let groupId:number|null=null;
 if(type==='post')groupId=(await env.DB.prepare('SELECT group_id FROM posts WHERE post_id=?').bind(id).first<any>())?.group_id||null;
 if(type==='comment')groupId=(await env.DB.prepare('SELECT p.group_id FROM comments c JOIN posts p ON p.post_id=c.post_id WHERE c.comment_id=?').bind(id).first<any>())?.group_id||null;
 if(type==='group')groupId=id;
 const r=await env.DB.prepare('INSERT OR IGNORE INTO content_reports(reporter_user_id,target_type,target_id,reason,details,group_id) VALUES(?,?,?,?,?,?) RETURNING report_id').bind(reporter,type,id,input.reason,note(input.details)||null,groupId).first<any>();
 if(r){
  const queries=[env.DB.prepare("INSERT INTO notifications(user_id,kind,title,body,href) SELECT user_id,'safety_report','Community report awaiting review','A member reported content. Review it in Safety & privacy.','/safety.html' FROM users WHERE role IN ('moderator','administrator','owner') AND status='active'")];
  if(groupId)queries.push(env.DB.prepare("INSERT INTO notifications(user_id,kind,title,body,href) SELECT gm.user_id,'group_report','Group report awaiting review','Review this report in your group. Site staff also received it.',? FROM group_members gm JOIN users u ON u.user_id=gm.user_id WHERE gm.group_id=? AND gm.join_status='approved' AND gm.role IN ('owner','administrator','moderator') AND u.status='active'").bind('/groups.html?id='+groupId,groupId));
  await env.DB.batch(queries);
 }
 return {reported:true,groupId,routing:groupId?'group_and_site':'site'};
}
async function groupAccess(env:Env,u:SessionUser,id:number){
 if(staff(u)&&u.status==='active')return;
 if(!await env.DB.prepare("SELECT 1 FROM group_members gm JOIN groups g ON g.group_id=gm.group_id JOIN users u ON u.user_id=gm.user_id WHERE gm.group_id=? AND gm.user_id=? AND gm.join_status='approved' AND gm.role IN ('owner','administrator','moderator') AND g.status='active' AND u.status='active'").bind(id,u.userId).first())throw forbidden('Group manager access required.');
}
export async function groupReports(env:Env,u:SessionUser,id:number){
 await groupAccess(env,u,id);
 return (await env.DB.prepare(`SELECT cr.report_id,cr.target_type,cr.target_id,cr.reason,cr.details,cr.status,cr.group_review_status,COALESCE(p.title,g.name,'Reported reply') target_title,COALESCE(p.body,c.body,g.description) target_body FROM content_reports cr LEFT JOIN posts p ON cr.target_type='post' AND p.post_id=cr.target_id LEFT JOIN comments c ON cr.target_type='comment' AND c.comment_id=cr.target_id LEFT JOIN groups g ON cr.target_type='group' AND g.group_id=cr.target_id WHERE cr.group_id=? AND cr.group_review_status='pending' ORDER BY cr.report_id LIMIT 100`).bind(id).all()).results;
}
export async function reviewGroupReport(env:Env,u:SessionUser,groupId:number,id:number,input:any){
 await groupAccess(env,u,groupId);const reason=note(input.note),action=input.action;
 if(!['dismiss','remove','escalate'].includes(action)||reason.length<10)throw new Error('Choose an action and give at least 10 characters of explanation.');
 const r=await env.DB.prepare("SELECT * FROM content_reports WHERE report_id=? AND group_id=? AND group_review_status='pending'").bind(id,groupId).first<any>();if(!r)throw new Error('Pending group report unavailable.');
 if(action==='remove'&&!['post','comment'].includes(r.target_type))throw new Error('Site administrators review restrictions on groups or accounts.');
 const queries=[env.DB.prepare("UPDATE content_reports SET group_review_status='reviewed',group_review_note=?,group_reviewer_user_id=? WHERE report_id=? AND group_id=? AND group_review_status='pending'").bind(action+': '+reason,u.userId,id,groupId),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'group_report_review','report',?,?)").bind(u.userId,id,action+': '+reason)];
 if(action==='remove'){
  if(r.status!=='pending')throw new Error('Site staff have already decided this report.');
  const table=r.target_type==='post'?'posts':'comments',key=r.target_type==='post'?'post_id':'comment_id';
  queries.push(env.DB.prepare(`UPDATE ${table} SET status='removed' WHERE ${key}=? AND EXISTS(SELECT 1 FROM content_reports WHERE report_id=? AND status='pending')`).bind(r.target_id,id));
  const ownerColumn=r.target_type==='post'?'author_user_id':'user_id';queries.push(env.DB.prepare(`INSERT INTO notifications(user_id,kind,title,body,href) SELECT ${ownerColumn},'group_moderation','Group content removed',?,'/safety.html' FROM ${table} WHERE ${key}=? AND status='removed' AND EXISTS(SELECT 1 FROM content_reports WHERE report_id=? AND status='pending')`).bind(reason+' You can send a Safety concern to site staff to request review.',r.target_id,id));
 }
 await env.DB.batch(queries);return {reviewed:true,siteReviewPending:r.status==='pending'};
}
export async function flagQueue(env:Env,u:SessionUser){
 if(!staff(u))throw forbidden('Site moderator access required.');
 return (await env.DB.prepare(`SELECT e.*,p.display_name,COALESCE(po.body,co.body,me.body) content_body,po.title content_title,po.video_url,(SELECT COUNT(*) FROM moderation_events x WHERE x.user_id=e.user_id AND x.created_at>=datetime('now','-7 days')) recent_flags FROM moderation_events e LEFT JOIN profiles p ON p.user_id=e.user_id LEFT JOIN posts po ON e.content_type='post' AND po.post_id=e.source_id LEFT JOIN comments co ON e.content_type='comment' AND co.comment_id=e.source_id LEFT JOIN messages me ON e.content_type='message' AND me.message_id=e.source_id WHERE e.review_status='pending' ORDER BY e.moderation_event_id DESC LIMIT 100`).all()).results;
}
export async function reviewFlag(env:Env,u:SessionUser,id:number,input:any){
 if(!staff(u))throw forbidden('Site moderator access required.');const reason=note(input.note),action=input.action;
 if(!['acknowledge','approve','remove'].includes(action)||reason.length<10)throw new Error('Choose an action and explain it in at least 10 characters.');
 const e=await env.DB.prepare("SELECT * FROM moderation_events WHERE moderation_event_id=? AND review_status='pending'").bind(id).first<any>();if(!e)throw new Error('Pending flag unavailable.');
 const queries=[env.DB.prepare("UPDATE moderation_events SET review_status='reviewed' WHERE moderation_event_id=? AND review_status='pending'").bind(id),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'flag_review','moderation_event',?,?)").bind(u.userId,id,action+': '+reason)];
 if(action!=='acknowledge'){
  if(e.decision!=='hold'||!e.source_id||!e.content_type)throw new Error('Only content currently held for review can be approved or removed here.');
  const type=e.content_type||e.surface,targets:Record<string,[string,string,string]>={post:['posts','post_id','active'],comment:['comments','comment_id','active'],message:['messages','message_id','delivered']};
  if(!targets[type])throw new Error('Use the content report queue for this content.');const [table,key,status]=targets[type];
  if(!await env.DB.prepare(`SELECT 1 FROM ${table} WHERE ${key}=? AND status='held'`).bind(e.source_id).first())throw new Error('This content is no longer held.');
  queries.push(env.DB.prepare(`UPDATE ${table} SET status=?,moderation_state=? WHERE ${key}=? AND status='held'`).bind(action==='approve'?status:'removed',action==='approve'?'allowed':'blocked',e.source_id));
 }
 if(action==='approve'&&e.user_id)queries.push(reviewNotice(env,Number(e.user_id),'flag-'+id,false,'content'));
 await env.DB.batch(queries);return {reviewed:true};
}
export async function accountQueue(env:Env,u:SessionUser){if(!admin(u))throw forbidden('Site administrator access required.');return (await env.DB.prepare("SELECT r.*,p.display_name FROM account_restrictions r JOIN profiles p ON p.user_id=r.user_id WHERE r.status='active' ORDER BY r.restriction_id DESC LIMIT 100").all()).results;}
// One member-facing review message, selected from the actual post-review access state.
export function reviewNotice(env:Env,userId:number,eventKey:string,wasRestricted:boolean,context:'account'|'content'|'appeal'){
 const welcome='A message from Global Christian Community\n\nWe are pleased to inform you that, following our personal review, your account has been reactivated. Welcome back! Please continue to follow our Community guidelines as we grow together in Christ.\n\nTogether we take Christ to the nations of the world.';
 const partial='A message from Global Christian Community\n\nWe are pleased to inform you that this review has been resolved in your favour. A separate restriction still applies to your account. Please check Safety & privacy for its details and appeal options.\n\nTogether we take Christ to the nations of the world.';
 const approval='A message from Global Christian Community\n\nWe are pleased to inform you that your '+(context==='appeal'?'appeal was successful':'submission has been approved following our personal review')+'. Thank you for your patience. If your submission has not completed, return to your draft and submit it again.\n\nTogether we take Christ to the nations of the world.';
 return env.DB.prepare(`WITH access AS (SELECT u.user_id,(u.status='active' AND NOT EXISTS(SELECT 1 FROM account_restrictions WHERE user_id=u.user_id AND status='active')) restored FROM users u WHERE u.user_id=?) INSERT INTO notifications(user_id,kind,title,body,href) SELECT user_id,'account_review_update',CASE WHEN ? AND restored THEN 'Your account has been reactivated' WHEN NOT restored THEN 'Your personal review is complete' ELSE 'Your ${context==='appeal'?'appeal':'submission'} has been approved' END,CASE WHEN ? AND restored THEN ? WHEN NOT restored THEN ? ELSE ? END,? FROM access WHERE NOT EXISTS(SELECT 1 FROM notifications WHERE user_id=access.user_id AND kind='account_review_update' AND href=?)`).bind(userId,wasRestricted?1:0,wasRestricted?1:0,welcome,partial,approval,'/safety.html#review-'+eventKey,'/safety.html#review-'+eventKey);
}
export async function restrictAccount(env:Env,u:SessionUser,id:number,input:any){
 if(!admin(u))throw forbidden('Only a site administrator can lock or unlock accounts.');const reason=note(input.note);if(reason.length<10)throw new Error('Give at least 10 characters explaining the account decision.');
 const target=await env.DB.prepare('SELECT role,status FROM users WHERE user_id=?').bind(id).first<any>();if(!target||target.role!=='member'||id===u.userId)throw forbidden('This control applies only to member accounts. Staff accounts require owner review.');
 if(input.action==='lock'){
  if(target.status!=='active')throw new Error('This member is already restricted or unavailable.');
  await env.DB.batch([env.DB.prepare("INSERT INTO account_restrictions(user_id,actor_user_id,reason) VALUES(?,?,?)").bind(id,u.userId,reason),env.DB.prepare("UPDATE users SET status='restricted' WHERE user_id=? AND role='member' AND status='active'").bind(id),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'account_lock','profile',?,?)").bind(u.userId,id,reason)]);
 }else if(input.action==='unlock'){
  const r=await env.DB.prepare("SELECT restriction_id FROM account_restrictions WHERE user_id=? AND status='active'").bind(id).first<any>();if(!r||target.status!=='restricted')throw new Error('Active account lock unavailable.');
  await env.DB.batch([env.DB.prepare("UPDATE account_restrictions SET status='lifted',lifted_at=datetime('now'),lifted_by=? WHERE restriction_id=? AND status='active'").bind(u.userId,r.restriction_id),env.DB.prepare("UPDATE users SET status='active' WHERE user_id=? AND role='member' AND status='restricted'").bind(id),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'account_unlock','restriction',?,?)").bind(u.userId,r.restriction_id,reason),reviewNotice(env,id,'account-'+r.restriction_id,true,'account')]);
 }else throw new Error('Choose lock or unlock.');return {ok:true};
}

