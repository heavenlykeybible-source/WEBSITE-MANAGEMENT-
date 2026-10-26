import {build} from 'esbuild';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,worker='heavenlykey-cms-public';
if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)throw Error('Saved Account 4 deployment credentials are required');
const root='https://api.cloudflare.com/client/v4/accounts/'+account,base=root+'/workers/scripts/'+worker;
async function api(url,init={}){const r=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...init.headers},signal:AbortSignal.timeout(60000)});const d=await r.json();if(!r.ok||!d.success)throw Error('Public assistant deployment failed: HTTP '+r.status+' codes '+(d.errors||[]).map(x=>x.code).join(','));return d.result;}
// Enumerate successfully before deciding the public Worker is absent. Never treat access denial as absence.
const scripts=await api(root+'/workers/scripts');
if(!Array.isArray(scripts))throw Error('Cannot verify existing Workers');
const existing=scripts.some(x=>x.id===worker);
let settings=existing?await api(base+'/settings'):null;
let isolated=!existing||settings.bindings?.some(x=>x.name==='LIMITS'&&['d1','durable_object_namespace'].includes(x.type));
let addedBindings=[];
if(!existing){
 // A new SQLite Durable Object stores only bounded public request counters.
 // Existing private CMS/member databases and their permissions are never needed.
 addedBindings=[{type:'durable_object_namespace',name:'LIMITS',class_name:'PublicChatLimits'},{type:'ai',name:'AI'}];
 console.log('Restoring missing public assistant with isolated request counters and Workers AI; private databases untouched.');
}else if(!Array.isArray(settings.bindings)||!(isolated?settings.bindings.some(x=>x.name==='AI'&&x.type==='ai'):settings.bindings.some(x=>x.name==='DB'&&x.type==='d1'))){throw Error('Existing assistant configuration cannot be safely identified');}
const bundle=await build({entryPoints:[isolated?'public-assistant/chat-worker.mjs':'public-assistant/worker.mjs'],bundle:true,format:'esm',platform:'neutral',write:false,target:'es2022'});
const metadata={main_module:'assistant.mjs',compatibility_date:settings?.compatibility_date||'2026-10-01',compatibility_flags:[...new Set([...(settings?.compatibility_flags||[]),'global_fetch_strictly_public'])],keep_bindings:[...new Set((settings?.bindings||[]).map(x=>x.type).concat('secret_text'))],...(settings?{keep_assets:true}:{bindings:addedBindings,migrations:{new_tag:'public-chat-v1',new_sqlite_classes:['PublicChatLimits']}})};
for(const key of ['observability','limits','placement','logpush','tail_consumers'])if(settings?.[key]!==undefined)metadata[key]=settings[key];
const f=new FormData();f.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));f.set('assistant.mjs',new Blob([bundle.outputFiles[0].text],{type:'application/javascript+module'}),'assistant.mjs');await api(base,{method:'PUT',body:f});
const after=await api(base+'/settings');
for(const b of settings?.bindings||addedBindings){const found=after.bindings?.find(x=>x.name===b.name&&x.type===b.type);if(!found||Object.entries(b).some(([k,v])=>JSON.stringify(found[k])!==JSON.stringify(v)))throw Error('Binding verification differs after upload. Inspect before retrying.');}
await api(base+'/subdomain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
const subdomain=await api(root+'/workers/subdomain'),origin='https://'+worker+'.'+subdomain.subdomain+'.workers.dev';
let health;for(let attempt=0;attempt<6;attempt++){health=await fetch(origin+'/health',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(health.ok)break;if(health.body)await health.body.cancel();if(attempt<5)await new Promise(resolve=>setTimeout(resolve,5000));}if(!health.ok)throw Error('Public assistant uploaded but health verification failed: '+health.status);
const probe=await fetch(origin+'/v1/assistant',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://apps.heavenlykey.org'},body:JSON.stringify({message:'What is the official Heavenly Key website?'}),signal:AbortSignal.timeout(30000)});
const result=await probe.json();if(!probe.ok||result.ok!==true||!result.response)throw Error('Public assistant uploaded but real inference failed: HTTP '+probe.status+' '+(result.code||result.error||'no response'));
console.log('SUCCESS: public assistant deployed at '+origin+'; preserved bindings, health and real AI response verified.');
