// Generates deployment configuration without changing any existing repository bindings.
import fs from 'node:fs';
const databaseId=process.env.STUDIO_D1_DATABASE_ID;
if(!/^[a-f0-9-]{36}$/i.test(databaseId||''))throw Error('Set STUDIO_D1_DATABASE_ID to the dedicated Zoom Studio database ID. Do not reuse the Control Room database.');
const config={name:'heavenly-key-zoom-studio',main:'site/_worker.js',compatibility_date:'2026-10-19',workers_dev:true,assets:{directory:'./site',binding:'ASSETS',run_worker_first:['/api/*','/p/*']},d1_databases:[{binding:'TEAMDB',database_name:'heavenly-key-zoom-studio-db',database_id:databaseId,migrations_dir:'migrations'}],ai:{binding:'AI'}};
fs.writeFileSync(new URL('../wrangler.generated.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('Zoom Studio configuration ready. Existing Control Room bindings are unchanged.');
