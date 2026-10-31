import assert from 'node:assert/strict';
import fs from 'node:fs';
import {preserveBindings} from '../../scripts/preserve-bindings.mjs';

const input={
  root:process.cwd(),
  account:'a'.repeat(32),
  subdomain:{enabled:true},
  schedules:{schedules:[{cron:'*/5 * * * *'}]},
  settings:{bindings:[
    {type:'secret_text',name:'SESSION_SECRET'},
    {type:'plain_text',name:'MINISTRY_PUBLIC_API_ORIGIN',text:'private value must not be written'},
    {type:'kv_namespace',name:'SESSION_KV',namespace_id:'b'.repeat(32)},
    {type:'d1',name:'READ_PRAY_DB',id:'real-database-id'},
    {type:'r2_bucket',name:'MEDIA',bucket_name:'existing-media'},
    {type:'ai',name:'AI'},
    {type:'service',name:'PUSH_DISPATCHER',service:'existing-push-dispatcher'},
    {type:'assets',name:'ASSETS'},
  ]},
};

const c=preserveBindings(input);
assert.equal(c.keep_vars,true);
assert.equal(c.kv_namespaces[0].id,'b'.repeat(32));
assert.equal(c.d1_databases[0].database_id,'real-database-id');
assert.equal(c.r2_buckets[0].bucket_name,'existing-media');
assert.equal(c.services[0].service,'existing-push-dispatcher');
assert.equal(c.ai.binding,'AI');
assert.deepEqual(c.triggers.crons,['*/5 * * * *']);
assert(!JSON.stringify(c).includes('private value'));
assert(!('migrations' in c));
assert(!('vars' in c));

const expectedWorkerFirstPaths=[
  '/','/install','/install/','/api/*','/health','/study','/dictionary',
  '/concordance','/daily-routine','/strength-for-today',
  '/strength-for-today.html','/strength-devotionals-*',
];
assert.deepEqual(c.assets.run_worker_first,expectedWorkerFirstPaths);
assert.equal(c.assets.not_found_handling,'404-page');
assert.equal(c.assets.html_handling,'none');

const wrangler=fs.readFileSync('bible/wrangler.toml','utf8');
const routeLine=wrangler.split('\n').find(line=>line.trim().startsWith('run_worker_first ='));
assert.ok(routeLine,'Static Wrangler configuration must define Worker-first routes');
const configuredPaths=JSON.parse(routeLine.slice(routeLine.indexOf('[')));
assert.deepEqual(c.assets.run_worker_first,configuredPaths,
  'Programmatic deployment must preserve every security-critical Worker-first route');

for(const type of ['durable_object_namespace','unexpected']) {
  assert.throws(()=>preserveBindings({...input,settings:{bindings:[{name:'UNKNOWN',type}]}}),/Unsupported/);
}
assert.throws(()=>preserveBindings({...input,settings:{}}),/incomplete/);
assert.throws(()=>preserveBindings({...input,settings:{bindings:[{name:'BROKEN',type:'d1'}]}}),/incomplete/);
assert.throws(()=>preserveBindings({...input,schedules:{}}),/cron triggers/);

const sw=fs.readFileSync('heavenly-key-website/bible/sw.js','utf8');
assert(sw.includes('SHELL_PATHS.has(url.pathname)'));
const assets=JSON.parse(sw.match(/const SHELL_ASSETS = (\[.*?\]);/)[1]);
for(const item of assets) assert(fs.existsSync('heavenly-key-website/bible/'+item.slice(2)),item+' must exist');
for(const key of ['./daily-lessons.json','./original-language-guide.json','./ministry-logo.jpeg','./family-navigation.js']) {
  assert(assets.includes(key));
}

console.log('PASS deployment guards preserve exact IDs, secrets, variables and cron schedules; programmatic deployment mirrors all Worker-first security routes; unsupported bindings stop deployment; every offline shell asset exists.');
