import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function patchSocialPlus(source, origin) {
 const url=new URL(origin);
 assert.match(url.hostname,/^heavenly-key-social-management\.[a-z0-9-]+\.workers\.dev$/);
 assert.equal(url.protocol,'https:');
 assert.equal(url.origin,origin);
 const marker='const targets = Object.freeze({';
 assert.equal(source.split(marker).length,2,'Expected one existing fixed-target router');
 const mapping=/'socialplus\.heavenlykey\.org'\s*:\s*'[^']+'/g;
 const matches=[...source.matchAll(mapping)];
 assert.ok(matches.length<=1,'Duplicate SocialPlus mapping');
 const entry="'socialplus.heavenlykey.org': '"+origin+"'";
 return matches.length?source.replace(mapping,entry):source.replace(marker,marker+'\n  '+entry+',');
}

async function repair() {
 const routerAccount='a160ba9fc74911bd4b3005eac86eefcb',appAccount='c26cc139515e4f56b9fc7010bd98d1b5';
 const routerToken=process.env.CLOUDFLARE_API_TOKEN,appToken=process.env.ACCOUNT10_CLOUDFLARE_API_TOKEN;
 assert.ok(routerToken&&appToken,'Both existing account tokens are required');
 async function api(account,token,path,init={}) {
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{...init,headers:{Authorization:'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.ok(r.ok,'Cloudflare request failed: HTTP '+r.status+' at '+path);
  return r;
 }
 async function data(account,token,path) {const d=await (await api(account,token,path)).json();assert.equal(d.success,true,'Cloudflare rejected '+path);return d.result;}
 const suffix=(await data(appAccount,appToken,'/workers/subdomain')).subdomain;
 assert.match(suffix,/^[a-z0-9][a-z0-9-]{0,62}$/);
 const origin='https://heavenly-key-social-management.'+suffix+'.workers.dev';
 const root=await fetch(origin,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(root.status,200,'Existing SocialPlus Worker must serve a page before routing changes');
 const html=await root.text();assert.match(html,/socialplus|social management/i,'Existing Worker does not identify SocialPlus');
 const path='/workers/scripts/heavenlykey-portals';
 const settings=await data(routerAccount,routerToken,path+'/settings');
 const response=await api(routerAccount,routerToken,path);
 const modules=[];
 if((response.headers.get('content-type')||'').includes('multipart/form-data')) {
  for(const [name,value] of await response.formData())if(name!=='metadata')modules.push({name,text:typeof value==='string'?value:await value.text(),type:value.type||'application/javascript+module'});
 } else modules.push({name:settings.main_module||'worker.mjs',text:await response.text(),type:'application/javascript+module'});
 const entries=modules.filter(m=>m.text.includes('const targets = Object.freeze({'));
 assert.equal(entries.length,1);const entry=entries[0];
 // Back up all modules and non-secret settings before any write.
 await writeFile('socialplus-router-before.json',JSON.stringify({modules,settings:{...settings,bindings:(settings.bindings||[]).map(b=>({name:b.name,type:b.type}))}},null,2));
 const changed=patchSocialPlus(entry.text,origin);
 const candidate=await import('data:text/javascript;base64,'+Buffer.from(changed).toString('base64'));
 for(const method of ['GET','POST']) {
  let called=false;
  await candidate.route(new Request('https://socialplus.heavenlykey.org/api/test?q=1',{method,headers:{Origin:'https://socialplus.heavenlykey.org',Cookie:'fixture=session'},...(method==='POST'?{body:'{}'}:{})}),async request=>{
   called=true;assert.equal(request.url,origin+'/api/test?q=1');assert.equal(request.headers.get('Origin'),origin);assert.equal(request.headers.get('Cookie'),'fixture=session');return new Response('ok');
  });assert.ok(called);
 }
 assert.equal((await candidate.route(new Request('https://socialplus.heavenlykey.org/api/test',{method:'POST',headers:{Origin:'https://unrelated.example'}}),()=>{throw Error('Cross-site write forwarded');})).status,403);
 if(changed!==entry.text) {
  const metadata={main_module:entry.name,compatibility_date:settings.compatibility_date,compatibility_flags:settings.compatibility_flags||[],keep_bindings:[...new Set((settings.bindings||[]).map(b=>b.type))],keep_assets:true};
  for(const key of ['logpush','observability','tail_consumers','limits','placement','tags'])if(settings[key]!==undefined)metadata[key]=settings[key];
  const form=new FormData();form.set('metadata',new Blob([JSON.stringify(metadata)],{type:'application/json'}));
  for(const module of modules)form.set(module.name,new Blob([module===entry?changed:module.text],{type:module.type}),module.name);
  const d=await (await api(routerAccount,routerToken,path,{method:'PUT',body:form})).json();assert.equal(d.success,true,'Router deployment failed');
 }
 const live=await fetch('https://socialplus.heavenlykey.org/',{cache:'no-store',signal:AbortSignal.timeout(20000)});
 assert.equal(live.status,200,'Public SocialPlus verification failed; inspect deployment before retrying');
 assert.match(await live.text(),/socialplus|social management/i);
 console.log('SocialPlus routing deployed and public page verified. Provider integrations remain separate.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await repair();
