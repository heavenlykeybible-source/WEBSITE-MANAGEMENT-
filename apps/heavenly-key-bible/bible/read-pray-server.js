/* Optional Cloudflare D1 + bound push dispatcher. No personal identity or account required.
 The bound dispatcher must implement sending standards-compliant encrypted Web Push.
 This module does not itself encrypt or deliver Web Push, so do not call it a full deployment.
 */
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const endpointAllowed=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<2048&&[ 'fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','push.services.mozilla.com' ].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}};
const zoneAllowed=value=>typeof value==='string'&&value.length<80&&(()=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}})();
const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
async function idFor(endpoint){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function parseJSON(request){if(Number(request.headers.get('content-length'))>8192)return null;try{const t=await request.text();if(t.length>8192)return null;return JSON.parse(t);}catch{return null;}}
export async function handleReadPray(request,env,url){
 if(!url.pathname.startsWith('/api/read-pray/'))return null;
 if(!env.READ_PRAY_DB)return json({error:'Background reminders are not configured'},503);
 if(url.pathname==='/api/read-pray/config'&&request.method==='GET')return json({enabled:!!(env.READ_PRAY_VAPID_PUBLIC&&env.PUSH_DISPATCHER),publicKey:env.READ_PRAY_VAPID_PUBLIC||null});
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 // Browser subscription writes must originate from this Bible site. The API is not a cross-site form endpoint.
 const origin=request.headers.get('origin');
 if(origin!==url.origin)return json({error:'Same-origin request required'},403);
 const contentType=(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(contentType!=='application/json')return json({error:'JSON content type required'},415);

 const payload=await parseJSON(request);if(!payload)return json({error:'Invalid request'},400);
 if(url.pathname==='/api/read-pray/subscribe'){
  if(!env.READ_PRAY_VAPID_PUBLIC||!env.PUSH_DISPATCHER)return json({error:'Push delivery is not configured'},503);
  const sub=payload.subscription||{},endpoint=sub.endpoint,keys=sub.keys||{};
  if(!endpointAllowed(endpoint)||!/^[-_A-Za-z0-9]{40,200}$/.test(keys.p256dh||'')||!/^[-_A-Za-z0-9]{10,100}$/.test(keys.auth||'')||!validTime(payload.time)||!zoneAllowed(payload.zone))return json({error:'Invalid subscription, time or timezone'},400);
  const id=await idFor(endpoint),now=new Date().toISOString();
  // A push endpoint identifies one subscription. Only its existing auth key may
  // update reminder timing; another caller must not silently replace its keys.
  const saved=await env.READ_PRAY_DB.prepare('INSERT INTO read_pray_push(id,endpoint,p256dh,auth,local_time,timezone,last_sent_day,updated_at) VALUES(?,?,?,?,?,?,NULL,?) ON CONFLICT(id) DO UPDATE SET local_time=excluded.local_time,timezone=excluded.timezone,updated_at=excluded.updated_at WHERE read_pray_push.auth=excluded.auth AND read_pray_push.p256dh=excluded.p256dh').bind(id,endpoint,keys.p256dh,keys.auth,payload.time,payload.zone,now).run();
  if(!saved.meta?.changes)return json({error:'Subscription already belongs to another key or could not be updated'},409);
  return json({subscribed:true});
 }
 if(url.pathname==='/api/read-pray/unsubscribe'){
  if(!endpointAllowed(payload.endpoint)||typeof payload.auth!=='string'||!/^[-_A-Za-z0-9]{10,100}$/.test(payload.auth))return json({error:'Invalid subscription credentials'},400);
  const removed=await env.READ_PRAY_DB.prepare('DELETE FROM read_pray_push WHERE id=? AND auth=?').bind(await idFor(payload.endpoint),payload.auth).run();
  if(!removed.meta?.changes)return json({error:'Subscription could not be verified'},403);
  return json({unsubscribed:true});
 }
 return json({error:'Not found'},404);
}
export function localDateTime(date,zone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {day:`${m.year}-${m.month}-${m.day}`,time:`${m.hour}:${m.minute}`};}
export async function dispatchReadPray(env,now=new Date()){
 if(!env.READ_PRAY_DB||!env.PUSH_DISPATCHER)return {skipped:true,reason:'unconfigured'};
 // Query is bounded; scheduled invocation should be every 5 minutes and batch through all rows.
 let last='',attempted=0,delivered=0,failed=0,claimed=0;
 while(true){const page=await env.READ_PRAY_DB.prepare('SELECT id,endpoint,p256dh,auth,local_time,timezone,last_sent_day FROM read_pray_push WHERE id>? ORDER BY id LIMIT 100').bind(last).all();const rows=page.results||[];if(!rows.length)break;
  for(const sub of rows){last=sub.id;let stamp;try{stamp=localDateTime(now,sub.timezone);}catch{continue;}
   if(stamp.day===sub.last_sent_day||stamp.time<sub.local_time)continue;
   // Claim each due reminder for a limited window to prevent overlapping cron runs
   // from dispatching duplicates. Failed sends release the claim for retry.
   const leaseUntil=new Date(now.getTime()+3*60*1000).toISOString();
   const result=await env.READ_PRAY_DB.prepare('UPDATE read_pray_push SET claim_until=? WHERE id=? AND (last_sent_day IS NULL OR last_sent_day<>?) AND (claim_until IS NULL OR claim_until<?)').bind(leaseUntil,sub.id,stamp.day,now.toISOString()).run();
   if(!result.meta?.changes)continue;
   claimed++;attempted++;
   try{const res=await env.PUSH_DISPATCHER.fetch('https://push-dispatcher.internal/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth},data:{type:'hk-read-pray-daily'}})});
    if(res.status===404||res.status===410){await env.READ_PRAY_DB.prepare('DELETE FROM read_pray_push WHERE id=? AND auth=?').bind(sub.id,sub.auth).run();continue;}
    if(!res.ok){failed++;await releaseClaim(env,sub.id,leaseUntil);continue;}
    await env.READ_PRAY_DB.prepare('UPDATE read_pray_push SET last_sent_day=?,claim_until=NULL WHERE id=? AND auth=? AND claim_until=? AND (last_sent_day IS NULL OR last_sent_day<>?)').bind(stamp.day,sub.id,sub.auth,leaseUntil,stamp.day).run();delivered++;
   }catch{failed++;await releaseClaim(env,sub.id,leaseUntil);}
  }
  if(rows.length<100)break;
 }
 return {attempted,claimed,delivered,failed};
}

async function releaseClaim(env,id,leaseUntil){try{await env.READ_PRAY_DB.prepare('UPDATE read_pray_push SET claim_until=NULL WHERE id=? AND claim_until=?').bind(id,leaseUntil).run();}catch{/* lease expires without further action */}}
