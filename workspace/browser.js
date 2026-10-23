const BROWSER_TASK_PREFIX='workspace:browser:';
function browserPublic(j,ownerView=false){return {id:j.id,goal:j.goal,hosts:j.hosts,status:j.status,expires:j.expires||null,url:j.url||null,snapshot:j.snapshot||null,elements:j.elements||[],pending:j.pending?{type:j.pending.type,element:j.pending.element,url:j.pending.url,...(ownerView?{value:j.pending.value,key:j.pending.key}:{} )}:null};}
async function browserSave(env,owner,j){await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=CURRENT_TIMESTAMP').bind(BROWSER_TASK_PREFIX+owner+':'+j.id,JSON.stringify(j)).run();}
async function browserLoad(env,owner,id){if(!/^[a-f0-9-]{36}$/.test(String(id)))fail('Invalid browser task');const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(BROWSER_TASK_PREFIX+owner+':'+id).first();if(!row)fail('Browser task not found',404);return JSON.parse(row.value_json);}
async function browserAgentOwner(env,actor){
 if(actor.ow||actor.a?.owner_id||actor.a?.site_id||!actor.a?.can_read)fail('Use an unscoped owner-authorized AI connection',403);
 let id=actor.chatUserId;if(!id){const owner=await env.DB.prepare("SELECT id FROM users WHERE role='owner' AND kind='staff' AND status='active'").first();id=owner?.id;}
 const owner=await env.DB.prepare("SELECT role,kind FROM users WHERE id=? AND status='active'").bind(id||0).first();if(owner?.role!=='owner'||owner.kind!=='staff')fail('Owner required',403);return id;
}
async function browserTool(env,actor,name,b){
 const owner=await browserAgentOwner(env,actor);
 if(name==='browser_request_task'){
  if(!Array.isArray(b.hosts))fail('Choose exact public HTTPS hosts');
  const goal=String(b.goal||'').trim(),hosts=[...new Set(b.hosts)];
  if(!goal||goal.length>500||!hosts.length||hosts.length>8||hosts.some(h=>typeof h!=='string'||h.length>253||!/^([a-z0-9][a-z0-9-]*\.)+[a-z]{2,63}$/.test(h)))fail('Provide a goal and up to eight exact public HTTPS hosts');
  const j={id:crypto.randomUUID(),goal,hosts,status:'awaiting-owner',agent:actor.agentId,created:Date.now()};await browserSave(env,owner,j);return {task:browserPublic(j),runtime_available:!!env.BROWSER_AGENT,notice:'The owner approves the exact task and hosts in Browser agent. Clicks and form actions require an inline owner decision. Provider verification requires owner input.'};
 }
 return withOperationLock(env,'browser:'+b.id,async()=>{const j=await browserLoad(env,owner,b.id);if(j.agent!==actor.agentId)fail('This browser task belongs to another AI',403);
  if(name==='browser_task_status')return {task:browserPublic(j)};
  if(j.status!=='active'||j.expires<Date.now())fail('Task is not active; ask the owner to start a new task',409);
  if(j.pending)fail('An action already awaits an owner decision',409);
  const action={type:b.type,element:b.element,url:b.url,snapshot:b.snapshot};
  if(!['observe','navigate','click','fill','select','press','close'].includes(action.type))fail('Unsupported action');
  if(action.type==='fill'||action.type==='select'){if(typeof b.value!=='string'||b.value.length>4000)fail('Invalid field value');action.value=b.value;}
  if(action.type==='press')action.key=b.key;
  if(action.type==='observe'||action.type==='close'){const out=await browserRun(env,owner,j,action);return {task:out.task};}
  j.pending=action;await browserSave(env,owner,j);return {task:browserPublic(j),notice:'Action queued for owner review. No click or form submission has happened.'};
 });
}
async function browserRun(env,owner,j,action){
 if(!env.BROWSER_AGENT)fail('Browser runtime is not connected. Enable Account 4 Browser Run access and install the private browser service.',503);
 if(j.expires<Date.now())fail('Browser task expired',409);
 const session=j.session?await unseal(env,j.session):null;
 const response=await env.BROWSER_AGENT.fetch('https://browser.internal/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({job:{session,hosts:j.hosts,expires:j.expires},action})});
 const data=await response.json();if(!response.ok)fail(data.error||'Browser operation failed',409);
 j.pending=null;j.status=data.closed?'closed':'active';j.session=data.session?await seal(env,data.session):null;j.snapshot=data.snapshot;j.url=data.url;j.elements=data.elements||[];
 await browserSave(env,owner,j);return {task:browserPublic(j),screenshot:data.screenshot||null};
}
async function browserWorkspaceRoutes(req,env,user,sub,m){
 if(!sub.startsWith('browser'))return null;if(user.role!=='owner'||user.kind!=='staff')fail('Owner access required',403);
 if(sub==='browser'&&m==='GET'){const rows=await env.DB.prepare('SELECT value_json FROM settings WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 30').bind(BROWSER_TASK_PREFIX+user.id+':%').all();return json({available:!!env.BROWSER_AGENT,tasks:rows.results.map(r=>browserPublic(JSON.parse(r.value_json),true)),notice:env.BROWSER_AGENT?'Browser sessions last at most two minutes. Idle sessions expire after 30 seconds.':'Browser agent code is installed. Live runtime requires Account 4 Browser Run access and the private service binding.'});}
 if(sub==='browser/decide'&&m==='POST'){
  const b=await body(req);return withOperationLock(env,'browser:'+b.id,async()=>{const j=await browserLoad(env,user.id,b.id);
   if(b.decision==='decline'){j.pending=null;j.status='declined';await browserSave(env,user.id,j);return json({task:browserPublic(j)});}
   if(b.decision!=='approve')fail('Choose Approve or Decline');
   if(j.status==='awaiting-owner'){
    await reauthenticate(env,user,b.password);
    if(!env.BROWSER_AGENT)fail('Browser Run access is not connected yet',503);
    await withOperationLock(env,'browser:daily-budget',async()=>{const key='browser:budget:'+new Date().toISOString().slice(0,10);const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();const used=Number(row?.value_json||0);if(used>=3)fail('Daily browser limit reached. No paid capacity is enabled.',429);await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').bind(key,String(used+1)).run();});
    j.status='active';j.expires=Date.now()+120000;await browserSave(env,user.id,j);await audit(env,user.username,'browser-task-approved',j.id+' '+j.hosts.join(','));return json(await browserRun(env,user.id,j,{type:'navigate',url:'https://'+j.hosts[0]+'/'}));
   }
   if(j.status!=='active'||!j.pending)fail('No pending action',409);
   const action=j.pending;j.pending=null;await browserSave(env,user.id,j);await audit(env,user.username,'browser-action-approved',j.id+' '+action.type);return json(await browserRun(env,user.id,j,action));
  });
 }
 if(sub==='browser/request'&&m==='POST')return json(await browserTool(env,{agentId:0,chatUserId:user.id,a:{can_read:true}},'browser_request_task',await body(req)),201);
 if(sub==='browser/owner-action'&&m==='POST'){
  const b=await body(req);return withOperationLock(env,'browser:'+b.id,async()=>{const j=await browserLoad(env,user.id,b.id);if(j.status!=='active')fail('Task is not active',409);if(!['observe','close','fill'].includes(b.type))fail('Unsupported owner action');
   // Secure values pass directly to the private runtime: never store or audit them.
   if(b.type==='fill')await reauthenticate(env,user,b.password);
   return json(await browserRun(env,user.id,j,{type:b.type,element:b.element,value:b.value,snapshot:b.snapshot,ownerInput:true}));
  });
 }
 fail('Method not allowed',405);
}
