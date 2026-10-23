async function requestAIWorkspaceAccess(env,actor,args){
 if(!actor.chatUserId||actor.ow||actor.a.site_id)fail('Ask the signed-in owner to grant access in the Control Room.',403);
 const user=await env.DB.prepare("SELECT id,role,kind FROM users WHERE id=? AND status='active'").bind(actor.chatUserId).first();if(user?.role!=='owner'||user.kind==='member')fail('Only owner conversations can request account access.',403);
 const policy=cleanAIPolicy({mode:'work',max_tools:actor.aiPolicy?.max_tools||12,connections:args.connections,hours:args.hours||24});
 if(!policy.connections.length)fail('Select at least one exact account.');
 const accounts=[];for(const id of policy.connections){const c=await connById(env,id);accounts.push({id:c.id,label:c.label});}
 const reason=String(args.reason||'').trim();if(!reason||reason.length>500)fail('Explain the action in up to 500 characters.');
 const id=crypto.randomUUID(),request={id,user:user.id,agent:actor.agentId,accounts,connections:policy.connections,hours:Number(args.hours||24),reason,conversation:actor.chatConversationId||'',expires:Date.now()+3600000,status:'pending'};
 await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('ai:access-request:'+id,JSON.stringify(request)).run();
 return {permission_request:request,message:'Awaiting the owner Approve or Decline choice in chat. No access has been granted. Do not repeat this request or claim the action was completed.'};
}
async function aiWorkspaceRoutes(req,env,user,sub,m){
 if(!['ai/access-requests','ai/access-requests/decide','ai/history'].includes(sub))return null;
 if(sub==='ai/history'&&m==='GET'){
  const rows=await env.DB.prepare("SELECT key,value_json FROM settings WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 40").bind('ai:context:'+user.id+':%').all();
  return json({conversations:rows.results.map(r=>{const c=JSON.parse(r.value_json),parts=r.key.split(':');return {account:parts[3],id:parts[4],title:c.title||c.task,messages:c.messages||[],updated_at:c.updated_at};})});
 }
 if(user.role!=='owner'||user.kind==='member')fail('Owner access required',403);
 if(sub==='ai/access-requests'&&m==='GET'){
  const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'ai:access-request:%' ORDER BY updated_at DESC LIMIT 100").all();
  return json({requests:rows.results.map(r=>JSON.parse(r.value_json)).filter(r=>r.user===user.id&&r.status==='pending'&&r.expires>Date.now()).map(({user,agent,...r})=>r)});
 }
 if(sub==='ai/access-requests/decide'&&m==='POST'){
  const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(String(b.id))||!['approve','decline'].includes(b.decision))fail('Choose Approve or Decline');
  return withOperationLock(env,'ai-access:'+b.id,async()=>{
   const key='ai:access-request:'+b.id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();if(!row)fail('Request not found',404);const r=JSON.parse(row.value_json);if(r.user!==user.id||r.status!=='pending'||r.expires<Date.now())fail('This request expired or was already decided.',409);
   if(b.decision==='approve'){
    await reauthenticate(env,user,b.password);const old=await aiPolicy(env,user);const connections=[...new Set([...(old.expires_at>Date.now()?old.connections:[]),...r.connections])];for(const id of connections)await connById(env,id);
    const policy={...old,mode:'work',connections,expires_at:Math.max(old.expires_at||0,Date.now()+r.hours*3600000)};
    await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json').bind('ai:permissions:'+user.id,JSON.stringify(policy)).run();
   }
   r.status=b.decision;r.decided_at=Date.now();await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(r),key).run();await audit(env,user.username,'ai-access-'+b.decision,r.accounts.map(c=>c.label).join(', '));return json({ok:true,decision:b.decision});
  });
 }
 fail('Method not allowed',405);
}
