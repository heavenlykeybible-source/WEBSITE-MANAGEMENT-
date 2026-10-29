const HK_DOMAIN_HOSTS=['controlroom.heavenlykey.org','radio.heavenlykey.org','meeting.heavenlykey.org','editor.heavenlykey.org','mediaguru.heavenlykey.org','meetingspace.heavenlykey.org','socialplus.heavenlykey.org'];
async function domainZoneRead(env,conn,path,permission){
 const token=await unseal(env,conn.token_enc);
 const response=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});
 let data;try{data=await response.json();}catch{fail('Cloudflare returned an unreadable domain response. Saved credentials were preserved.',502);}
 if(!response.ok||data.success!==true){
  const codes=(Array.isArray(data.errors)?data.errors:[]).map(e=>e.code).filter(c=>Number.isSafeInteger(c)).slice(0,8);
  const stage=path.includes('/dns_records')?'DNS records': 'zone lookup';
  fail('Cloudflare '+stage+' check failed (HTTP '+response.status+(codes.length?'; error codes '+codes.join(', '):'')+'). Selected connection: '+conn.id+'. This request needs '+permission+' for heavenlykey.org. The response alone does not establish whether the cause is the saved token, resource scope, account selection or provider restrictions. Saved credentials were preserved.',response.status===401||response.status===403?403:502);
 }
 return data;
}
async function inspectHeavenlyDomains(env,connection){
 const conn=await connById(env,connection);
 const zones=await domainZoneRead(env,conn,'/zones?name=heavenlykey.org&account.id='+encodeURIComponent(conn.account_id)+'&per_page=50','Zone: Read');
 const zone=(zones.result||[]).find(z=>z.name==='heavenlykey.org'&&z.account?.id===conn.account_id);
 if(!zone)fail('heavenlykey.org was not found in the selected account. Select the main-domain Account 1 connection.',403);
 if(zone.status!=='active')fail('The heavenlykey.org zone is not active. No DNS changes were made.',409);
 const hosts=await Promise.all(HK_DOMAIN_HOSTS.map(async hostname=>{
  const records=await domainZoneRead(env,conn,'/zones/'+zone.id+'/dns_records?name='+encodeURIComponent(hostname)+'&per_page=100','DNS: Read');
  if(records.result_info?.total_pages>1)fail('Too many records for '+hostname+'; inspect the zone before changing it.',409);
  return {hostname,records:(records.result||[]).filter(r=>['A','AAAA','CNAME'].includes(r.type)).map(r=>({id:r.id,type:r.type,name:r.name,content:r.content,proxied:r.proxied,ttl:r.ttl}))};
 }));
 let workerDomains=[],routingNotice='';
 try{workerDomains=(await cf(env,conn,'GET','/workers/domains')).result||[];}catch{routingNotice='Worker domain mappings could not be read. DNS read access does not prove Worker routing access.';}
 return {connection:Number(connection),label:conn.label,zone:{id:zone.id,name:zone.name,status:zone.status},hosts:hosts.map(h=>({...h,workers:workerDomains.filter(w=>w.hostname===h.hostname).map(w=>({hostname:w.hostname,service:w.service,enabled:w.enabled}))})),routing_notice:routingNotice,notice:'Read-only check through Account 4. No DNS, Worker or permissions were changed. DNS records alone do not prove that a subdomain serves the intended application.'};
}
async function domainWorkspaceRoutes(req,env,user,sub,m){
 if(sub!=='domains/inspect')return null;
 if(user.role!=='owner'||user.kind!=='staff')fail('Owner access required',403);
 if(m!=='GET')fail('Method not allowed',405);
 const connection=new URL(req.url).searchParams.get('connection');if(!/^[1-9][0-9]*$/.test(connection||''))fail('Select the saved Account 1 connection');
 return json(await inspectHeavenlyDomains(env,Number(connection)));
}
async function inspectDomainsTool(env,actor,args){await browserAgentOwner(env,actor);return inspectHeavenlyDomains(env,args.connection);}

