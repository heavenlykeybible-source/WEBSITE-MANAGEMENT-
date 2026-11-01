// Outbound, signed bridge to the EXISTING Heavenly Key social-management queue.
// No provider credentials are stored in Daily Manna. Requires two matching
// server-side STUDIO_BRIDGE_SECRET / DAILY_MANNA_BRIDGE_SECRET secrets.
const encoder=new TextEncoder();
async function hmac(secret,message){
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(message)))).map(x=>x.toString(16).padStart(2,"0")).join("");
}
export function studioReady(env){
 try{
  const u=new URL(env.STUDIO_BRIDGE_ORIGIN);
  return u.protocol==='https:'&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash&&!!env.STUDIO_BRIDGE_SECRET&&/^\d{4}-\d{2}-\d{2}$/.test(env.STUDIO_FIRST_POST_DATE||'');
 }catch{return false}
}
export function formatDailyMannaPost(entry,origin){
 const u=new URL(origin);
 if(u.protocol!=='https:')throw Error('Daily Manna public origin must be HTTPS');
 const date=entry.publish_date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Invalid date');
 const link=new URL('/?date='+encodeURIComponent(date),u).toString();
 const fixed=['STRENGTH FOR TODAY - our daily manna',String(entry.title||''),String(entry.scripture||'')];
 const ending='Read the complete devotional: '+link;
 const charCount=v=>Array.from(v).length;
 const limit=1950;
 const allowance=Math.max(0,limit-charCount(fixed.join('\n\n'))-charCount(ending)-12);
 const raw=Array.from(String(entry.body||''));
 const excerpt=raw.slice(0,Math.max(0,allowance-(raw.length>allowance?1:0))).join('')+(raw.length>allowance?'…':'');
 const pieces=[...fixed,excerpt];
 const prayer='Prayer: '+String(entry.prayer||'');
 if(entry.prayer&&charCount(pieces.join('\n\n'))+charCount(prayer)+charCount(ending)+6<=limit)pieces.push(prayer);
 pieces.push(ending);
 return pieces.filter(Boolean).join('\n\n');
}
export async function submitToStudio(entry,env,fetcher=fetch){
 if(!studioReady(env))throw Error('Studio bridge is not configured');
 if(!env.MANNA_PUBLIC_ORIGIN)throw Error('Public Daily Manna origin missing');
 const url=new URL('/api/integrations/daily-manna/publish',env.STUDIO_BRIDGE_ORIGIN);
 const body=JSON.stringify({
  source:'daily-manna',publish_date:entry.publish_date,title:entry.title,scripture:entry.scripture,
  text:formatDailyMannaPost(entry,env.MANNA_PUBLIC_ORIGIN),
  requires_picture:Boolean(entry.picture_object_key),studio_media_id:Number(entry.studio_media_id)||null
 });
 const stamp=Date.now(),key=entry.delivery_id;
 if(!/^[0-9a-f-]{36}$/.test(key))throw Error('Invalid stable delivery key');
 const sig=await hmac(env.STUDIO_BRIDGE_SECRET,stamp+'.'+key+'.'+body);
 const res=await fetcher(url.toString(),{method:'POST',headers:{
  'content-type':'application/json','x-manna-timestamp':String(stamp),'x-manna-key':key,'x-manna-signature':sig
 },body,redirect:'error',signal:AbortSignal.timeout(15000)});
 let data;try{data=await res.json()}catch{throw Error('Studio response not JSON')}
 if(!res.ok||data.ok!==true||!Array.isArray(data.job_ids)||!data.job_ids.length||data.job_ids.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Studio rejected or failed to register delivery: HTTP '+res.status);
 return {job_ids:data.job_ids,duplicate:Boolean(data.duplicate)};
}

export async function readStudioStatus(deliveryId,env,fetcher=fetch){
 if(!studioReady(env))throw Error('Studio bridge is not configured');
 if(!/^[0-9a-f-]{36}$/.test(deliveryId))throw Error('Invalid Studio receipt ID');
 const body=JSON.stringify({source:'daily-manna',action:'status'});
 const stamp=Date.now(),signature=await hmac(env.STUDIO_BRIDGE_SECRET,stamp+'.'+deliveryId+'.'+body);
 const url=new URL('/api/integrations/daily-manna/publish',env.STUDIO_BRIDGE_ORIGIN);
 const res=await fetcher(url.toString(),{method:'POST',headers:{'content-type':'application/json','x-manna-timestamp':String(stamp),'x-manna-key':deliveryId,'x-manna-signature':signature},body,redirect:'error',signal:AbortSignal.timeout(12000)});
 let data;try{data=await res.json()}catch{throw Error('Studio status unavailable')}
 if(!res.ok||data.ok!==true||!Array.isArray(data.jobs))throw Error('Studio status query rejected: HTTP '+res.status);
 return {receipt_status:data.receipt_status,jobs:data.jobs.map(x=>({job_id:x.job_id,platform:x.platform,display_name:x.display_name,status:x.status,provider_post_id:x.provider_post_id,error:x.error}))};
}
