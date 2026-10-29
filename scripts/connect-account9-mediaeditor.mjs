// Idempotent, single-domain Cloudflare Worker binding. Never deletes resources.
const token=process.env.CF_TOKEN;
if(!token)throw Error('Account 9 Cloudflare API token missing');
const base='https://api.cloudflare.com/client/v4/accounts/ceb3b48449319950191a4f6bae9b8b82/workers/domains';
const headers={Authorization:'Bearer '+token,'content-type':'application/json'};
const api=async(method='GET',body)=>{
  const response=await fetch(base,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000),redirect:'error'});
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result?.success)throw Error('Cloudflare domain API '+method+' failed (HTTP '+response.status+', error codes '+JSON.stringify((result?.errors||[]).map(e=>e.code))+')');
  return result.result;
};
const hostname='mediaguru.heavenlykey.org',service='heavenlykey-studio';
const domains=await api();
if(!Array.isArray(domains))throw Error('Unexpected Cloudflare domains listing');
const current=domains.find(d=>d.hostname===hostname);
if(current&&current.service!==service)throw Error('Hostname belongs to another Worker; refusing to overwrite');
if(!current?.enabled){
  const attached=await api('PUT',{hostname,service,zone_name:'heavenlykey.org',enabled:true,previews_enabled:false});
  if(attached.hostname!==hostname||attached.service!==service)throw Error('Unexpected attached domain response');
}
const final=await api();
if(!final.some(d=>d.hostname===hostname&&d.service===service&&d.enabled===true))throw Error('Domain attachment failed verification');
console.log('PASS mediaguru.heavenlykey.org is attached to heavenlykey-studio Worker');
