import {build} from 'esbuild';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,worker='heavenlykey-cms-public';
if(!account||!token)throw Error('Saved Account 4 deployment credentials are required');
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
async function api(path,init={}){const r=await fetch(base+path,{...init,headers:{Authorization:'Bearer '+token,...init.headers}});const d=await r.json();if(!r.ok||!d.success)throw Error('Existing public assistant access denied: HTTP '+r.status);return d.result;}
const settings=await api('/settings');if(!settings.bindings?.some(x=>x.name==='DB'&&x.type==='d1'))throw Error('Existing public assistant database binding missing');
const bundle=await build({entryPoints:['public-assistant/worker.mjs'],bundle:true,format:'esm',platform:'neutral',write:false,target:'es2022'});
const metadata={main_module:'assistant.mjs',compatibility_date:settings.compatibility_date||'2026-10-01',compatibility_flags:[...new Set([...(settings.compatibility_flags||[]),'global_fetch_strictly_public'])],keep_bindings:[...new Set(settings.bindings.map(x=>x.type).concat('secret_text'))],keep_assets:true};
const f=new FormData();f.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));f.set('assistant.mjs',new Blob([bundle.outputFiles[0].text],{type:'application/javascript+module'}),'assistant.mjs');await api('',{method:'PUT',body:f});
await api('/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
console.log('Updated existing public assistant; bindings and secret names retained; public endpoint enabled.');
