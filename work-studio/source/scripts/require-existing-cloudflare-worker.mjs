#!/usr/bin/env node
/** HKEM production rule: normal deployments update an existing Worker only. */
const worker=process.argv[2], account=process.env.CLOUDFLARE_ACCOUNT_ID, token=process.env.CLOUDFLARE_API_TOKEN;
if(!worker||!/^[a-z0-9-]+$/.test(worker)) throw new Error('A fixed Worker name is required');
if(!account||!token) throw new Error('Cloudflare account/token are required');
const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/services/${worker}`,{headers:{Authorization:`Bearer ${token}`}});
if(r.status===404){console.error(`BLOCKED: Worker ${worker} does not already exist. HKEM normal deployment is UPDATE-ONLY.`);process.exit(42)}
const body=await r.json().catch(()=>null);
if(!r.ok||body?.success===false) throw new Error(`Unable to verify existing Worker ${worker} (HTTP ${r.status})`);
console.log(`UPDATE-ONLY verified: existing Worker ${worker}`);
