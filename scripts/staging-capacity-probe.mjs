#!/usr/bin/env node
// Controlled staging-only smoke/load probe. NEVER run against production.
// Usage: STAGING_BASE_URL=https://preview.example.test node scripts/staging-capacity-probe.mjs
// Maximum 5 concurrent clients and 100 requests: not a million-user certification.
const raw=process.env.STAGING_BASE_URL;
if(!raw)throw Error('STAGING_BASE_URL is required');
const base=new URL(raw);
if(base.protocol!=='https:')throw Error('HTTPS staging URL required');
if(!/(?:preview|staging|localhost|test|pages\.dev|workers\.dev)/i.test(base.hostname)||/(?:^|\.)heavenlykey\.org$/i.test(base.hostname))throw Error('Refusing non-staging host');
const total=Math.max(1,Math.min(100,Number(process.env.REQUESTS)||20));
const concurrency=Math.max(1,Math.min(5,Number(process.env.CONCURRENCY)||2));
const endpoint=process.env.PROBE_PATH||'/api/health';
if(!/^\/[\w\-/]*$/.test(endpoint)||endpoint.startsWith('//'))throw Error('Safe path required');
const url=new URL(endpoint,base);
if(url.origin!==base.origin)throw Error('Cross-origin probe forbidden');
let next=0;const results=[];
async function worker(){
 while(next<total){
  const index=next++,started=performance.now();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
   const response=await fetch(url,{method:'GET',redirect:'manual',headers:{Accept:'application/json'},signal:controller.signal});
   results[index]={status:response.status,ms:Math.round(performance.now()-started)};
   await response.body?.cancel();
  }catch(e){results[index]={status:'error',ms:Math.round(performance.now()-started),reason:e.name};}
  finally{clearTimeout(timer)}
 }
}
await Promise.all(Array.from({length:concurrency},worker));
const times=results.map(x=>x.ms).sort((a,b)=>a-b);
const percentile=p=>times[Math.min(times.length-1,Math.ceil(p*times.length)-1)];
const failures=results.filter(x=>x.status!=='error'&&(x.status<200||x.status>=400)||x.status==='error').length;
console.log(JSON.stringify({target:url.origin,path:url.pathname,requests:total,concurrency,failures,p50ms:percentile(.5),p95ms:percentile(.95),p99ms:percentile(.99),results},null,2));
if(failures)process.exitCode=1;