const MCP_SUBDOMAIN_TOOL={name:'propose_worker_subdomain',description:'Prepare a new heavenlykey.org subdomain for an existing Worker in the same saved account. Refuses existing DNS/mappings; owner approves the exact hostname and Worker before any write.',inputSchema:{type:'object',properties:{connection:{type:'integer'},hostname:{type:'string'},worker:{type:'string'}},required:['connection','hostname','worker'],additionalProperties:false}};
async function checkNewWorkerDomain(env,connection,hostname,worker){
 if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.heavenlykey\.org$/.test(hostname||''))fail('Choose one new subdomain under heavenlykey.org');
 if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(worker||''))fail('Choose an existing Worker');
 const conn=await connById(env,connection),zones=await domainZoneRead(env,conn,'/zones?name=heavenlykey.org&account.id='+encodeURIComponent(conn.account_id)+'&per_page=50','Zone: Read');
 const zone=(zones.result||[]).find(z=>z.name==='heavenlykey.org'&&z.account?.id===conn.account_id&&z.status==='active');if(!zone)fail('Active heavenlykey.org zone is not in this saved account',409);
 const dns=await domainZoneRead(env,conn,'/zones/'+zone.id+'/dns_records?name='+encodeURIComponent(hostname)+'&per_page=100','DNS: Read');
 if(dns.result?.length||dns.result_info?.total_pages>1)fail('This hostname already has DNS records. Existing records will not be replaced.',409);
 const domains=await cf(env,conn,'GET','/workers/domains');if((domains.result||[]).some(d=>d.hostname===hostname))fail('This hostname already has a Worker mapping',409);
 await cf(env,conn,'GET','/workers/scripts/'+encodeURIComponent(worker)+'/settings');
 return {conn,zone};
}
async function prepareWorkerDomain(env,actor,args){
 if(actor?.a && (!await sharedAIGrant(env,actor.a,args.connection)))fail('Request shared account access before preparing a subdomain',403);
 const checked=await checkNewWorkerDomain(env,Number(args.connection),args.hostname,args.worker),owner=await env.DB.prepare("SELECT id FROM users WHERE role='owner' AND kind='staff' AND status='active'").first();if(!owner)fail('Owner unavailable',403);
 const r={id:crypto.randomUUID(),user:owner.id,agent:actor?.a?.id||null,connection:checked.conn.id,account_id:checked.conn.account_id,label:checked.conn.label,zone_id:checked.zone.id,hostname:args.hostname,worker:args.worker,status:'waiting',expires:Date.now()+86400000};
 await env.DB.prepare('INSERT INTO settings(key,value_json) VALUES(?,?)').bind('domains:request:'+r.id,JSON.stringify(r)).run();await audit(env,'agent:'+(r.agent||'owner'),'subdomain-prepared',r.hostname+' -> '+r.worker);return r;
}
async function domainApprovalRoutes(req,env,user,sub,m){
 if(!['domains/requests','domains/prepare','domains/decide'].includes(sub))return null;
 if(user.kind!=='staff'||user.role!=='owner')fail('Owner access required',403);
 if(sub==='domains/requests'&&m==='GET'){const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE 'domains:request:%' ORDER BY updated_at DESC LIMIT 100").all();return json({requests:rows.results.map(r=>JSON.parse(r.value_json)).filter(r=>r.user===user.id)});}
 if(sub==='domains/prepare'&&m==='POST')return json(await prepareWorkerDomain(env,null,await body(req)));
 if(sub!=='domains/decide'||m!=='POST')fail('Method not allowed',405);
 const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(b.id||'')||!['approve','decline'].includes(b.decision))fail('Choose Approve or Decline');
 return withOperationLock(env,'domains:'+b.id,async()=>{
 const key='domains:request:'+b.id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();if(!row)fail('Request not found',404);const r=JSON.parse(row.value_json);if(r.user!==user.id||r.status!=='waiting'||r.expires<Date.now())fail('Request expired or already decided',409);
 const save=()=>env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(r),key).run();
 if(b.decision==='decline'){r.status='declined';await save();return json({status:r.status});}
 await reauthenticate(env,user,b.password);
 return withOperationLock(env,'domain-host:'+r.hostname,async()=>{
 const {conn,zone}=await checkNewWorkerDomain(env,r.connection,r.hostname,r.worker);if(conn.account_id!==r.account_id||zone.id!==r.zone_id)fail('Saved account changed. Prepare a new request.',409);
 r.status='applying';await save();
 try{const result=await cf(env,conn,'PUT','/workers/domains',{hostname:r.hostname,service:r.worker,zone_id:r.zone_id,enabled:true});if(result.result?.hostname!==r.hostname||result.result?.service!==r.worker)throw Error('Cloudflare did not confirm the exact mapping');r.status='succeeded';r.domain_id=result.result.id;await save();await audit(env,user.username,'subdomain-created',r.hostname+' -> '+r.worker);return json({status:r.status,hostname:r.hostname,notice:'Cloudflare confirmed the domain mapping. DNS/TLS and live application behavior still need verification.'});}
 catch(e){r.status='uncertain';await save();await audit(env,user.username,'subdomain-uncertain',r.id);fail('Subdomain result is uncertain. Inspect Cloudflare mapping before any retry. '+e.message,502);}
 });
 });
}
