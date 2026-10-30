// Generate a safe, explicit deployment config. Never silently select another account.
import fs from 'node:fs';
const target=process.env.MEETINGSPACE_TARGET_ACCOUNT || '8';
if(target!=='8') throw Error('This is Account 8 MeetingSpace; Account 7 is Heavenly Key Radio and must not be targeted');
const legacyId='6401a8f41a41f5325ba5bd4d006b4ff5';
const accountId=process.env.MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID;
if(!/^[a-f0-9]{32}$/i.test(accountId||'')) throw Error('Account '+target+' requires a valid Cloudflare account ID; deployment stopped');
if(accountId.toLowerCase()===legacyId && process.env.MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT!=='1') throw Error('Shared Cloudflare account detected: explicitly confirm isolated Account 8 Worker and D1 with MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT=1');
for(const key of ['CLOUDFLARE_ACCOUNT_ID','CF_ACCOUNT_ID']) {
 if(process.env[key] && process.env[key].toLowerCase()!==accountId.toLowerCase()) throw Error('Deployment stopped: '+key+' conflicts with Account '+target);
}
const databaseId=process.env.STUDIO_D1_DATABASE_ID;
if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(databaseId||'')) throw Error('Set STUDIO_D1_DATABASE_ID to the intended dedicated database ID');
if(target==='8' && process.env.MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED!=='1') throw Error('Confirm the Account 8 D1 database explicitly with MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED=1');
const knownSharedDbIds=new Set(['9549fc74-f6a8-4cf8-a066-7cb965c59b91','c0fe5ca1-cb39-4fbb-bad0-e6b2fa8c825a']);
if(knownSharedDbIds.has(databaseId.toLowerCase())) throw Error('MeetingSpace requires a dedicated D1 database; refusing legacy shared Studio and Control Room databases');
const worker='heavenly-key-meetingspace';
const config={account_id:accountId,name:worker,main:'build/meeting-worker.mjs',compatibility_date:'2026-10-19',workers_dev:true,durable_objects:{bindings:[{name:'MEETING_ROOMS',class_name:'MeetingRooms'}]},migrations:[{tag:'account8-meetingrooms-v1',new_sqlite_classes:['MeetingRooms']}],d1_databases:[{binding:'TEAMDB',database_name:'heavenly-key-meetingspace-db',database_id:databaseId,migrations_dir:'migrations'}],ai:{binding:'AI'}};
fs.writeFileSync(new URL('../wrangler.generated.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
console.log('MeetingSpace configuration prepared for Account '+target+'; no deployment performed.');
