interface Env { DB: D1Database; ADMIN_TOKEN: string; GEMINI_API_KEY?: string; ASSETS?: Fetcher }
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const allowed=new Set(['whatsapp_business','facebook_messenger','online_assistant']);
const idOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(s);
const app={async fetch(req:Request,env:Env):Promise<Response>{
 const u=new URL(req.url);
 if(u.pathname==='/health')return reply({service:'Heavenly Key Social Management',account:10,status:'setup_required',providerConnected:false});
 if(!u.pathname.startsWith('/api/')){if((req.method==='GET'||req.method==='HEAD')&&env.ASSETS)return env.ASSETS.fetch(req);return reply({error:'Not found'},404)}
 if(!env.ADMIN_TOKEN)return reply({error:'ADMIN_TOKEN is not configured'},503);
 const provided=req.headers.get('authorization')||'';
 if(provided!==`Bearer ${env.ADMIN_TOKEN}`)return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'D1 database binding missing'},503);
 if(u.pathname==='/api/conversations/import'&&req.method==='POST'){
  let body:any;try{body=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!Array.isArray(body?.items)||body.items.length<1||body.items.length>50)return reply({error:'Provide 1 to 50 conversations'},400);
  const validChannels=['whatsapp_business','facebook_messenger','online_assistant'];
  for(const item of body.items){if(!idOk(item?.id)||!validChannels.includes(item?.channel)||typeof item?.senderId!=='string'||!item.senderId.trim()||item.senderId.length>255||!Array.isArray(item.messages)||item.messages.length>100)return reply({error:'Invalid conversation import'},400);for(const m of item.messages){if(!idOk(m?.id)||!['inbound','outbound','ai'].includes(m?.direction)||typeof m?.body!=='string'||m.body.length>10000)return reply({error:'Invalid message import'},400)}}
  let conversations=0,messages=0;
  for(const item of body.items){await env.DB.prepare('INSERT OR IGNORE INTO conversations(id,channel,sender_id,human_paused,requested_human) VALUES(?,?,?,?,?)').bind(item.id,item.channel,item.senderId,item.humanPaused?1:0,item.requestedHuman?1:0).run();conversations++;for(const m of item.messages){const r=await env.DB.prepare('INSERT OR IGNORE INTO messages(id,conversation_id,direction,body) VALUES(?,?,?,?)').bind(m.id,item.id,m.direction,m.body).run();messages+=r.meta.changes||0}}
  return reply({importedConversations:conversations,newMessages:messages,providerDelivery:false,note:'Account 2 records are not deleted. Verify counts before cutover.'});
 }
 if(u.pathname==='/api/human-requests'&&req.method==='GET'){const r=await env.DB.prepare('SELECT id,channel,requested_human,human_paused,updated_at FROM conversations WHERE requested_human=1 ORDER BY updated_at DESC LIMIT 100').all();return reply({items:r.results,externalNotificationsConfigured:false})}
 if(u.pathname==='/api/human-requests'&&req.method==='POST'){let b:any;try{b=await req.json()}catch{return reply({error:'Invalid JSON'},400)}if(!idOk(b?.conversationId))return reply({error:'Invalid conversation ID'},400);const r=await env.DB.prepare('UPDATE conversations SET requested_human=1,human_paused=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.conversationId).run();if(!r.meta.changes)return reply({error:'Conversation not found'},404);return reply({saved:true,humanRequested:true,automationPaused:true,externalNotificationsSent:false})}
 if(u.pathname==='/api/handover-policy'&&req.method==='GET')return reply({enabled:false,providerConnected:false,channels:['whatsapp_business','facebook_messenger','online_assistant'],humanRequestOption:{id:'speak_to_evangelist',label:'I want to speak to Evangelist Emmanuel Ogheneochuko Adiohwo'},policy:{humanTakeoverPausesAI:true,resumeRequiresOperator:true,doNotAutoReplyAfterTakeover:true},note:'Policy is not enforced on any external provider until authorized webhook integration.'});
 if(u.pathname==='/api/automation/readiness'&&req.method==='GET'){const r=await env.DB.prepare('SELECT channel,status,COUNT(*) AS total FROM social_accounts GROUP BY channel,status').all();return reply({account:10,accounts:r.results,providerWebhooks:false,providerPublishing:false,geminiConfigured:!!env.GEMINI_API_KEY,account2MigrationComplete:false})}
 if(u.pathname==='/api/accounts'&&req.method==='GET'){const r=await env.DB.prepare('SELECT id,channel,status,created_at FROM social_accounts ORDER BY created_at DESC LIMIT 100').all();return reply({items:r.results,connected:false})}
 if(u.pathname==='/api/accounts'&&req.method==='POST'){let b:any;try{b=await req.json()}catch{return reply({error:'Invalid JSON'},400)}const channels=['whatsapp_business','facebook_messenger','facebook_page','instagram_professional','youtube','tiktok'];if(!channels.includes(b?.channel)||typeof b?.providerAccountRef!=='string'||!b.providerAccountRef.trim()||b.providerAccountRef.length>255)return reply({error:'Invalid social account'},400);const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO social_accounts(id,channel,provider_account_ref,status) VALUES(?,?,?,?)').bind(id,b.channel,b.providerAccountRef.trim(),'unverified').run();return reply({id,status:'unverified',connected:false},201)}
 if(u.pathname==='/api/platforms'&&req.method==='GET')return reply({channels:[{id:'whatsapp_business',inbox:'requires_official_webhook',publishing:'opt_in_messages_only'},{id:'facebook_messenger',inbox:'requires_page_authorization',publishing:'not_general_feed'},{id:'facebook_page',inbox:'requires_page_authorization',publishing:'requires_page_permissions'},{id:'instagram_professional',inbox:'requires_meta_authorization',publishing:'requires_professional_account'},{id:'youtube',inbox:'not_connected',publishing:'requires_google_authorization'},{id:'tiktok',inbox:'not_connected',publishing:'requires_approved_api_access'},{id:'facebook_personal',publishing:'unsupported_general_autopost'},{id:'facebook_groups',publishing:'unsupported_general_autopost'},{id:'whatsapp_groups',publishing:'not_enabled'}],allConnected:false});
 if(u.pathname==='/api/readiness'&&req.method==='GET')return reply({account:10,assetsConfigured:!!env.ASSETS,databaseConnected:!!env.DB,adminTokenConfigured:!!env.ADMIN_TOKEN,geminiConfigured:!!env.GEMINI_API_KEY,liveProviderMessaging:false,livePublishing:false,account2MigrationComplete:false});
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
 if(u.pathname==='/api/automation/preview'&&req.method==='POST'){let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}if(typeof data?.message!=='string'||data.message.length>4096)return reply({error:'Invalid message'},400);const rows=await env.DB.prepare('SELECT keyword,reply FROM automation_rules LIMIT 100').all<{keyword:string;reply:string}>();const match=rows.results.find(r=>data.message.toLowerCase().includes(r.keyword));return reply({matched:!!match,reply:match?.reply??null,sent:false})}
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
