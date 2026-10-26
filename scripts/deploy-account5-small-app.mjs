import fs from 'node:fs/promises';import {buildSmallApp} from './build-small-app-worker.mjs';
const id=process.env.SMALL_APP_ID,{target,app,assets,revision,code}=await buildSmallApp(id),account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Account 5 credentials required');
const base='https://api.cloudflare.com/client/v4/accounts/'+account;
async function api(path,init={}){const r=await fetch(base+path,{...init,headers:{Authorization:'Bearer '+token,...init.headers},signal:AbortSignal.timeout(45000)});const d=await r.json();if(!r.ok||!d.success)throw Error('Account 5 small-app API failed HTTP '+r.status+' codes '+(d.errors||[]).map(x=>x.code).join(','));return d.result;}
const subdomain=await api('/workers/subdomain');if(subdomain.subdomain!=='heavenlykeyapp')throw Error('Wrong account. No upload made.');
const scripts=await api('/workers/scripts');if(!scripts.some(x=>x.id==='heavenly-key-app'))throw Error('Account 5 app directory missing. No upload made.');
const path='/workers/scripts/'+target.worker,exists=scripts.some(x=>x.id===target.worker),settings=exists?await api(path+'/settings'):null;
if(settings?.bindings?.length)throw Error('Unexpected bindings on static app Worker; inspect before replacing code.');
const previous=exists?await api(path+'/deployments'):null;await fs.mkdir('.release-state',{recursive:true});await fs.writeFile('.release-state/'+target.worker+'.json',JSON.stringify({worker:target.worker,app:id,previous,revision},null,2));
const metadata={main_module:'app.mjs',compatibility_date:settings?.compatibility_date||'2026-10-01',keep_bindings:['secret_text'],...(settings?{keep_assets:true}:{bindings:[]})};
for(const key of ['compatibility_flags','observability','limits','placement','logpush','tail_consumers'])if(settings?.[key]!==undefined)metadata[key]=settings[key];
const form=new FormData();form.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));form.set('app.mjs',new Blob([code],{type:'application/javascript+module'}),'app.mjs');await api(path,{method:'PUT',body:form});
await api(path+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
const origin='https://'+target.worker+'.heavenlykeyapp.workers.dev';let healthy=false;for(let n=0;n<8;n++){const r=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(15000),cache:'no-store'});if(r.ok){const health=await r.json();if(health.service===id&&health.revision===revision){healthy=true;break;}}else if(r.body)await r.body.cancel();if(n<7)await new Promise(r=>setTimeout(r,4000));}if(!healthy)throw Error('Uploaded app health not verified. Directory routing has not been switched.');
for(const [asset,expected]of Object.entries(assets)){const r=await fetch(origin+asset,{signal:AbortSignal.timeout(15000)});if(!r.ok||(await r.text())!==expected)throw Error('Published app asset differs: '+asset);}
console.log('SUCCESS: independent '+id+' Worker '+target.worker+' verified with all original public assets. Existing app URLs and private device records are untouched.');
