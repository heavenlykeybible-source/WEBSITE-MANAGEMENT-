const HK_DOMAIN_HOSTS=['studioroom.heavenlykey.org','controlroom.heavenlykey.org','app.heavenlykey.org','bible.heavenlykey.org','global.heavenlykey.org','meeting.heavenlykey.org','mediaeditor.heavenlykey.org','radio.heavenlykey.org'];
async function domainZoneRead(env,conn,path,permission){
 const token=await unseal(env,conn.token_enc);
 const response=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});
 let data;try{data=await response.json();}catch{fail('Cloudflare returned an unreadable domain response. Saved credentials were preserved.',502);}
 if(!response.ok||data.success!==true)fail('Cloudflare domain check failed (HTTP '+response.status+'). This operation requires '+permission+' on heavenlykey.org in the selected account. Saved credentials were preserved.',response.status===401||response.status===403?403:502);
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
