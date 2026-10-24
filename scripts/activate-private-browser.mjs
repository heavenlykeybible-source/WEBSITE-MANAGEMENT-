import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const expectedAccount='404ebf05a781fcccbbed44aeb02cb72b',worker='website-management',helper='heavenlykey-browser',stateFile='.browser-activation-state.json';
export function bindingManifest(bindings){return bindings.map(b=>({name:b.name,hash:createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[z])=>a.localeCompare(z))))).digest('hex')})).sort((a,b)=>a.name.localeCompare(b.name));}
export function inheritedBrowserBindings(bindings){if(!Array.isArray(bindings)||!bindings.some(b=>b.name==='DB'&&b.type==='d1')||!bindings.some(b=>b.name==='FILES'&&b.type==='r2_bucket'))throw Error('Existing Control Room resources are missing');const current=bindings.find(b=>b.name==='BROWSER_AGENT');if(current&&(current.type!=='service'||current.service!==helper))throw Error('BROWSER_AGENT already targets another service; manual review required');return [...bindings.filter(b=>b.name!=='BROWSER_AGENT').map(b=>({name:b.name,type:'inherit'})),{name:'BROWSER_AGENT',type:'service',service:helper}];}
export async function activate(action,{account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,request=fetch,load=async()=>JSON.parse(await readFile(stateFile,'utf8')),save=async d=>writeFile(stateFile,JSON.stringify(d)),checkHealth=async()=>{const r=await fetch('https://controlroom.heavenlykey.org/',{redirect:'manual',signal:AbortSignal.timeout(15000)});if(r.body)await r.body.cancel();if(r.status!==200)throw Error('Control Room health check returned '+r.status);}}={}){
 if(account!==expectedAccount||!token)throw Error('Exact Account 4 credentials are required');
 const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/';
 async function api(name,path='',init={}){const r=await request(base+name+path,{...init,headers:{authorization:'Bearer '+token,...init.headers},redirect:'manual',signal:AbortSignal.timeout(30000)});const d=await r.json().catch(()=>({}));if(!r.ok||d.success!==true)throw Object.assign(Error('Cloudflare '+(init.method||'GET')+' '+name+path+' denied: HTTP '+r.status+'; provider codes '+(d.errors||[]).map(x=>x.code).join(',')),{status:r.status});return d.result;}
 const before=await api(worker,'/settings');inheritedBrowserBindings(before.bindings);
 if(action==='snapshot'){
  let helperExists=false;try{const existing=await api(helper,'/settings');helperExists=true;if((existing.bindings||[]).some(b=>!['browser','plain_text','secret_text'].includes(b.type)))throw Error('Private helper has unexpected persistent resources; no upload allowed');}catch(e){if(e.status!==404)throw e;}
  await checkHealth();const deployments=await api(worker,'/deployments'),current=(deployments.deployments||[]).sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on))[0];if(!current?.versions?.length)throw Error('Previous active deployment is unavailable');
  await save({account,worker,bindings:bindingManifest(before.bindings),versions:current.versions,helper_exists:helperExists,captured_at:new Date().toISOString()});console.log('Previous healthy Control Room deployment and binding fingerprints saved; no secret values stored.');return;
 }
 if(!['attach','deploy'].includes(action))throw Error('Use snapshot, deploy or attach');
 const saved=await load();if(saved.account!==account||saved.worker!==worker||JSON.stringify(bindingManifest(before.bindings))!==JSON.stringify(saved.bindings))throw Error('Control Room changed after snapshot; stop and review');
 if(action==='deploy'){const args=['--yes','wrangler@4.45.0','deploy','--config','browser-agent/wrangler.jsonc'];if(saved.helper_exists)args.push('--keep-vars');const result=spawnSync('npx',args,{stdio:'inherit',env:process.env});if(result.status!==0)throw Error('Private browser helper deployment failed; Control Room bindings were not changed');return;}
 const runtime=await api(helper,'/settings');if(!(runtime.bindings||[]).some(b=>b.name==='HK_BROWSER'&&b.type==='browser'))throw Error('Private browser helper is not correctly deployed');
 const metadata=new FormData();metadata.set('settings',new Blob([JSON.stringify({bindings:inheritedBrowserBindings(before.bindings)})],{type:'application/json'}));
 let changed=false;try{
  await api(worker,'/settings',{method:'PATCH',body:metadata});changed=true;
  const after=await api(worker,'/settings');for(const old of saved.bindings){const actual=bindingManifest(after.bindings).find(b=>b.name===old.name);if(!actual||actual.hash!==old.hash)throw Error('An existing binding changed: '+old.name);}
  if(!(after.bindings||[]).some(b=>b.name==='BROWSER_AGENT'&&b.type==='service'&&b.service===helper))throw Error('Browser service binding was not applied');await checkHealth();
  console.log('Private Heavenly Key browser connected; all original bindings and credential names preserved. No billing plan or database changed. Browser task execution still needs an owner-approved task.');
 }catch(e){if(changed){await api(worker,'/deployments',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({strategy:'percentage',versions:saved.versions,annotations:{'workers/message':'Restore Control Room after failed private-browser binding check'}})});console.error('Previous Control Room deployment restored after activation verification failed.');}throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await activate(process.argv[2]);
