// Host approval prompts are navigation requests only. They can never authorize or execute a release.
const MCP_OWNER_REVIEW_TOOL={name:'request_owner_review',description:'Request owner review of one proposal created by this AI. Compatible MCP clients can display a native approval handoff; other clients receive a secure review link. Approval occurs only in the signed-in Control Room, after exact preview and owner verification. Repeating this tool checks the same proposal and never creates or publishes work.',inputSchema:{type:'object',properties:{proposal_id:{type:'integer',minimum:1}},required:['proposal_id'],additionalProperties:false}};
async function mcpReviewSession(req,env,agent){
 const id=req.headers.get('mcp-session-id');if(!/^[a-f0-9-]{36}$/.test(id||''))return false;
 const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('mcp:review-session:'+id).first();
 if(!row)return false;const session=JSON.parse(row.value_json);
 return session.agent===agent.id&&session.expires>Date.now()&&session.url===true;
}
async function mcpReviewInitialize(env,agent,capabilities){
 if(!capabilities?.elicitation?.url)return null;
 const now=Date.now();
 await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'mcp:review-session:%' AND json_extract(value_json,'$.expires') < ?").bind(now).run();
 const count=await env.DB.prepare("SELECT COUNT(*) n FROM settings WHERE key LIKE 'mcp:review-session:%' AND json_extract(value_json,'$.agent')=?").bind(agent.id).first();
 if(count.n>=20)return null; // Compatibility fallback still returns a secure review link.
 const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('mcp:review-session:'+id,JSON.stringify({agent:agent.id,url:true,expires:now+86400000})).run();return id;
}
async function mcpOwnerReview(req,env,agent,args,id){
 const proposalId=args?.proposal_id;if(!Number.isSafeInteger(proposalId)||proposalId<1)fail('Choose one proposal ID',400);
 if(!agent.can_read||!agent.can_propose||agent.site_id)fail('This AI connection cannot request proposal review',403);
 const proposal=await env.DB.prepare('SELECT id,agent_id,status,kind,title,owner_id FROM proposals WHERE id=? AND agent_id=?').bind(proposalId,agent.id).first();
 if(!proposal||(proposal.owner_id||null)!==(agent.owner_id||null))fail('Proposal not found for this AI connection',404);
 const url=new URL('/?review_proposal='+proposal.id,req.url).href;
 const result={proposal_id:proposal.id,status:proposal.status,review_url:url,notice:'Only a signed-in authorized reviewer can decide. Opening or accepting a host prompt never publishes or grants access.'};
 if(proposal.status==='waiting'&&await mcpReviewSession(req,env,agent))return json({jsonrpc:'2.0',id,error:{code:-32042,message:'The owner must review this exact proposal in the Control Room.',data:{elicitations:[{mode:'url',elicitationId:'proposal-'+proposal.id+'-agent-'+agent.id,url,message:'Review proposal #'+proposal.id+' in your Control Room. Inspect the preview, then approve or decline. No change has been published.'}]}}});
 return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result}});
}

const MCP_ACCESS_TOOL={name:'request_workspace_access',description:'Request one owner authorization for selected saved Cloudflare accounts. Compatible clients show an owner approval handoff; otherwise use the secure review URL. Never grants access itself.',inputSchema:{type:'object',properties:{connections:{type:'array',items:{type:'integer'}},hours:{type:'integer',minimum:1,maximum:720},reason:{type:'string'}},required:['connections','reason'],additionalProperties:false}};
async function mcpWorkspaceAccess(req,env,agent,args,id){
 const data=await requestAIWorkspaceAccess(env,{kind:'agent',agentId:agent.id,a:agent},args),request=data.permission_request;
 const url=new URL('/?review_access='+request.id,req.url).href;
 if(await mcpReviewSession(req,env,agent))return json({jsonrpc:'2.0',id,error:{code:-32042,message:'Owner authorization required',data:{elicitations:[{mode:'url',elicitationId:'access-'+request.id,url,message:request.reason+' Review all requested accounts, then approve or decline.'}]}}});
 return json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify({request_id:request.id,review_url:url,status:'pending'})}],structuredContent:{request_id:request.id,review_url:url,status:'pending'}}});
}

async function ownerApprovalSession(req,env,user,sub,m){
 if(sub!=='approval-session')return null;if(user.kind!=='staff'||user.role!=='owner')fail('Owner access required',403);if(m!=='POST')fail('Method not allowed',405);
 const b=await body(req);await reauthenticate(env,user,b.password);const token='approval-session:'+crypto.randomUUID(),expires=Date.now()+10*60000;
 await env.DB.prepare("DELETE FROM settings WHERE key LIKE 'owner:approval-session:%' AND json_extract(value_json,'$.expires') < ?").bind(Date.now()).run();
 await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('owner:approval-session:'+await sha256(token),JSON.stringify({user:user.id,pass_ver:user.pass_ver||0,expires})).run();await audit(env,user.username,'approval-session-started','10 minute owner review session');return json({proof:token,expires});
}
async function checkOwnerApprovalSession(env,user,proof){
 if(typeof proof!=='string'||!proof.startsWith('approval-session:'))return false;
 const row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind('owner:approval-session:'+await sha256(proof)).first();if(!row)fail('Approval session expired. Verify again.',403);
 const r=JSON.parse(row.value_json),current=await env.DB.prepare("SELECT pass_ver,role,kind FROM users WHERE id=? AND status='active'").bind(user.id).first();
 if(!current||current.role!=='owner'||current.kind!=='staff'||r.user!==user.id||r.pass_ver!==(current.pass_ver||0)||r.expires<=Date.now())fail('Approval session expired or revoked. Verify again.',403);return true;
}
