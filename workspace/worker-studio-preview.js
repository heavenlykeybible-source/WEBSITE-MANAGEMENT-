// Build an isolated Preview candidate. This module never contacts Cloudflare or publishes.
import {createHash} from 'node:crypto';
import {workerStudioRevision,workerStudioPreviewPolicy} from './worker-studio-policy.js';

const IDENT=/^[A-Za-z_][A-Za-z0-9_]*$/;
const ID=/^[a-z0-9][a-z0-9-]{0,62}$/;
const SHA=/^[a-f0-9]{64}$/;
const hash=s=>createHash('sha256').update(s).digest('hex');
function recordObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function rejectDangerous(value,path='configuration'){
 if(typeof value==='string'&&/(?:-----BEGIN .*PRIVATE KEY-----|\b(?:password|access_token|api_token|secret_key)\s*[:=])/i.test(value))throw Error('Potential credentials in '+path);
 if(Array.isArray(value)){value.forEach((x,i)=>rejectDangerous(x,path+'['+i+']'));return;}
 if(recordObject(value))for(const [key,item] of Object.entries(value)){
  if(/secret|password|credential|token|private.?key/i.test(key))throw Error('Secret-like configuration keys not allowed: '+path+'.'+key);
  rejectDangerous(item,path+'.'+key);
 }
}
export function buildIsolatedWorkerPreview(input){
 const revision=workerStudioRevision(input);
 const preview=String(input.preview_name||'');
 if(!ID.test(preview)||!preview.startsWith('review-'))throw Error('Use a named review- preview, not a production or default branch');
 const worker=revision.worker;
 const resourceMap=input.resources;
 if(!Array.isArray(resourceMap))throw Error('Explicit isolated resource manifest required');
 // Fail closed on incomplete inventories, including production-linked services.
 if(input.binding_inventory_verified!==true||!Array.isArray(input.production_binding_names))
  throw Error('Complete verified production binding inventory required');
 const names=input.production_binding_names;
 if(names.some(n=>typeof n!=='string'||!IDENT.test(n))||new Set(names).size!==names.length)
  throw Error('Invalid or duplicate production binding names');
 if(names.length!==resourceMap.length||resourceMap.some(x=>!names.includes(x?.binding)))
  throw Error('Every production binding must have an explicit preview-safe mapping');
 if(input.uses_service_bindings||input.has_unsupported_bindings)
  throw Error('Service or unsupported bindings may reach production; block preview');
 const seen=new Set(),d1=[],kv=[],r2=[];
 for(const item of resourceMap){
  if(!recordObject(item)||!['d1','kv','r2'].includes(item.type)||!IDENT.test(String(item.binding||'')))throw Error('Unsupported preview resource');
  if(seen.has(item.binding))throw Error('Duplicate preview binding');
  seen.add(item.binding);
  const production=String(item.production_id||'');
  const isolated=String(item.preview_id||'');
  if(!production||!isolated||production===isolated)throw Error('Preview must map an identified production resource to a separately allocated preview resource');
  if(item.type==='d1'){
   if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(isolated))throw Error('Invalid preview D1 database ID');
   d1.push({binding:item.binding,database_name:'preview-'+preview+'-'+item.binding.toLowerCase(),database_id:isolated});
  }else if(item.type==='kv'){
   if(!/^[a-f0-9]{32}$/i.test(isolated))throw Error('Invalid preview KV namespace ID');
   kv.push({binding:item.binding,id:isolated});
  }else{
   if(!ID.test(isolated))throw Error('Invalid preview R2 bucket name');
   r2.push({binding:item.binding,bucket_name:isolated});
  }
 }
 const env=input.variables||{};
 if(!recordObject(env)||Object.keys(env).some(k=>!IDENT.test(k)||k.startsWith('CF_')||k==='ENVIRONMENT'))throw Error('Invalid preview variables');
 rejectDangerous(env);
 const vars={...env,ENVIRONMENT:'preview'};
 const policy=workerStudioPreviewPolicy({isolated_environment:true,private_access:input.cloudflare_access_verified===true,no_automatic_publication:true,uses_production_bindings:false});
 const compatibility=String(input.compatibility_date||'');
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(compatibility))throw Error('Set an explicit compatibility date');
 const config={name:worker,main:'worker.mjs',compatibility_date:compatibility,previews:{vars}};
 if(d1.length)config.previews.d1_databases=d1;
 if(kv.length)config.previews.kv_namespaces=kv;
 if(r2.length)config.previews.r2_buckets=r2;
 const codeHash=hash(revision.source),configText=JSON.stringify(config,null,2)+'\n';
 const manifest=Object.freeze({connection:revision.connection,worker,preview_name:preview,
  baseline_sha256:revision.base_sha256,candidate_sha256:codeHash,
  config_sha256:hash(configText),status:'not-deployed',access:policy.access,verified_binding_names:[...names].sort(),
  approval:'required',notes:'Private Preview must be deployed and tested in a separate authorized execution environment. No Cloudflare write occurs here.'});
 return {config,configText,source:revision.source,manifest};
}
export function verifyWorkerPreviewPromotion(input){
 if(!recordObject(input)||!input.owner_approved||!input.access_verified||!input.smoke_tests_passed||!input.isolated_resources_verified)
  throw Error('Owner approval, private access, isolated resources and passing tests are all required');
 if(!SHA.test(String(input.candidate_sha256||''))||input.candidate_sha256!==input.approved_sha256)
  throw Error('Candidate differs from exact approved bytes');
 if(!SHA.test(String(input.live_baseline_sha256||''))||input.live_baseline_sha256!==input.original_baseline_sha256)
  throw Error('Production changed since review; reject stale deployment');
 if(!ID.test(String(input.worker||''))||!Number.isSafeInteger(input.connection)||input.connection<1)
  throw Error('Exact Worker/account is required');
 return Object.freeze({target:input.worker,connection:input.connection,candidate_sha256:input.candidate_sha256,ready_for_explicit_owner_release:true});
}
