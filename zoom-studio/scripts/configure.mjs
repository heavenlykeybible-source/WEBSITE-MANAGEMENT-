// Generates deployment configuration without changing any existing repository bindings.
import fs from 'node:fs';
const accountId='6401a8f41a41f5325ba5bd4d006b4ff5'; // Account 7 Meeting App only.
for(const key of ['CLOUDFLARE_ACCOUNT_ID','CF_ACCOUNT_ID']) {
  if(process.env[key] && process.env[key]!==accountId) throw Error('Deployment stopped: this meeting app belongs to Account 7. Do not deploy it to Account 2 or Account 8.');
}
const databaseId=process.env.STUDIO_D1_DATABASE_ID;
if(!/^[a-f0-9-]{36}$/i.test(databaseId||''))throw Error('Set STUDIO_D1_DATABASE_ID to the dedicated Zoom Studio database ID. Do not reuse the Control Room database.');
const config={account_id:accountId,name:'heavenly-key-zoom-studio',main:'site/_worker.js',compatibility_date:'2026-10-19',workers_dev:true,assets:{directory:'./site',binding:'ASSETS',run_worker_first:['/api/*','/p/*']},d1_databases:[{binding:'TEAMDB',database_name:'heavenly-key-zoom-studio-db',database_id:databaseId,migrations_dir:'migrations'}],ai:{binding:'AI'}};
fs.writeFileSync(new URL('../wrangler.generated.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('Zoom Studio configuration ready. Existing Control Room bindings are unchanged.');
