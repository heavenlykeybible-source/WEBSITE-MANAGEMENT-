// Account 4 concurrent AI assignment board. Pure controls on the owner side.
// Assignments do not execute AI jobs or grant account access by themselves.
const STUDIO_WORKER_NAME=/^[a-z0-9][a-z0-9-]{0,62}$/;
function studioTaskInput(b){
 const connection=Number(b?.connection),worker=String(b?.worker||'');
 const instruction=String(b?.instruction||'').trim(),agentIds=b?.agents;
 if(!Number.isSafeInteger(connection)||connection<1)throw Error('Select exactly one saved Cloudflare account');
 if(!STUDIO_WORKER_NAME.test(worker))throw Error('Select exactly one valid Worker');
 if(!instruction||instruction.length>4000)throw Error('Describe one assignment in 1–4000 characters');
 if(!Array.isArray(agentIds)||!agentIds.length||agentIds.length>25)throw Error('Select 1–25 AI agents per batch; additional batches are supported');
 if(agentIds.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(agentIds).size!==agentIds.length)throw Error('Each selected AI must have a unique valid ID');
 return {connection,worker,instruction,agents:[...agentIds]};
}
async function studioTaskRoutes(req,env,user,sub,method){
 if(!sub.startsWith('studio/tasks'))return null;
 if(user.role!=='owner'||user.kind!=='staff')fail('Owner access required',403);
 if(sub==='studio/tasks'&&method==='GET'){
  const page=Number(new URL(req.url).searchParams.get('page')||0);
  if(!Number.isSafeInteger(page)||page<0||page>100000)fail('Invalid task page');
  const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'studio:task:%' AND json_extract(value_json,'$.owner')=? ORDER BY updated_at DESC,key DESC LIMIT 51 OFFSET ?").bind(user.id,page*50).all();
  return json({tasks:rows.results.slice(0,50).map(x=>JSON.parse(x.value_json)),page,next_page:rows.results.length>50?page+1:null});
 }
 if(sub==='studio/tasks'&&method==='POST'){
  const input=studioTaskInput(await body(req));
  await connById(env,input.connection);
  const selected=await Promise.all(input.agents.map(id=>env.DB.prepare("SELECT id,name,can_read,can_propose,owner_id,site_id FROM agents WHERE id=? AND status='active'").bind(id).first()));
  for(const a of selected)if(!a||a.owner_id||a.site_id||!a.can_read||!a.can_propose)fail('Every assigned AI must be an enabled unscoped staff assistant with read and proposal permissions',403);
  // Bound batch size protects one request. No global task count ceiling.
  const batch=crypto.randomUUID(),created=Date.now(),tasks=[];
  for(const agent of selected){
   const task={id:crypto.randomUUID(),batch,owner:user.id,agent:agent.id,agent_name:agent.name,connection:input.connection,worker:input.worker,instruction:input.instruction,status:'assigned',created_at:created,updated_at:created,proposal_id:null};
   tasks.push(task);
  }
  const statements=tasks.map(t=>env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('studio:task:'+t.id,JSON.stringify(t)));
  // A transactional D1 batch prevents partial assignment on failure.
  await env.DB.batch(statements);
  await audit(env,user.username,'studio-multi-ai-assigned',input.worker+' '+tasks.length+' tasks '+batch);
  return json({ok:true,batch,assigned:tasks.length,tasks,notice:'Assignments saved independently. AI execution begins when the corresponding connected assistant picks up its task. No production change occurs.'},201);
 }
 if(method==='POST'&&/^studio\/tasks\/[0-9a-f-]{36}\/cancel$/.test(sub)){
  const id=sub.split('/')[2];
  return withOperationLock(env,'studio-task:'+id,async()=>{
   const key='studio:task:'+id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
   if(!row)fail('Task not found',404);
   const t=JSON.parse(row.value_json);
   if(t.owner!==user.id)fail('Task not found',404);
   if(t.status==='submitted'||t.status==='cancelled')fail('This task is already finished',409);
   t.status='cancelled';t.updated_at=Date.now();
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(t),key).run();
   await audit(env,user.username,'studio-task-cancelled',id);
   return json({ok:true,status:t.status,id});
  });
 }
 fail('Method not allowed',405);
}
async function studioAITask(env,actor,name,args){
 if(actor.ow||actor.a?.owner_id||actor.a?.site_id||!actor.a?.can_read)fail('Unscoped staff AI required',403);
 if(name==='my_studio_assignments'){
  const page=Number(args?.page||0);
  if(!Number.isSafeInteger(page)||page<0||page>100000)fail('Invalid task page');
  const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'studio:task:%' AND json_extract(value_json,'$.agent')=? AND json_extract(value_json,'$.status') IN ('assigned','working') ORDER BY updated_at DESC,key DESC LIMIT 51 OFFSET ?").bind(actor.agentId,page*50).all();
  return {tasks:rows.results.slice(0,50).map(x=>JSON.parse(x.value_json)),page,next_page:rows.results.length>50?page+1:null,notice:'Assigned or working tasks are tracked separately. No automatic production writes occur.'};
 }
 if(name==='claim_studio_assignment'||name==='update_studio_progress'){
  const id=String(args?.task_id||'');
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))fail('Invalid assignment ID',400);
  return withOperationLock(env,'studio-task:'+id,async()=>{
   const key='studio:task:'+id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
   if(!row)fail('Task not found',404);
   const t=JSON.parse(row.value_json);
   if(t.agent!==actor.agentId||!['assigned','working'].includes(t.status))fail('Not your active assignment',403);
   const fresh=await env.DB.prepare("SELECT id,status,can_read,can_propose,owner_id,site_id FROM agents WHERE id=?").bind(actor.agentId).first();
   if(!fresh||fresh.status!=='active'||!fresh.can_read||!fresh.can_propose||fresh.owner_id||fresh.site_id)fail('AI account is disabled',403);
   const owner=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='owner' AND kind='staff' AND status='active'").bind(t.owner).first();
   if(!owner)fail('Task owner unavailable',403);
   const policy=await aiPolicy(env,owner),now=Date.now();
   const delegated=actor.aiPolicy
    ? actor.aiPolicy.mode==='work'&&actor.aiPolicy.expires_at>now&&Array.isArray(actor.aiPolicy.connections)&&actor.aiPolicy.connections.includes(t.connection)
    : policy.all_agents===true;
   if(!delegated||policy.mode!=='work'||policy.expires_at<=now||!policy.connections.includes(t.connection))
    fail('AI account authorization expired or revoked',403);
   if(name==='claim_studio_assignment'){
    if(t.status==='working')return {ok:true,task_id:id,status:'working',note:'Already claimed by this AI; use update_studio_progress for updates.'};
    t.status='working';t.started_at=now;t.updated_at=now;t.progress='Inspection started';
   }else{
    if(t.status!=='working')fail('Claim the assignment before reporting progress',409);
    const message=String(args?.progress||'').trim();
    if(!message||message.length>600)fail('Progress must be 1–600 characters',400);
    t.progress=message;t.updated_at=now;
   }
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(t),key).run();
   await audit(env,'ai:'+actor.agentId,'studio-task-'+(name==='claim_studio_assignment'?'claimed':'progress'),id);
   return {ok:true,task_id:id,status:t.status,progress:t.progress,updated_at:t.updated_at,notice:'Status saved. No Worker was deployed and no owner approval was bypassed.'};
  });
 }
 if(name==='submit_studio_assignment'){
  if(!actor.a.can_propose)fail('Proposal permission required',403);
  const id=String(args?.task_id||'');if(!/^[0-9a-f-]{36}$/.test(id))fail('Invalid task ID');
  const proposal=Number(args?.proposal_id);
  if(!Number.isSafeInteger(proposal)||proposal<1)fail('Submit an existing Waiting Room proposal first');
  return withOperationLock(env,'studio-task:'+id,async()=>{
   const key='studio:task:'+id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();
   if(!row)fail('Assignment not found',404);
   const t=JSON.parse(row.value_json);
   if(t.agent!==actor.agentId||!['assigned','working'].includes(t.status))fail('Not your active assignment',403);
   // Assignment is not a Cloudflare permission grant. Revalidate permission at submission time.
   const freshAgent=await env.DB.prepare("SELECT id,status,can_read,can_propose,owner_id,site_id FROM agents WHERE id=?").bind(actor.agentId).first();
   if(!freshAgent||freshAgent.status!=='active'||!freshAgent.can_read||!freshAgent.can_propose||freshAgent.owner_id||freshAgent.site_id)
    fail('Assigned AI account has been revoked or lost permission',403);
   // Reject stale in-memory grants: owner revocation takes effect immediately, even
   // when an AI already has an authenticated session or an old task in its inbox.
   const currentOwner=await env.DB.prepare("SELECT id FROM users WHERE id=? AND role='owner' AND kind='staff' AND status='active'").bind(t.owner).first();
   if(!currentOwner)fail('Task owner is no longer active',403);
   const currentPolicy=await aiPolicy(env,currentOwner),now=Date.now();
   const permitted=actor.aiPolicy
    ? actor.aiPolicy.mode==='work'&&actor.aiPolicy.expires_at>now&&actor.aiPolicy.connections.includes(t.connection)
      &&currentPolicy.mode==='work'&&currentPolicy.expires_at>now&&currentPolicy.connections.includes(t.connection)
    : currentPolicy.all_agents===true&&currentPolicy.mode==='work'&&currentPolicy.expires_at>now&&currentPolicy.connections.includes(t.connection);
   if(!permitted)fail('Cloudflare authorization is missing, revoked or expired; request exact-account owner approval',403);
   const p=await env.DB.prepare("SELECT id,agent_id,status,kind,new_content_json FROM proposals WHERE id=? AND agent_id=? AND sealed=1").bind(proposal,actor.agentId).first();
   if(!p||p.status!=='waiting'||p.kind!=='worker')fail('Choose your own waiting Worker proposal',403);
   const meta=JSON.parse(p.new_content_json);
   if(Number(meta.connection_id)!==t.connection||meta.name!==t.worker)fail('Proposal Worker/account differs from assigned target',409);
   t.status='submitted';t.proposal_id=p.id;t.updated_at=Date.now();
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(t),key).run();
   await audit(env,'ai:'+actor.agentId,'studio-task-submitted',id+' proposal '+p.id);
   return {ok:true,status:'submitted',task_id:id,proposal_id:p.id,notice:'Work submitted to Waiting Room. Only the owner can approve a production release.'};
  });
 }
 fail('Unknown studio AI operation',404);
}
