import {publicPage} from './public-page.mjs';
import {studioReady,submitToStudio,readStudioStatus} from './studio-bridge.mjs';
// STRENGTH FOR TODAY - our daily manna: independent Worker. No credentials are embedded.
// Bind DB to a dedicated D1 database; set EDITOR_TOKEN as a secret.
// Scheduled trigger: 0 * * * * (hourly UTC, publishes only at 23:00 UTC = midnight Lagos).
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const randomId=()=>crypto.randomUUID();
const todayLagos=(now=Date.now())=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));const get=k=>p.find(x=>x.type===k).value;return get('year')+'-'+get('month')+'-'+get('day');};
async function parseBody(req){
 const declared=Number(req.headers.get('content-length')||0);
 if(Number.isFinite(declared)&&declared>50000)return null;
 const raw=await req.text();
 if(new TextEncoder().encode(raw).length>50000)return null;
 try{return JSON.parse(raw)}catch{return null}
}

const mediaDate=s=>s==='default'?'':validDate(s)?s:null;
const imageType=(bytes,type)=>type==='image/png'&&bytes.length>8&&[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)||type==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255||type==='image/webp'&&bytes.length>12&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
async function uploadPicture(req,env,date){
 if(!env.MANNA_IMAGES)return response({error:'Picture storage not configured'},503);
 const contentType=(req.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['image/png','image/jpeg','image/webp'].includes(contentType))return response({error:'Use PNG, JPEG or WebP'},415);
 if(Number(req.headers.get('content-length')||0)>2000000)return response({error:'Picture exceeds 2 MB'},413);
 const bytes=new Uint8Array(await req.arrayBuffer());
 if(!bytes.length||bytes.length>2000000||!imageType(bytes,contentType))return response({error:'Invalid image or size exceeds 2 MB'},400);
 const previous=await env.DB.prepare('SELECT object_key FROM manna_post_images WHERE image_date=?').bind(date).first();
 const key='post-banners/'+crypto.randomUUID();
 await env.MANNA_IMAGES.put(key,bytes,{httpMetadata:{contentType},customMetadata:{purpose:'daily-manna-picture'}});
 try{
  await env.DB.prepare('INSERT INTO manna_post_images(image_date,object_key,content_type) VALUES(?,?,?) ON CONFLICT(image_date) DO UPDATE SET object_key=excluded.object_key, content_type=excluded.content_type,studio_media_id=NULL,updated_at=CURRENT_TIMESTAMP').bind(date,key,contentType).run();
 }catch(e){await env.MANNA_IMAGES.delete(key);throw e}
 if(previous?.object_key)await env.MANNA_IMAGES.delete(previous.object_key).catch(()=>{});
 await audit(env,'image_uploaded',date||'default','Owner uploaded post picture');
 return response({ok:true,date:date||'default',picture_url:'/api/picture/'+(date||'default')});
}
async function picture(req,env,slug,ownerPreview=false){
 if(!env.MANNA_IMAGES)return new Response(null,{status:404});
 const date=mediaDate(slug);if(date===null)return new Response(null,{status:404});
 if(date&&date>todayLagos()&&!ownerPreview)return new Response(null,{status:404});
 let row=await env.DB.prepare('SELECT object_key,content_type FROM manna_post_images WHERE image_date=?').bind(date).first();
 if(!row&&date)row=await env.DB.prepare("SELECT object_key,content_type FROM manna_post_images WHERE image_date=''").first();
 if(!row)return new Response(null,{status:404});
 const object=await env.MANNA_IMAGES.get(row.object_key);if(!object)return new Response(null,{status:404});
 return new Response(object.body,{headers:{'content-type':row.content_type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'"}});
}

async function linkStudioPicture(req,env,date){
 const body=await parseBody(req);
 const id=body?.studio_media_id;
 if(!Number.isSafeInteger(id)||id<1)return response({error:'Choose an existing Studio media image ID'},400);
 const updated=await env.DB.prepare('UPDATE manna_post_images SET studio_media_id=?,updated_at=CURRENT_TIMESTAMP WHERE image_date=?').bind(id,date).run();
 if(updated.meta?.changes!==1)return response({error:'Upload the picture here before linking its Studio media ID'},404);
 await audit(env,'edited',date||'default','Studio media mapping updated (image ID '+id+')');
 return response({ok:true,studio_media_id:id});
}
async function removePicture(env,date){
 if(!env.MANNA_IMAGES)return response({error:'Picture storage not configured'},503);
 const prior=await env.DB.prepare('SELECT object_key FROM manna_post_images WHERE image_date=?').bind(date).first();
 if(!prior)return response({error:'No picture assigned for that date'},404);
 const deleted=await env.DB.prepare('DELETE FROM manna_post_images WHERE image_date=? AND object_key=?').bind(date,prior.object_key).run();
 if(deleted.meta?.changes!==1)return response({error:'Picture changed; refresh and retry'},409);
 await env.MANNA_IMAGES.delete(prior.object_key).catch(()=>{});
 await audit(env,'image_removed',date||'default','Owner removed post picture');
 return response({ok:true,removed:date||'default'});
}
async function audit(env,action,entry,detail){await env.DB.prepare('INSERT INTO manna_audit(id,action,entry_id,detail) VALUES(?,?,?,?)').bind(randomId(),action,entry,detail).run();}
function auth(req,env){const a=req.headers.get('authorization')||'';return !!env.EDITOR_TOKEN&&a==='Bearer '+env.EDITOR_TOKEN;}
async function edit(req,env,id){
 const data=await parseBody(req);if(!data||typeof data!=='object'||Array.isArray(data))return response({error:'Invalid payload'},400);
 const date=data.publish_date,title=data.title,scripture=data.scripture,body=data.body,prayer=data.prayer??'';
 if(![title,scripture,body,prayer].every(x=>typeof x==='string'))return response({error:'All text fields must be strings'},400);
 if(!validDate(date)||(date<todayLagos()&&!id)||!title.trim()||!scripture.trim()||!body.trim()||title.length>250||scripture.length>500||body.length>40000||prayer.length>5000)return response({error:'Invalid devotional fields'},400);
 const existing=id?await env.DB.prepare('SELECT * FROM manna_entries WHERE id=?').bind(id).first():null;
 if(id&&!existing)return response({error:'Not found'},404);
 if(existing?.status==='published'&&date!==existing.publish_date)return response({error:'Published date cannot be changed'},409);
 if(existing&&(!Number.isSafeInteger(data.expected_revision)||data.expected_revision!==existing.revision))return response({error:'Entry changed; refresh before editing'},409);
 const key=existing?.id||randomId();
 try{
  if(existing?.status==='published'){
   // D1 batch is transactional: keep the previous published version with its revision.
   const results=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO manna_entry_revisions(entry_id,revision,publish_date,title,scripture,body,prayer) SELECT id,revision,publish_date,title,scripture,body,prayer FROM manna_entries WHERE id=? AND revision=? AND status='published'").bind(key,data.expected_revision),
    env.DB.prepare("UPDATE manna_entries SET title=?,scripture=?,body=?,prayer=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status='published'").bind(title.trim(),scripture.trim(),body.trim(),prayer.trim(),key,data.expected_revision)
   ]);
   if(results[1]?.meta?.changes!==1)return response({error:'Concurrent update; refresh before saving'},409);
  }
  else if(existing){const updated=await env.DB.prepare("UPDATE manna_entries SET publish_date=?,title=?,scripture=?,body=?,prayer=?,status='draft',approved_revision=NULL,approved_at=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status!='published'").bind(date,title.trim(),scripture.trim(),body.trim(),prayer.trim(),key,data.expected_revision).run();if(updated.meta?.changes!==1)return response({error:'Concurrent update; refresh before saving'},409);}
  else await env.DB.prepare('INSERT INTO manna_entries(id,publish_date,title,scripture,body,prayer) VALUES(?,?,?,?,?,?)').bind(key,date,title.trim(),scripture.trim(),body.trim(),prayer.trim()).run();
 }catch(e){if(/UNIQUE/i.test(e.message))return response({error:'Date already has a devotional'},409);throw e;}
 await audit(env,existing?.status==='published'?'corrected':existing?'edited':'created',key,date);return response({ok:true,id:key,status:existing?.status==='published'?'published':'draft',revision:(existing?.revision||0)+1});
}
async function approve(req,env){
 const payload=await parseBody(req);const entries=payload?.entries;
 if(!Array.isArray(entries)||entries.length===0||entries.length>100||entries.some(x=>!x||typeof x.id!=='string'||!Number.isSafeInteger(x.revision)))return response({error:'Select 1-100 entries with their reviewed revisions'},400);
 if(new Set(entries.map(x=>x.id)).size!==entries.length)return response({error:'Duplicate entries'},400);
 const results=[];
 for(const item of entries){
  const id=item.id,entry=await env.DB.prepare('SELECT id,status,revision,publish_date FROM manna_entries WHERE id=?').bind(id).first();
  if(!entry||entry.status==='published'||entry.revision!==item.revision||entry.publish_date<todayLagos()){results.push({id,approved:false,reason:'Missing, past, published or changed'});continue;}
  const update=await env.DB.prepare("UPDATE manna_entries SET status='approved',approved_revision=revision,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status!='published'").bind(id,item.revision).run();
  const approved=update.meta?.changes===1;
  if(approved)await audit(env,'approved',id,entry.publish_date+' revision '+item.revision);
  results.push({id,approved});
 }
 return response({results});
}
async function repairOutbox(env){
 const missing=await env.DB.prepare("SELECT e.id FROM manna_entries e WHERE e.status='published' AND (SELECT COUNT(*) FROM manna_deliveries d WHERE d.entry_id=e.id AND d.destination IN ('community','studio'))<2 LIMIT 100").bind().all();
 for(const entry of missing.results||[])for(const destination of ['community','studio'])
  await env.DB.prepare("INSERT OR IGNORE INTO manna_deliveries(id,entry_id,destination,status) VALUES(?,?,?,'pending')").bind(randomId(),entry.id,destination).run();
}
async function publishToday(env,now=Date.now()){
 const date=todayLagos(now);
 await repairOutbox(env);
 const due=await env.DB.prepare("SELECT id,publish_date FROM manna_entries WHERE publish_date<=? AND ((status='approved' AND approved_revision=revision) OR (status='draft' AND ?=1)) ORDER BY publish_date LIMIT 100").bind(date,env.ALLOW_UNREVIEWED_PUBLICATION==='true'?1:0).all();
 let published=0;
 for(const entry of due.results||[]){
  const result=await env.DB.prepare("UPDATE manna_entries SET status='published',release_mode=CASE WHEN status='approved' THEN 'reviewed' ELSE 'unreviewed' END,published_at=CURRENT_TIMESTAMP WHERE id=? AND ((status='approved' AND approved_revision=revision) OR (status='draft' AND ?=1))").bind(entry.id,env.ALLOW_UNREVIEWED_PUBLICATION==='true'?1:0).run();
  if(result.meta?.changes!==1)continue;
  published++;
  for(const destination of ['community','studio'])await env.DB.prepare("INSERT OR IGNORE INTO manna_deliveries(id,entry_id,destination,status) VALUES(?,?,?,'pending')").bind(randomId(),entry.id,destination).run();
  await audit(env,'published',entry.id,entry.publish_date+' release recorded');
 }
 await repairOutbox(env);
 return {date,published,moreMayBeDue:(due.results||[]).length===100};
}

// The Studio is the only external social publisher. We never store Facebook
// credentials here, and uncertain submissions are not blindly resent.
export async function dispatchStudio(env,fetcher=fetch){
 if(!studioReady(env))return {configured:false,processed:0};
 const jobs=await env.DB.prepare("SELECT d.id AS delivery_id,e.publish_date,e.title,e.scripture,e.body,e.prayer,(SELECT object_key FROM manna_post_images WHERE image_date=e.publish_date OR image_date='' ORDER BY LENGTH(image_date) DESC LIMIT 1) AS picture_object_key,(SELECT studio_media_id FROM manna_post_images WHERE image_date=e.publish_date OR image_date='' ORDER BY LENGTH(image_date) DESC LIMIT 1) AS studio_media_id FROM manna_deliveries d JOIN manna_entries e ON e.id=d.entry_id WHERE d.destination='studio' AND d.status='pending' AND e.status='published' AND e.publish_date>=? AND e.publish_date<=? ORDER BY e.publish_date LIMIT 10").bind(env.STUDIO_FIRST_POST_DATE,todayLagos()).all();
 let processed=0,sent=0,failed=0;
 for(const entry of jobs.results||[]){
  const claimed=await env.DB.prepare("UPDATE manna_deliveries SET status='skipped',attempts=attempts+1,error='Studio submission in progress; reconcile before retry',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND destination='studio'").bind(entry.delivery_id).run();
  if(claimed.meta?.changes!==1)continue;
  processed++;
  try{
   const result=await submitToStudio(entry,env,fetcher);
   await env.DB.prepare("UPDATE manna_deliveries SET status='sent',provider_post_id=?,error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='skipped'").bind(JSON.stringify(result.job_ids).slice(0,500),entry.delivery_id).run();
   sent++;
  }catch{
   await env.DB.prepare("UPDATE manna_deliveries SET status='failed',error='Studio handoff unsuccessful; reconcile before retry',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='skipped'").bind(entry.delivery_id).run();
   failed++;
  }
 }
 return {configured:true,processed,sent,failed};
}

export default {
 async fetch(req,env){
  try{
   const url=new URL(req.url),path=url.pathname,method=req.method;
   if(method==='POST'&&path.startsWith('/api/picture-link/')&&auth(req,env)){const date=mediaDate(path.slice('/api/picture-link/'.length));if(date===null)return response({error:'Invalid picture date'},400);return linkStudioPicture(req,env,date)}
   if(method==='GET'&&path.startsWith('/api/picture-manage/')&&auth(req,env))return picture(req,env,path.slice('/api/picture-manage/'.length),true);
   if(method==='DELETE'&&path.startsWith('/api/picture/')&&auth(req,env)){const date=mediaDate(path.slice('/api/picture/'.length));if(date===null)return response({error:'Invalid picture date'},400);return removePicture(env,date)}
   if(method==='PUT'&&path.startsWith('/api/picture/')&&auth(req,env)){const date=mediaDate(path.slice('/api/picture/'.length));if(date===null)return response({error:'Invalid picture date'},400);return uploadPicture(req,env,date)}
   if(method==='GET'&&path.startsWith('/api/picture/'))return picture(req,env,path.slice('/api/picture/'.length));
   if((path==='/'||path==='/index.html')&&method==='GET')return new Response(publicPage(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
   if(path==='/api/archive'&&method==='GET'){
    const before=url.searchParams.get('before');
    if(before&&!validDate(before))return response({error:'Invalid archive date'},400);
    const cutoff=before&&before<todayLagos()?before:todayLagos();
    const comparator=before?'<':'<=';
    const result=await env.DB.prepare("SELECT publish_date,title,scripture FROM manna_entries WHERE status='published' AND publish_date"+comparator+"? ORDER BY publish_date DESC LIMIT 25").bind(cutoff).all();
    return response({entries:result.results||[],next_before:(result.results||[]).length===25?(result.results||[])[24].publish_date:null});
   }
   if(path==='/api/today'&&method==='GET'){
    const date=todayLagos(),entry=await env.DB.prepare("SELECT publish_date,title,scripture,body,prayer FROM manna_entries WHERE publish_date=? AND status='published'").bind(date).first();
    return response({date,entry:entry||null,picture_url:entry?'/api/picture/'+date:null});
   }
   if(path==='/api/picture-config'&&method==='GET'&&auth(req,env)){
    const date=mediaDate(url.searchParams.get('scope')||'');
    if(date===null)return response({error:'Invalid picture scope'},400);
    const record=await env.DB.prepare("SELECT studio_media_id,content_type,updated_at FROM manna_post_images WHERE image_date=?").bind(date).first();
    return response({scope:date||'default',image_uploaded:Boolean(record),studio_media_id:record?.studio_media_id||null,content_type:record?.content_type||null,updated_at:record?.updated_at||null});
   }
   if(path==='/api/readiness'&&method==='GET'&&auth(req,env)){
    const tally=await env.DB.prepare("SELECT status,COUNT(*) AS count FROM manna_entries GROUP BY status").all();
    const counts={draft:0,approved:0,published:0,corrected:0};
    for(const row of tally.results||[])if(Object.hasOwn(counts,row.status))counts[row.status]=row.count;
    return response({database:'connected',picture_storage:env.MANNA_IMAGES?'connected':'not_configured',unreviewed_publication:env.ALLOW_UNREVIEWED_PUBLICATION==='true',entries:counts,subscriptions:'deferred',studio_delivery:studioReady(env)?'configured':'not_configured',social_network_delivery:'not_configured'});
   }
   if(path==='/api/entries'&&method==='GET'&&auth(req,env)){
    const month=url.searchParams.get('month');
    if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return response({error:'Invalid month'},400);
    const rows=month?await env.DB.prepare('SELECT * FROM manna_entries WHERE substr(publish_date,1,7)=? ORDER BY publish_date LIMIT 100').bind(month).all():await env.DB.prepare('SELECT * FROM manna_entries ORDER BY publish_date DESC LIMIT 180').all();
    return response({entries:rows.results});
   }
   if(path==='/api/entries'&&method==='POST'&&auth(req,env))return edit(req,env,null);
   const match=path.match(/^\/api\/entries\/([a-f0-9-]{36})$/);
   if(match&&method==='PUT'&&auth(req,env))return edit(req,env,match[1]);
   if(path==='/api/approve'&&method==='POST'&&auth(req,env))return approve(req,env);
   if(path==='/api/publish-check'&&method==='POST'&&auth(req,env))return response(await publishToday(env));
   if(path==='/api/studio-status'&&method==='GET'&&auth(req,env)){
    const id=url.searchParams.get('delivery_id')||'';
    if(!/^[a-f0-9-]{36}$/.test(id))return response({error:'Invalid delivery ID'},400);
    const record=await env.DB.prepare("SELECT id FROM manna_deliveries WHERE id=? AND destination='studio'").bind(id).first();
    if(!record)return response({error:'Studio delivery not found'},404);
    try{return response(await readStudioStatus(id,env))}catch{return response({error:'Studio delivery status unavailable'},502)}
   }
   if(path==='/api/deliveries'&&method==='GET'&&auth(req,env)){
    const rows=await env.DB.prepare('SELECT d.id AS delivery_id,d.entry_id,e.publish_date,d.destination,d.status,d.attempts,d.error,d.provider_post_id FROM manna_deliveries d JOIN manna_entries e ON e.id=d.entry_id ORDER BY e.publish_date DESC LIMIT 200').all();
    return response({deliveries:rows.results});
   }
   const archive=path.match(/^\/api\/public\/([0-9]{4}-[0-9]{2}-[0-9]{2})$/);
   if(archive&&method==='GET'&&validDate(archive[1])&&archive[1]<=todayLagos()){
    const entry=await env.DB.prepare("SELECT publish_date,title,scripture,body,prayer FROM manna_entries WHERE publish_date=? AND status='published'").bind(archive[1]).first();
    return response({entry:entry||null,picture_url:entry?'/api/picture/'+archive[1]:null});
   }
   return response({error:auth(req,env)?'Not found':'Unauthorized'},auth(req,env)?404:401);
  }catch(e){return response({error:'Internal error'},500);}
 },
 async scheduled(event,env){
  await publishToday(env,event.scheduledTime); // Hourly recovery and scheduled release.
  await dispatchStudio(env); // Existing Studio queue is the only external social publisher.
 }
};
