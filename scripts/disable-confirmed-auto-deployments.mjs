import {fileURLToPath} from 'node:url';
export async function disableConfirmedAutomation(env,request=fetch){
 const mode=env.CLEANUP_TARGET,expected=mode==='account4-worker'?'404ebf05a781fcccbbed44aeb02cb72b':mode==='account3-pages'?'cd095c096c2d5a42501e7d77cecbb34c':null;
 if(!expected||env.CLOUDFLARE_ACCOUNT_ID!==expected||!env.CLOUDFLARE_API_TOKEN)throw Error('Exact authorized account and existing API credential required');
 const base='https://api.cloudflare.com/client/v4/accounts/'+expected;
 async function api(path,method='GET',body){const r=await request(base+path,{method,headers:{Authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});let data;try{data=await r.json()}catch{throw Error('Cloudflare returned unreadable automation status')};if(!r.ok||data.success!==true)throw Error('Cloudflare automation permission denied: HTTP '+r.status+'; codes '+(data.errors||[]).map(e=>e.code).join(',')+'. Workers Builds requires a user-scoped token with Workers Builds Configuration: Edit; Pages requires Pages: Edit. No credential or application data was changed.');return data.result;}
 if(mode==='account4-worker'){
  const workers=await api('/workers/scripts'),worker=workers.find(w=>w.id==='website-management');if(!worker||!/^[a-f0-9]{32}$/i.test(worker.tag||''))throw Error('Exact existing Control Room Worker tag unavailable');
  const list=async()=>{const r=await api('/builds/workers/'+worker.tag+'/triggers');return Array.isArray(r)?r:r?.triggers||[];};
  const rows=await list();for(const row of rows){if(!/^[a-f0-9-]{36}$/i.test(row.trigger_uuid||''))throw Error('Unexpected build trigger identity');}
  for(const row of rows)await api('/builds/triggers/'+row.trigger_uuid,'DELETE');
  if((await list()).length)throw Error('Automatic Worker triggers remain. Do not report cleanup complete.');
  console.log('VERIFIED: Account 4 website-management automatic Worker build triggers removed; unfinished trigger builds cancelled. Worker, bindings, data and secrets untouched.');
 }else{
  const path='/pages/projects/globalcommunity',project=await api(path);if(project.name!=='globalcommunity')throw Error('Unexpected Pages project');
  if(!project.source){console.log('VERIFIED: Account 3 globalcommunity has no source build integration.');return;}
  const config={...project.source.config,production_deployments_enabled:false,preview_deployment_setting:'none'};
  await api(path,'PATCH',{source:{type:project.source.type,config}});
  const after=await api(path);if(after.source?.config?.production_deployments_enabled!==false||after.source?.config?.preview_deployment_setting!=='none')throw Error('Pages automatic deployments are not confirmed disabled');
  console.log('VERIFIED: Account 3 globalcommunity automatic production and preview builds disabled; current deployment, bindings and data retained.');
 }
}
if(process.argv[1]===fileURLToPath(import.meta.url))await disableConfirmedAutomation(process.env);
