// Strength for Today Daily Manna: independent Worker. No credentials are embedded.
// Bind DB to a dedicated D1 database; set EDITOR_TOKEN as a secret.
// Scheduled trigger: 0 * * * * (hourly UTC, publishes only at 23:00 UTC = midnight Lagos).
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const response=(v,status=200)=>new Response(JSON.stringify(v),{status,headers});
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const randomId=()=>crypto.randomUUID();
const todayLagos=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function auth(req,env){const a=req.headers.get('authorization')||'';return !!env.EDITOR_TOKEN&&a==='Bearer '+env.EDITOR_TOKEN;}
async function edit(req,env,id){
 const data=await req.json(),date=String(data.publish_date||''),title=String(data.title||'').trim(),scripture=String(data.scripture||'').trim(),body=String(data.body||'').trim(),prayer=String(data.prayer||'').trim();
 if(!validDate(date)||!title||!scripture||!body||title.length>250||scripture.length>500||body.length>40000||prayer.length>5000)return response({error:'Invalid devotional fields'},400);
 const existing=id?await env.DB.prepare('SELECT * FROM manna_entries WHERE id=?').bind(id).first():null;
 if(id&&!existing)return response({error:'Not found'},404);
 if(existing?.status==='published')return response({error:'Published entries are immutable; create a correction workflow'},409);
 const key=existing?.id||randomId();
 try{
  if(existing)await env.DB.prepare("UPDATE manna_entries SET publish_date=?,title=?,scripture=?,body=?,prayer=?,status='draft',approved_revision=NULL,approved_at=NULL,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(date,title,scripture,body,prayer,key).run();
  else await env.DB.prepare('INSERT INTO manna_entries(id,publish_date,title,scripture,body,prayer) VALUES(?,?,?,?,?,?)').bind(key,date,title,scripture,body,prayer).run();
 }catch(e){if(/UNIQUE/i.test(e.message))return response({error:'Date already has a devotional'},409);throw e;}
 return response({ok:true,id:key,status:'draft'});
}
async function approve(req,env){
 const {ids}=await req.json();
 if(!Array.isArray(ids)||ids.length===0||ids.length>100||ids.some(x=>typeof x!=='string'))return response({error:'Select 1-100 entries'},400);
 const results=[];
 for(const id of [...new Set(ids)]){
  const entry=await env.DB.prepare('SELECT id,status FROM manna_entries WHERE id=?').bind(id).first();
  if(!entry||entry.status==='published'){results.push({id,approved:false});continue;}
  await env.DB.prepare("UPDATE manna_entries SET status='approved',approved_revision=revision,approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status!='published'").bind(id).run();
  results.push({id,approved:true});
 }
 return response({results});
}
async function publishToday(env){
 const date=todayLagos();
 // Atomic conditional update prevents two cron runs publishing the same entry twice.
 const result=await env.DB.prepare("UPDATE manna_entries SET status='published',published_at=CURRENT_TIMESTAMP WHERE publish_date=? AND status='approved' AND approved_revision=revision RETURNING id,title").bind(date).all();
 const entries=result.results||[];
 for(const entry of entries){
  for(const destination of ['website','community','buffer','email']){
   const status=destination==='website'?'sent':'pending';
   await env.DB.prepare('INSERT OR IGNORE INTO manna_deliveries(id,entry_id,destination,status) VALUES(?,?,?,?)').bind(randomId(),entry.id,destination,status).run();
  }
 }
 return {date,published:entries.length,entries:entries.map(x=>x.id)};
}
export default {
 async fetch(req,env){
  try{
   const url=new URL(req.url),path=url.pathname,method=req.method;
   if(path==='/api/today'&&method==='GET'){
    const date=todayLagos(),entry=await env.DB.prepare("SELECT publish_date,title,scripture,body,prayer FROM manna_entries WHERE publish_date=? AND status='published'").bind(date).first();
    return response({date,entry:entry||null});
   }
   if(path==='/api/entries'&&method==='GET'&&auth(req,env)){
    const rows=await env.DB.prepare('SELECT * FROM manna_entries ORDER BY publish_date LIMIT 180').all();return response({entries:rows.results});
   }
   if(path==='/api/entries'&&method==='POST'&&auth(req,env))return edit(req,env,null);
   const match=path.match(/^\/api\/entries\/([a-f0-9-]{36})$/);
   if(match&&method==='PUT'&&auth(req,env))return edit(req,env,match[1]);
   if(path==='/api/approve'&&method==='POST'&&auth(req,env))return approve(req,env);
   if(path==='/api/publish-check'&&method==='POST'&&auth(req,env))return response(await publishToday(env));
   return response({error:auth(req,env)?'Not found':'Not found or unauthorized'},404);
  }catch(e){return response({error:'Internal error'},500);}
 },
 async scheduled(event,env){
  const lagosHour=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Lagos',hour:'2-digit',hourCycle:'h23'}).format(new Date(event.scheduledTime));
  if(lagosHour==='00')await publishToday(env);
 }
};
