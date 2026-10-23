const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/.test(account||'')||!token)throw Error('Account 4 deployment credentials are required');
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function read(path){const r=await fetch(base+path,{headers:{authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});let d;try{d=await r.json();}catch{}return {status:r.status,success:r.ok&&d?.success===true,result:d?.result};}
const settings=await read('/workers/scripts/website-management/settings');
if(!settings.success)throw Error('Cannot read Account 4 Worker settings: '+settings.status);
console.log('Current browser binding: '+(settings.result.bindings||[]).some(b=>b.type==='browser'));
const subscriptions=await read('/subscriptions');
console.log('Account plan read HTTP '+subscriptions.status);
let free=false;
if(subscriptions.success){const plans=(subscriptions.result||[]).filter(s=>/workers/i.test(JSON.stringify(s.rate_plan||{})));free=plans.some(s=>/free/i.test(String(s.rate_plan?.id)+' '+String(s.rate_plan?.public_name)));console.log('Workers Free plan confirmed by API: '+free);}
const limits=await read('/browser-rendering/limits');
console.log('Browser runtime API read HTTP '+limits.status);
console.log('Browser runtime API access: '+limits.success);
console.log('No settings, resources, billing or credentials were changed.');
