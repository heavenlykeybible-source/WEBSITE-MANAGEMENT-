interface Env { DB: D1Database; ADMIN_TOKEN: string; GEMINI_API_KEY?: string }
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const allowed=new Set(['whatsapp_business','facebook_messenger','online_assistant']);
const idOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(s);
const app={async fetch(req:Request,env:Env):Promise<Response>{
 const u=new URL(req.url);
 if(u.pathname==='/health')return reply({service:'Heavenly Key Social Management',account:10,status:'setup_required',providerConnected:false});
 if(!env.ADMIN_TOKEN)return reply({error:'ADMIN_TOKEN is not configured'},503);
 const provided=req.headers.get('authorization')||'';
 if(provided!==`Bearer ${env.ADMIN_TOKEN}`)return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'D1 database binding missing'},503);
 if(u.pathname==='/api/conversations'&&req.method==='GET'){
  const result=await env.DB.prepare('SELECT id,channel,human_paused,requested_human,updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100').all();return reply({items:result.results});
 }
 if(u.pathname==='/api/conversation'&&req.method==='GET'){
  const id=u.searchParams.get('id');if(!idOk(id))return reply({error:'Invalid conversation id'},400);
  const conversation=await env.DB.prepare('SELECT * FROM conversations WHERE id=?').bind(id).first();if(!conversation)return reply({error:'Not found'},404);
  const messages=await env.DB.prepare('SELECT id,direction,body,created_at FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 100').bind(id).all();return reply({conversation,messages:messages.results});
 }
 if(u.pathname==='/api/welcome-menu'&&req.method==='GET')return reply({disclosure:'This is an automated AI assistant. A real person will respond as soon as possible.',options:[{id:'human',label:'I want to speak to Evangelist Emmanuel Ogheneochuko Adiohwo'},{id:'prayer',label:'Prayer request'},{id:'bible',label:'Bible questions'},{id:'radio',url:'https://radio.heavenlykey.org/'},{id:'community',url:'https://global.heavenlykey.org/'}],providerConnected:false});
 if(u.pathname==='/api/automation/rules'&&req.method==='GET'){const r=await env.DB.prepare('SELECT id,keyword,reply FROM automation_rules LIMIT 100').all();return reply({items:r.results,providerConnected:false})}
 if(u.pathname==='/api/automation/rules'&&req.method==='POST'){let b:any;try{b=await req.json()}catch{return reply({error:'Invalid JSON'},400)}if(typeof b?.keyword!=='string'||!b.keyword.trim()||b.keyword.length>80||typeof b?.reply!=='string'||!b.reply.trim()||b.reply.length>4096)return reply({error:'Invalid rule'},400);const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO automation_rules(id,keyword,reply) VALUES(?,?,?)').bind(id,b.keyword.trim().toLowerCase(),b.reply.trim()).run();return reply({id,saved:true,enabled:false},201)}
 if(u.pathname==='/api/posts'&&req.method==='GET'){
  const result=await env.DB.prepare('SELECT id,body,platform,status,scheduled_at,created_at FROM social_posts ORDER BY created_at DESC LIMIT 100').all();
  return reply({items:result.results,publishingConnected:false});
 }
 if(u.pathname==='/api/posts'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  const platforms=['facebook_page','instagram_professional','youtube','tiktok'];
  if(typeof data?.body!=='string'||!data.body.trim()||data.body.length>5000||!platforms.includes(data.platform))return reply({error:'Provide post text and a supported destination'},400);
  if(data.scheduledAt!==undefined&&(typeof data.scheduledAt!=='string'||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/.test(data.scheduledAt)||!Number.isFinite(Date.parse(data.scheduledAt))))return reply({error:'Invalid scheduledAt timestamp'},400);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO social_posts(id,body,platform,status,scheduled_at) VALUES(?,?,?,?,?)').bind(id,data.body.trim(),data.platform,'draft',data.scheduledAt||null).run();
  return reply({id,status:'draft',published:false,note:'Saved for review. Publishing is disabled until verified platform authorization and delivery adapters are installed.'},201);
 }
 if(u.pathname==='/api/takeover'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.paused!=='boolean')return reply({error:'Invalid takeover request'},400);
  const result=await env.DB.prepare('UPDATE conversations SET human_paused=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.paused?1:0,data.conversationId).run();
  return reply({saved:!!result.meta.changes,automationPaused:data.paused,providerEnforced:false});
 }
 return reply({error:'Not found'},404);
}};export default app;
