// Verify Account 8's actual Cloudflare D1 identity before publishing.
// Read-only API calls; never prints token values or modifies data.
import { pathToFileURL } from 'node:url';
export function assertMeetingDatabase(result, expectedId) {
  if(!result || String(result.uuid||result.id||'').toLowerCase()!==expectedId.toLowerCase() ||
     result.name!=='heavenly-key-meetingspace-db')
    throw Error('Cloudflare D1 identity mismatch: expected dedicated MeetingSpace database; release stopped');
}
export async function verifyAccount8(env=process.env, fetcher=fetch) {
  const account=env.MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID;
  const id=env.STUDIO_D1_DATABASE_ID;
  const token=env.CLOUDFLARE_API_TOKEN;
  if(!/^[0-9a-f]{32}$/i.test(account||'') ||
     !/^[0-9a-f-]{36}$/i.test(id||'') || !token)
    throw Error('Account 8 preflight needs its Cloudflare ID, D1 ID and API token');
  if(['9549fc74-f6a8-4cf8-a066-7cb965c59b91','c0fe5ca1-cb39-4fbb-bad0-e6b2fa8c825a'].includes(id.toLowerCase()))
    throw Error('Account 8 cannot reuse an existing shared production database');
  if(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_ACCOUNT_ID!==account)
    throw Error('Conflicting Cloudflare account identities');
  const url='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+id;
  const response=await fetcher(url,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Cannot verify Account 8 D1: Cloudflare HTTP '+response.status);
  const body=await response.json();
  if(body.success!==true)throw Error('Cloudflare refused Account 8 database identity verification');
  assertMeetingDatabase(body.result,id);
  return true;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  verifyAccount8().then(()=>console.log('Account 8 dedicated Cloudflare D1 identity verified')).catch(e=>{
    console.error(e.message);process.exitCode=1;
  });
}
