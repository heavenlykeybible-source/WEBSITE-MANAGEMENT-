import {preserveBindings} from './preserve-bindings.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!/^[a-f0-9]{32}$/.test(account||''))throw Error('Configure dedicated BIBLE_CLOUDFLARE_API_TOKEN and BIBLE_CLOUDFLARE_ACCOUNT_ID (or ACCOUNT6 equivalents).');
const worker='heavenly-key-bible';
const api=async suffix=>{const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}${suffix}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(20000)});let data;try{data=await r.json();}catch{throw Error('Cloudflare returned an invalid response. No deployment attempted.');}if(!r.ok||data.success!==true)throw Error(`Cannot inspect existing Bible Worker (${r.status}). Verify the dedicated account, existing Worker and token permissions. No deployment attempted.`);return data.result;};
const [settings,subdomain,schedules]=await Promise.all([api('/settings'),api('/subdomain'),api('/schedules')]);
const config=preserveBindings({settings,subdomain,schedules,root,account,worker});
fs.mkdirSync('.deploy',{recursive:true});const target=path.join(root,'.deploy/wrangler.json');
fs.writeFileSync(target,JSON.stringify(config,null,2),{mode:0o600});
console.log(`Verified existing ${worker}; preserving ${settings.bindings?.length||0} bindings and ${config.triggers.crons.length} schedules. Secrets are never printed.`);
try{const r=spawnSync(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'deploy','--config',target,'--keep-vars'],{stdio:'inherit',env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'}});if(r.status!==0)process.exitCode=r.status||1;}finally{fs.rmSync(target,{force:true});}
