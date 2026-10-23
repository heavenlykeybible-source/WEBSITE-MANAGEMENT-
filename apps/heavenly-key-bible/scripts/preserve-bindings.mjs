import path from 'node:path';
export function preserveBindings({settings,subdomain,schedules,root,account,worker='heavenly-key-bible'}){
if(!settings||!Array.isArray(settings.bindings)||typeof subdomain?.enabled!=='boolean')throw Error('Existing Worker settings are incomplete; deployment stopped.');
const config={name:worker,account_id:account,main:path.join(root,'bible/worker.js'),compatibility_date:'2025-01-01',keep_vars:true,send_metrics:false,workers_dev:subdomain.enabled===true,assets:{directory:path.join(root,'heavenly-key-website/bible'),binding:'ASSETS',run_worker_first:['/api/*','/health']}};
const required=(value,label)=>{if(typeof value!=='string'||!value.trim())throw Error(`Existing ${label} is incomplete; deployment stopped.`);return value;};
const append=(key,value)=>(config[key]??=[]).push(value);
// Reuse exact resource IDs. Never create, seed, migrate or clear a production resource.
for(const b of settings.bindings||[]){
 const name=required(b.name,'binding name');
 switch(b.type){
  case 'secret_text':case 'plain_text':case 'json':break; // Wrangler keep_vars and secret preservation retain these.
  case 'assets':if(name!=='ASSETS')throw Error('Unexpected asset binding; deployment stopped.');break;
  case 'kv_namespace':append('kv_namespaces',{binding:name,id:required(b.namespace_id,'KV namespace ID')});break;
  case 'r2_bucket':append('r2_buckets',{binding:name,bucket_name:required(b.bucket_name,'R2 bucket'),...(b.jurisdiction?{jurisdiction:b.jurisdiction}:{})});break;
  case 'd1':append('d1_databases',{binding:name,database_id:required(b.id,'D1 ID'),database_name:b.database_name||name});break;
  case 'service':append('services',{binding:name,service:required(b.service,'service name'),...(b.environment?{environment:b.environment}:{}),...(b.entrypoint?{entrypoint:b.entrypoint}:{})});break;
  case 'ai':if(config.ai)throw Error('Multiple AI bindings; deployment stopped.');config.ai={binding:name};break;
  default:throw Error(`Unsupported existing binding type ${b.type}. Deployment stopped to preserve resources.`);
 }
}
const cronList=Array.isArray(schedules)?schedules:schedules.schedules;
if(!Array.isArray(cronList))throw Error('Cannot verify existing cron triggers; deployment stopped.');
config.triggers={crons:cronList.map(x=>required(x.cron,'cron expression'))};

return config;
}
