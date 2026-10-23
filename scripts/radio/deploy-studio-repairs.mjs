import {repairStudioSource} from './studio-repairs.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const token=process.env.ACCOUNT_2_TOKEN;
if(!token)throw Error('ACCOUNT_2_TOKEN is required.');
const root='https://api.cloudflare.com/client/v4/accounts/c324d871146f8fcc5e7dcd3da057011c/workers/scripts/heavenlykey-media';
const headers={Authorization:'Bearer '+token};
async function settings(){const r=await fetch(root+'/settings',{headers,signal:AbortSignal.timeout(20000)}),d=await r.json();if(!r.ok||!d.success)throw Error('Cannot read existing studio settings.');return d.result;}
const before=await settings();
const response=await fetch(root+'/content/v2',{headers,signal:AbortSignal.timeout(20000)});
if(!response.ok)throw Error('Cannot read existing studio source: HTTP '+response.status);
if(!(response.headers.get('content-type')||'').includes('multipart/form-data'))throw Error('Expected existing studio module archive.');
const modules=await response.formData();let changed=0;
for(const[name,value]of [...modules]){
  if(name==='metadata'||typeof value==='string'||!name.endsWith('.js'))continue;
  const text=await value.text();
  if(!text.includes('// src/embedded-manifest.ts'))continue;
  const repaired=repairStudioSource(text);
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'studio-audit-'));
  const candidate=path.join(directory,'candidate.mjs');await fs.writeFile(candidate,repaired.source);
  const test=spawnSync(process.execPath,['--experimental-vm-modules','tests/current-studio-audit.mjs',candidate],{encoding:'utf8'});
  if(test.status!==0)throw Error('Studio fixture checks failed before deployment: '+test.stderr+test.stdout);
  console.log(test.stdout);
  if(repaired.changes.length){modules.set(name,new Blob([repaired.source],{type:value.type||'application/javascript+module'}),value.name);changed++;console.log('Studio repairs: '+repaired.changes.join('; '));}
}
if(changed>1)throw Error('Unexpected multiple studio bundles; no update was sent.');
if(changed){
  // Content-only update retains the same entry point and every existing binding.
  const entry=response.headers.get('cf-entrypoint');
  const uploadHeaders={...headers};if(entry)uploadHeaders['CF-WORKER-MAIN-MODULE-PART']=entry;
  const result=await fetch(root+'/content',{method:'PUT',headers:uploadHeaders,body:modules,signal:AbortSignal.timeout(30000)});
  const data=await result.json();if(!result.ok||!data.success)throw Error('Studio content update failed: HTTP '+result.status+'; codes '+data.errors?.map(e=>e.code).join(','));
}
const after=await settings();
if(JSON.stringify(before.bindings)!==JSON.stringify(after.bindings))throw Error('Existing binding preservation verification failed.');
const origin='https://heavenlykey-media.faithofourfatherstv.workers.dev';
const home=await fetch(origin+'/',{signal:AbortSignal.timeout(15000)});
if(!home.ok)throw Error('Studio homepage verification failed.');
const js=await fetch(origin+'/js/studio-app.js?verified=20261023',{signal:AbortSignal.timeout(15000)});
if(!js.ok||!(await js.text()).includes("path==='capabilities'?'studio/capabilities':path"))throw Error('Updated studio frontend is not yet visible.');
console.log('Studio code repairs deployed. Existing bindings and secrets retained. No broadcasts, credentials or database records changed.');
