import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';

const source = {account:'c324d871146f8fcc5e7dcd3da057011c', worker:'heavenlykey-media', token:process.env.ACCOUNT_2_TOKEN};
const radio = {account:process.env.CLOUDFLARE_RADIO_ACCOUNT_ID, worker:'heavenlykeyradio', token:process.env.CLOUDFLARE_RADIO_API_TOKEN};
if (!source.token || !radio.account || !radio.token) throw Error('The Account 2 token and Account 7 deployment secrets must all be configured.');
const endpoint = (target, suffix='') => `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(target.account)}/workers/scripts/${target.worker}${suffix}`;
async function api(target, url, options={}) {
  const response = await fetch(url, {...options, headers:{Authorization:'Bearer '+target.token, ...options.headers}, signal:AbortSignal.timeout(30000)});
  const data = await response.json();
  if (!response.ok || data.success === false) throw Error(`Cloudflare request failed (${response.status}; codes ${data.errors?.map(e=>e.code).join(',')||'unknown'}). No credential values are logged.`);
  return data.result;
}
const settings = target => api(target, endpoint(target, '/settings'));
const [beforeSource, beforeRadio] = await Promise.all([settings(source), settings(radio)]);
const originalBindings = beforeSource.bindings || [];
for (const name of ['DB','MEDIA_R2','LIVE_STATUS_KV','MEDIA_ENGINE_SHARED_SECRET']) {
  if (!originalBindings.some(b=>b.name===name)) throw Error('Account 2 is missing its existing required binding '+name+'; refusing to change the source.');
}
const subdomain = await api(source, `https://api.cloudflare.com/client/v4/accounts/${source.account}/workers/subdomain`);
if (!/^[a-z0-9-]+$/.test(subdomain.subdomain)) throw Error('Account 2 public Worker subdomain is invalid.');
const origin = `https://${source.worker}.${subdomain.subdomain}.workers.dev`;
const health = await fetch(origin+'/health', {redirect:'error', signal:AbortSignal.timeout(15000)});
if (!health.ok || (await health.json()).service !== 'heavenlykey-media-engine') throw Error('Account 2 Media Engine health check failed.');

// Preserve the deployed studio modules, not an older recovered studio build.
const contentResponse = await fetch(endpoint(source, '/content'), {headers:{Authorization:'Bearer '+source.token}, signal:AbortSignal.timeout(30000)});
if (!contentResponse.ok) throw Error('Cannot read the existing Account 2 code; refusing a replacement.');
const main = contentResponse.headers.get('cf-worker-main-module-part');
if (!main || /["'\r\n\\]/.test(main)) throw Error('Could not identify the existing module entry safely.');
const modules = new FormData();
if ((contentResponse.headers.get('content-type')||'').includes('multipart/form-data')) {
  const original = await contentResponse.formData();
  for (const [name, value] of original) if(name!=='metadata') {
    if(typeof value==='string')modules.append(name,value);else modules.append(name,value,value.name);
  }
} else modules.append(main, new Blob([await contentResponse.arrayBuffer()], {type:'application/javascript+module'}), main);
const currentMain = modules.get(main);
if (!currentMain) throw Error('Original Account 2 module is missing.');
const allCode = (await Promise.all([...modules.values()].map(value=>typeof value==='string'?value:value.text()))).join('\n');
if (!allCode.includes('media-engine-public-v1') || !allCode.includes('/api/broadcast/programme')) throw Error('The deployed studio uses a different listener API. Refusing to alter it without an exact adapter.');
console.log('Verified deployed Account 2 studio modules, required bindings, and public radio API.');

const keyExists = (targetSettings) => (targetSettings.bindings||[]).some(b=>b.name==='RADIO_PUBLIC_API_KEY');
let key = process.env.RADIO_PUBLIC_API_KEY;
if (keyExists(beforeSource)!==keyExists(beforeRadio) && !key) throw Error('One side already has a radio key. Supply the same key as RADIO_PUBLIC_API_KEY in GitHub secrets; existing keys will not be rotated.');
if (!keyExists(beforeSource) && !keyExists(beforeRadio)) key ||= randomBytes(32).toString('base64url');
if(key)console.log('::add-mask::'+key);

// For an existing supplied key, prove it is accepted before touching either side.
if(keyExists(beforeSource) && key && allCode.includes('hk-radio-source-adapter-v1')) {
  const probe=await fetch(origin+'/api/broadcast/programme?channel=radio',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});
  if(!probe.ok)throw Error('The supplied shared radio key was not accepted by Account 2. Existing credentials were kept.');
}
async function putSecret(target,name,text) {
  await api(target, endpoint(target,'/secrets'), {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,text,type:'secret_text'})});
}

