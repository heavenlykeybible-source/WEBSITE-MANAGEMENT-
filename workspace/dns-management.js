// Account 4 DNS management: explicit owner approval required before mutation.
// Wire these helpers into the existing authenticated owner-only Control Room router.
// Never expose the API token to the browser or include it in audit records.
const DNS_HOST_RE=/^(?!-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export function validateDnsRequest(input){
 const name=String(input?.name||'').trim().toLowerCase();
 const type=String(input?.type||'').toUpperCase();
 const target=String(input?.target||'').trim();
 if(!DNS_HOST_RE.test(name)||name==='@'||name==='*')throw Error('Invalid subdomain label');
 if(!['A','AAAA','CNAME'].includes(type))throw Error('Only A, AAAA and CNAME records are supported');
 if(type==='CNAME'){
  if(target.length>253||!target.includes('.')||!target.split('.').every(x=>DNS_HOST_RE.test(x)))throw Error('Invalid CNAME target');
 }else if(type==='A'){
  if(!/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(target)||target.split('.').some(x=>Number(x)>255||String(Number(x))!==x))throw Error('Invalid IPv4 address');
 }else if(!/^[0-9a-f:]+$/i.test(target)||!target.includes(':')||target.length>39)throw Error('Invalid IPv6 address');
 return {name,type,target,proxied:type==='CNAME'||type==='A'||type==='AAAA'};
}
export async function cloudflareDnsRequest({token,zoneId,method='GET',recordId='',body,fetcher=fetch}){
 if(!/^[a-f0-9]{32}$/i.test(zoneId))throw Error('Invalid zone ID');
 if(!token||token.length<20)throw Error('Missing DNS API credential');
 if(!['GET','POST','PATCH','DELETE'].includes(method))throw Error('Unsupported DNS operation');
 if(recordId&&!/^[a-f0-9]{32}$/i.test(recordId))throw Error('Invalid record ID');
 const url='https://api.cloudflare.com/client/v4/zones/'+zoneId+'/dns_records'+(recordId?'/'+recordId:'');
 const response=await fetcher(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 const data=await response.json();
 if(!response.ok||!data.success)throw Error('Cloudflare DNS request failed ('+response.status+')');
 return data.result;
}
export function proposedDnsRecord(input,zoneName){
 const r=validateDnsRequest(input);
 if(zoneName!=='heavenlykey.org')throw Error('Unexpected DNS zone');
 return {type:r.type,name:r.name+'.'+zoneName,content:r.target,ttl:1,proxied:r.proxied};
}
// Call only after a separately stored, unexpired owner approval is validated.
// The approval must bind the exact record body, zone and action.
export async function executeApprovedDnsCreate({approval,token,zoneId,fetcher}){
 if(!approval||approval.action!=='dns.create'||approval.used||approval.expiresAt<=Date.now()||!approval.ownerApproved)throw Error('Owner approval required');
 const record=proposedDnsRecord(approval.request,'heavenlykey.org');
 if(JSON.stringify(record)!==approval.approvedRecordJson)throw Error('Approved DNS record changed');
 const result=await cloudflareDnsRequest({token,zoneId,method:'POST',body:record,fetcher});
 return {id:result.id,name:result.name,type:result.type,content:result.content};
}
