/**
 * Private Cloudflare DNS/Worker route operations for Account 4.
 * Never expose this module as an unauthenticated HTTP endpoint.
 * Caller must resolve token from encrypted vault AFTER owner-approved grant validation.
 */
const ROOT="https://api.cloudflare.com/client/v4";
const id=v=>{if(!/^[a-f0-9]{32}$/i.test(String(v)))throw Error("Invalid Cloudflare ID");return v;};
const host=(v,z)=>{v=String(v).trim().toLowerCase();z=String(z).trim().toLowerCase();if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v)||!v.endsWith("."+z)||v===z||v.length>253)throw Error("Hostname outside selected zone");return v;};
const worker=v=>{if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(String(v)))throw Error("Invalid Worker");return v;};
async function api(token,path,method="GET",data){if(!token)throw Error("Vault token missing");const r=await fetch(ROOT+path,{method,headers:{Authorization:"Bearer "+token,...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined});const j=await r.json().catch(()=>({}));if(!r.ok||!j.success)throw Error("Cloudflare operation failed: "+(j.errors||[]).map(x=>x.message).join("; "));return j.result;}
function authorize(grant,op,target){if(!grant||grant.status!=="approved"||grant.operation!==op||grant.used||grant.expiresAt&&(!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=Date.now()))throw Error("Active owner approval required");for(const [k,v] of Object.entries(target))if(grant[k]!==v)throw Error("Approval scope mismatch: "+k);}
export async function createDnsRecord({token,zoneId,zoneName,name,type,content,ttl=1,proxied=false,grant}) {
 id(zoneId);name=host(name,zoneName);type=String(type).toUpperCase();
 if(!["A","AAAA","CNAME","TXT"].includes(type))throw Error("Unsupported DNS type");
 if(typeof content!=="string"||!content||content.length>2048)throw Error("Invalid DNS value");
 if(!Number.isInteger(ttl)||ttl!==1&&(ttl<60||ttl>86400))throw Error("Invalid TTL");
 if(typeof proxied!=="boolean"||proxied&&!["A","AAAA","CNAME"].includes(type))throw Error("Invalid proxy setting");
 authorize(grant,"dns.create",{zoneId,name,type,content});
 const existing=await api(token,"/zones/"+zoneId+"/dns_records?name="+encodeURIComponent(name)+"&type="+type);
 if(existing.some(x=>x.content===content))return {status:"already_exists",id:existing.find(x=>x.content===content).id};
 if(existing.length)throw Error("Existing DNS record requires separate update approval");
 const result=await api(token,"/zones/"+zoneId+"/dns_records","POST",{type,name,content,ttl,proxied});
 return {status:"created",id:result.id,name};
}
export async function attachWorkerDomain({token,accountId,zoneId,zoneName,name,service,grant}) {
 id(accountId);id(zoneId);name=host(name,zoneName);service=worker(service);
 authorize(grant,"worker.domain.attach",{accountId,zoneId,name,service});
 const list=await api(token,"/accounts/"+accountId+"/workers/domains?zone_id="+zoneId+"&hostname="+encodeURIComponent(name));
 if(list.some(x=>x.hostname===name&&x.service!==service))throw Error("Hostname already assigned to another Worker");
 if(list.some(x=>x.hostname===name&&x.service===service))return {status:"already_attached",name};
 const result=await api(token,"/accounts/"+accountId+"/workers/domains","PUT",{hostname:name,service,zone_id:zoneId,environment:"production"});
 return {status:"submitted",id:result?.id,name};
}
export async function createWorkerRoute({token,zoneId,zoneName,pattern,script,grant}) {
 id(zoneId);script=worker(script);
 if(typeof pattern!=="string"||!pattern.endsWith("/*"))throw Error("Only subdomain-wide /* routes supported");
 const routeHost=host(pattern.slice(0,-2),zoneName);
 authorize(grant,"worker.route.create",{zoneId,pattern,script});
 const list=await api(token,"/zones/"+zoneId+"/workers/routes");
 const same=list.find(x=>x.pattern===pattern);
 if(same){if(same.script===script)return {status:"already_exists",id:same.id};throw Error("Route conflict requires separate approval");}
 const result=await api(token,"/zones/"+zoneId+"/workers/routes","POST",{pattern,script});
 return {status:"created",id:result.id,hostname:routeHost};
}
export async function listDomainResources({token,accountId,zoneId,name}) {
 id(accountId);id(zoneId);
 const [dns,routes,domains]=await Promise.all([
 api(token,"/zones/"+zoneId+"/dns_records?name="+encodeURIComponent(name)),
 api(token,"/zones/"+zoneId+"/workers/routes"),
 api(token,"/accounts/"+accountId+"/workers/domains?zone_id="+zoneId+"&hostname="+encodeURIComponent(name))
 ]);
 return {dns:dns.map(x=>({id:x.id,type:x.type,name:x.name,proxied:x.proxied})),routes:routes.filter(x=>x.pattern.startsWith(name+"/")),domains:domains.filter(x=>x.hostname===name)};
}
