// Generate a safe, explicit deployment config. Never silently select another account.
import fs from 'node:fs';
const target=process.env.MEETINGSPACE_TARGET_ACCOUNT || '7';
if(!['7','8'].includes(target)) throw Error('MEETINGSPACE_TARGET_ACCOUNT must be 7 or 8');
const legacyId='6401a8f41a41f5325ba5bd4d006b4ff5';
const accountId=target==='7'?legacyId:process.env.MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID;
if(!/^[a-f0-9]{32}$/i.test(accountId||'')) throw Error('Account '+target+' requires a valid Cloudflare account ID; deployment stopped');
for(const key of ['CLOUDFLARE_ACCOUNT_ID','CF_ACCOUNT_ID']) {
 if(process.env[key] && process.env[key]!==accountId) throw Error('Deployment stopped: '+key+' conflicts with Account '+target);
}
const databaseId=process.env.STUDIO_D1_DATABASE_ID;
if(!/^[a-f0-9-]{36}$/i.test(databaseId||'')) throw Error('Set STUDIO_D1_DATABASE_ID to the intended dedicated database ID');
const worker=target==='8'?'heavenly-key-meetingspace':'heavenly-key-zoom-studio';
const config={account_id:accountId,name:worker,main:'site/_worker.js',compatibility_date:'2026-10-19',workers_dev:true,assets:{directory:'./site',binding:'ASSETS',run_worker_first:['/api/*','/p/*']},d1_databases:[{binding:'TEAMDB',database_name:target==='8'?'heavenly-key-meetingspace-db':'heavenly-key-zoom-studio-db',database_id:databaseId,migrations_dir:'migrations'}],ai:{binding:'AI'}};
fs.writeFileSync(new URL('../wrangler.generated.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('MeetingSpace configuration prepared for Account '+target+'; no deployment performed.');
