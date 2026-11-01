import {publicPage} from './public-page.mjs';
// Strength for Today Daily Manna: independent Worker. No credentials are embedded.
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
  if(existing?.status==='published'){const updated=await env.DB.prepare("UPDATE manna_entries SET title=?,scripture=?,body=?,prayer=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND revision=? AND status='published'").bind(title.trim(),scripture.trim(),body.trim(),prayer.trim(),key,data.expected_revision).run();if(updated.meta?.changes!==1)return response({error:'Concurrent update; refresh before saving'},409);}
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
 const missing=await env.DB.prepare("SELECT e.id FROM manna_entries e WHERE e.status='published' AND (SELECT COUNT(*) FROM manna_deliveries d WHERE d.entry_id=e.id AND d.destination IN ('community','buffer','email'))<3 LIMIT 100").bind().all();
 for(const entry of missing.results||[])for(const destination of ['community','buffer','email'])
  await env.DB.prepare("INSERT OR IGNORE INTO manna_deliveries(id,entry_id,destination,status) VALUES(?,?,?,'pending')").bind(randomId(),entry.id,destination).run();
}
async function publishToday(env,now=Date.now()){
 const date=todayLagos(now);
 await repairOutbox(env);
 const due=await env.DB.prepare("SELECT id,publish_date FROM manna_entries WHERE publish_date<=? AND ((status='approved' AND approved_revision=revision) OR (status='draft' AND ?=1)) ORDER BY publish_date LIMIT 100").bind(date,env.ALLOW_UNREVIEWED_PUBLICATION==='true'?1:0).all();
 let published=0;
 for(const entry of due.results||[]){
  const result=await env.DB.prepare("UPDATE manna_entries SET status='published',published_at=CURRENT_TIMESTAMP WHERE id=? AND ((status='approved' AND approved_revision=revision) OR (status='draft' AND ?=1))").bind(entry.id,env.ALLOW_UNREVIEWED_PUBLICATION==='true'?1:0).run();
  if(result.meta?.changes!==1)continue;
  published++;
  for(const destination of ['community','buffer','email'])await env.DB.prepare("INSERT OR IGNORE INTO manna_deliveries(id,entry_id,destination,status) VALUES(?,?,?,'pending')").bind(randomId(),entry.id,destination).run();
  await audit(env,'published',entry.id,entry.publish_date);
 }
 await repairOutbox(env);
 return {date,published,moreMayBeDue:(due.results||[]).length===100};
}

export default {
 async fetch(req,env){
  try{
   const url=new URL(req.url),path=url.pathname,method=req.method;
   if((path==='/'||path==='/index.html')&&method==='GET')return new Response(publicPage(),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
   if(path==='/api/today'&&method==='GET'){
    const date=todayLagos(),entry=await env.DB.prepare("SELECT publish_date,title,scripture,body,prayer FROM manna_entries WHERE publish_date=? AND status='published'").bind(date).first();
    return response({date,entry:entry||null});
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
   if(path==='/api/deliveries'&&method==='GET'&&auth(req,env)){
    const rows=await env.DB.prepare('SELECT d.entry_id,e.publish_date,d.destination,d.status,d.attempts,d.error FROM manna_deliveries d JOIN manna_entries e ON e.id=d.entry_id ORDER BY e.publish_date DESC LIMIT 200').all();
    return response({deliveries:rows.results});
   }
   const archive=path.match(/^\/api\/public\/([0-9]{4}-[0-9]{2}-[0-9]{2})$/);
   if(archive&&method==='GET'&&validDate(archive[1])&&archive[1]<=todayLagos()){
    const entry=await env.DB.prepare("SELECT publish_date,title,scripture,body,prayer FROM manna_entries WHERE publish_date=? AND status='published'").bind(archive[1]).first();
    return response({entry:entry||null});
   }
   return response({error:auth(req,env)?'Not found':'Unauthorized'},auth(req,env)?404:401);
  }catch(e){return response({error:'Internal error'},500);}
 },
 async scheduled(event,env){
  await publishToday(env,event.scheduledTime); // Hourly safety check: first run at Lagos midnight; later runs recover missed releases.
 }
};
