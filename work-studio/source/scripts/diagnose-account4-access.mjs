// Read-only diagnostic. No access settings, tokens or production resources are changed.
const id=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!id||!token)throw Error('Account 4 API credentials missing');
const hdr={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function get(path){
 try{
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+id+path,{headers:hdr});
  const j=await r.json();
  return {status:r.status,success:j.success===true,errors:(j.errors||[]).map(e=>e.code||'unknown'),result:j.result};
 }catch(e){return {status:'network-failure',error:String(e)};}
}
for(const [key,path] of [['organization','/access/organizations'],['applications','/access/apps?per_page=100'],['policies','/access/policies?per_page=100']]){
 const x=await get(path);
 const summary={kind:key,status:x.status,success:x.success,errors:x.errors};
 if(key==='organization')summary.teamDomain=x.result?.auth_domain||x.result?.name||'not-configured';
 if(key==='applications')summary.apps=(Array.isArray(x.result)?x.result:[]).filter(a=>/heavenly|review|recovery|website|update/i.test(a.name||a.domain||'')).map(a=>({name:a.name,domain:a.domain,audReady:!!a.aud,type:a.type}));
 if(key==='policies')summary.count=Array.isArray(x.result)?x.result.length:0;
 console.log(JSON.stringify(summary));
}
for(const [name,url] of [
 ['control','https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev/'],
 ['preview1','https://heavenlykey-review-1.emmanuel2026miracle.workers.dev/']
]){
 try{
  const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000)});
  console.log(JSON.stringify({kind:'public_http_probe',name,http:r.status,locationDomain:(r.headers.get('location')||'').split('/')[2]||null,bodyStart:(await r.text()).slice(0,160)}));
 }catch(e){console.log(JSON.stringify({kind:'public_http_probe',name,error:String(e)}));}
}