// Add the key only when absent; leave every existing production secret intact.
if(!allCode.includes('hk-radio-source-adapter-v1')) {
  const wrapper='hk-radio-listener-entry.mjs', adapter='hk-radio-source-adapter.mjs';
  if(modules.has(wrapper)||modules.has(adapter))throw Error('Unexpected adapter module collision.');
  modules.append(adapter,new Blob([await fs.readFile(new URL('./radio-source-adapter.mjs',import.meta.url))],{type:'application/javascript+module'}),adapter);
  const relative='./'+main;
  const wrapperCode=`// hk-radio-source-adapter-v1\nimport upstream from ${JSON.stringify(relative)};\nexport * from ${JSON.stringify(relative)};\nimport {radioSourceAdapter} from './${adapter}';\nexport default radioSourceAdapter(upstream);\n`;
  modules.append(wrapper,new Blob([wrapperCode],{type:'application/javascript+module'}),wrapper);
  modules.append('metadata',new Blob([JSON.stringify({main_module:wrapper})],{type:'application/json'}));
  // Content-only update preserves runtime settings, bindings and stored assets.
  await api(source, endpoint(source,'/content'), {method:'PUT',body:modules});
}
if(!keyExists(beforeSource)) await putSecret(source,'RADIO_PUBLIC_API_KEY',key);
if(key){
 const programmeResponse=await fetch(origin+'/api/broadcast/programme?channel=radio',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(20000)});
 if(!programmeResponse.ok)throw Error('Account 2 did not accept the authenticated radio request (HTTP '+programmeResponse.status+').');
 const programme=await programmeResponse.json();
 if(!Array.isArray(programme.items))throw Error('Account 2 returned an unexpected programme response.');
}
if(!keyExists(beforeRadio))await putSecret(radio,'RADIO_PUBLIC_API_KEY',key);
if(!(beforeRadio.bindings||[]).some(b=>b.name==='MEDIA_PUBLIC_ORIGIN'))await putSecret(radio,'MEDIA_PUBLIC_ORIGIN',origin);
else if(beforeRadio.bindings.find(b=>b.name==='MEDIA_PUBLIC_ORIGIN')?.type==='plain_text' && beforeRadio.bindings.find(b=>b.name==='MEDIA_PUBLIC_ORIGIN')?.text!==origin)throw Error('A different source origin already exists. It was preserved.');
const afterSource=await settings(source);
for(const before of originalBindings) {
  const after=(afterSource.bindings||[]).find(b=>b.name===before.name);
  if(!after || JSON.stringify(before)!==JSON.stringify(after))throw Error('Account 2 binding verification failed for '+before.name);
}
const radioOrigin='https://heavenlykeyradio.heavenlykeyradio.workers.dev';
const publicResponse=await fetch(radioOrigin+'/api/broadcast/programme?channel=radio',{signal:AbortSignal.timeout(20000)});
if(!publicResponse.ok)throw Error('Account 7 connection verification failed (HTTP '+publicResponse.status+').');
const publicProgramme=await publicResponse.json();
if(!Array.isArray(publicProgramme.items))throw Error('Account 7 returned an invalid programme.');
const homepage=await fetch(origin+'/',{signal:AbortSignal.timeout(15000)});
if(!homepage.ok)throw Error('Account 2 studio homepage verification failed.');
console.log(`CONNECTED: Account 7 receives Account 2 programme metadata. Mode: ${publicProgramme.mode}. Items: ${publicProgramme.items.length}. Original studio modules and bindings retained.`);
if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`Account 7 connected directly to Account 2 (${origin}). Programme mode: ${publicProgramme.mode}; items: ${publicProgramme.items.length}. No live programme was started.\n`);
