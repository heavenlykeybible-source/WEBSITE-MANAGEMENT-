interface Env { DB: D1Database; ADMIN_TOKEN: string; GEMINI_API_KEY?: string; META_WEBHOOK_VERIFY_TOKEN?: string; META_APP_SECRET?: string; ASSETS?: Fetcher }
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const allowed=new Set(['whatsapp_business','facebook_messenger','online_assistant']);
const idOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(s);
const app={async fetch(req:Request,env:Env):Promise<Response>{
 const u=new URL(req.url);
 // Account 2 Studio social route compatibility; preserves the standalone Account 10 API.
 const legacy:Record<string,string>={
 '/api/social/welcome-menu':'/api/welcome-menu',
 '/api/social/assistant/handover-policy':'/api/handover-policy',
 '/api/social/assistant/conversation':'/api/conversation',
 '/api/social/assistant/conversations':'/api/conversations',
 '/api/social/assistant/takeover':'/api/takeover',
 '/api/social/whatsapp/rules':'/api/automation/rules',
 '/api/social/whatsapp/rules/preview':'/api/automation/preview',
 '/api/social/accounts':'/api/accounts',
 '/api/social/automation/readiness':'/api/automation/readiness'
 };
 u.pathname=legacy[u.pathname]??u.pathname;
 if(u.pathname==='/api/webhooks/meta'&&req.method==='GET'){
  const mode=u.searchParams.get('hub.mode');
  const token=u.searchParams.get('hub.verify_token');
  const challenge=u.searchParams.get('hub.challenge');
  if(!env.META_WEBHOOK_VERIFY_TOKEN)return reply({error:'Webhook verification is not configured'},503);
  if(mode!=='subscribe'||!token||token!==env.META_WEBHOOK_VERIFY_TOKEN||!challenge||!/^[0-9]{1,64}$/.test(challenge))return reply({error:'Webhook verification failed'},403);
  return new Response(challenge,{status:200,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
 }
 if(u.pathname==='/api/webhooks/meta'&&req.method==='POST'){
  if(!env.META_APP_SECRET)return reply({error:'Meta signature verification is not configured'},503);
  const signature=req.headers.get('x-hub-signature-256')||'';
  if(!/^sha256=[a-f0-9]{64}$/i.test(signature))return reply({error:'Missing or invalid Meta signature'},401);
  const lengthHeader=req.headers.get('content-length');
  if(lengthHeader!==null&&(!/^[0-9]+$/.test(lengthHeader)||!Number.isSafeInteger(Number(lengthHeader))))return reply({error:'Invalid Content-Length'},400);
  const declaredLength=Number(lengthHeader||0);
  if(declaredLength>1048576)return reply({error:'Webhook payload too large'},413);
  if(!req.body)return reply({error:'Empty webhook body'},400);
  const reader=req.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1048576){await reader.cancel();return reply({error:'Webhook payload too large'},413)}chunks.push(value)}}catch{return reply({error:'Unable to read webhook body'},400)}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const raw=bytes.buffer;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',key,raw);
  const expected=new Uint8Array(digest),provided=new Uint8Array(signature.slice(7).match(/../g)!.map(x=>parseInt(x,16)));
  let mismatch=0;for(let i=0;i<expected.length;i++)mismatch|=expected[i]^provided[i];
  if(mismatch!==0)return reply({error:'Invalid Meta signature'},401);
  let payload:any;try{payload=JSON.parse(new TextDecoder().decode(raw))}catch{return reply({error:'Invalid JSON payload'},400)}
  if(payload?.object!=='page'&&payload?.object!=='instagram'&&payload?.object!=='whatsapp_business_account')return reply({error:'Unsupported Meta event type'},400);
  if(!env.DB)return reply({error:'Webhook storage unavailable'},503);
  if(!Array.isArray(payload.entry)||payload.entry.length===0)return reply({error:'Webhook entry array required'},400);
  const count=payload.entry.length;
  if(count>100)return reply({error:'Too many webhook entries'},413);
  const types:string[]=[];
  for(const entry of payload.entry||[]){if(!entry||typeof entry!=='object')return reply({error:'Invalid webhook entry'},400);if(Array.isArray(entry.messaging))types.push('messaging');if(Array.isArray(entry.changes))types.push('changes')}
  const rawText=new TextDecoder().decode(raw);
  const eventId='meta_'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw))).map(x=>x.toString(16).padStart(2,'0')).join('');
  let saved;
  try{saved=await env.DB.prepare("INSERT OR IGNORE INTO webhook_events(id,provider,event_type,payload) VALUES(?,?,?,?)").bind(eventId,'meta',payload.object,rawText).run()}catch{return reply({error:'Webhook inbox unavailable; apply migration 0002'},503)}
  return reply({received:true,signatureVerified:true,stored:true,duplicate:!(saved.meta.changes||0),processed:false,eventEntries:count,eventCategories:[...new Set(types)],sent:false});
 }
 if(u.pathname==='/health')return reply({service:'Heavenly Key Social Management',account:10,status:'setup_required',providerConnected:false});
 if(!u.pathname.startsWith('/api/')){if((req.method==='GET'||req.method==='HEAD')&&env.ASSETS)return env.ASSETS.fetch(req);return reply({error:'Not found'},404)}
 if(req.method==='OPTIONS')return reply({error:'Cross-origin API access is disabled'},403);
 const type=req.headers.get('content-type')||'';
 if(['POST','PUT','PATCH'].includes(req.method)&&!type.toLowerCase().startsWith('application/json'))return reply({error:'JSON content type required'},415);
 const size=Number(req.headers.get('content-length')||0);
 if(size>1048576)return reply({error:'Request exceeds 1 MiB limit'},413);
 if(!env.ADMIN_TOKEN)return reply({error:'ADMIN_TOKEN is not configured'},503);
 const provided=req.headers.get('authorization')||'';
 if(provided!==`Bearer ${env.ADMIN_TOKEN}`)return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'D1 database binding missing'},503);
 if(u.pathname==='/api/accounts/import'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!Array.isArray(data?.items)||data.items.length<1||data.items.length>100)return reply({error:'Provide 1 to 100 accounts'},400);
  const channels=['whatsapp_business','facebook_messenger','facebook_page','instagram_professional','youtube','tiktok'];
  for(const item of data.items){if(!channels.includes(item?.channel)||typeof item?.providerAccountRef!=='string'||!item.providerAccountRef.trim()||item.providerAccountRef.length>255)return reply({error:'Invalid social account'},400)}
  let inserted=0;for(const item of data.items){const id=crypto.randomUUID();const r=await env.DB.prepare('INSERT OR IGNORE INTO social_accounts(id,channel,provider_account_ref,status) VALUES(?,?,?,?)').bind(id,item.channel,item.providerAccountRef.trim(),'unverified').run();inserted+=r.meta.changes||0}
  return reply({processed:data.items.length,inserted,authorizationTransferred:false,accountsConnected:false,sourceDataDeleted:false});
 }
 if(u.pathname==='/api/automation/rules/import'&&req.method==='POST'){
  let b:any;try{b=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!Array.isArray(b?.items)||b.items.length<1||b.items.length>100)return reply({error:'Provide 1 to 100 rules'},400);
  for(const item of b.items){if(typeof item?.keyword!=='string'||!item.keyword.trim()||item.keyword.length>80||typeof item?.reply!=='string'||!item.reply.trim()||item.reply.length>4096)return reply({error:'Invalid rule'},400)}
  let inserted=0;for(const item of b.items){const keyword=item.keyword.trim().toLowerCase();const existing=await env.DB.prepare('SELECT id FROM automation_rules WHERE keyword=? AND reply=? LIMIT 1').bind(keyword,item.reply.trim()).first();if(existing)continue;await env.DB.prepare('INSERT INTO automation_rules(id,keyword,reply) VALUES(?,?,?)').bind(crypto.randomUUID(),keyword,item.reply.trim()).run();inserted++}
  return reply({processed:b.items.length,inserted,enabled:false,sourceDataDeleted:false});
 }
 if(u.pathname==='/api/conversations/import'&&req.method==='POST'){
  let body:any;try{body=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!Array.isArray(body?.items)||body.items.length<1||body.items.length>50)return reply({error:'Provide 1 to 50 conversations'},400);
  const validChannels=['whatsapp_business','facebook_messenger','online_assistant'];
  for(const item of body.items){if(!idOk(item?.id)||!validChannels.includes(item?.channel)||typeof item?.senderId!=='string'||!item.senderId.trim()||item.senderId.length>255||!Array.isArray(item.messages)||item.messages.length>100)return reply({error:'Invalid conversation import'},400);for(const m of item.messages){if(!idOk(m?.id)||!['inbound','outbound','ai','draft'].includes(m?.direction)||typeof m?.body!=='string'||m.body.length>10000)return reply({error:'Invalid message import'},400)}}
  let conversations=0,messages=0;
  for(const item of body.items){await env.DB.prepare('INSERT OR IGNORE INTO conversations(id,channel,sender_id,human_paused,requested_human) VALUES(?,?,?,?,?)').bind(item.id,item.channel,item.senderId,item.humanPaused?1:0,item.requestedHuman?1:0).run();conversations++;for(const m of item.messages){const r=await env.DB.prepare('INSERT OR IGNORE INTO messages(id,conversation_id,direction,body) VALUES(?,?,?,?)').bind(m.id,item.id,m.direction,m.body).run();messages+=r.meta.changes||0}}
  return reply({importedConversations:conversations,newMessages:messages,providerDelivery:false,note:'Account 2 records are not deleted. Verify counts before cutover.'});
 }
 if(u.pathname==='/api/takeover'&&req.method==='GET'){
  const id=u.searchParams.get('conversationId');if(!idOk(id))return reply({error:'Valid conversationId required'},400);
  const row=await env.DB.prepare('SELECT human_paused FROM conversations WHERE id=?').bind(id).first<{human_paused:number}>();if(!row)return reply({error:'Conversation not found'},404);
  return reply({conversationId:id,automationPaused:!!row.human_paused,providerEnforced:false});
 }
 if(u.pathname==='/api/activity'&&req.method==='GET'){
  const [conversations,posts]=await Promise.all([
    env.DB.prepare('SELECT id,channel,human_paused,requested_human,updated_at FROM conversations ORDER BY updated_at DESC LIMIT 30').all(),
    env.DB.prepare('SELECT id,platform,status,created_at FROM social_posts ORDER BY created_at DESC LIMIT 30').all()
  ]);
  const items=[...(conversations.results||[]).map((v:any)=>({type:'conversation',id:v.id,channel:v.channel,needsHuman:!!v.requested_human,paused:!!v.human_paused,at:v.updated_at})),...(posts.results||[]).map((v:any)=>({type:'post',id:v.id,channel:v.platform,status:v.status,at:v.created_at}))].sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,50);
  return reply({items,liveProviderEvents:false});
 }
 if(u.pathname==='/api/webhooks/events/process'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.eventId))return reply({error:'Valid eventId required'},400);
  try{
   const event=await env.DB.prepare("SELECT id,event_type,payload,processing_status FROM webhook_events WHERE id=?").bind(data.eventId).first<{id:string,event_type:string,payload:string,processing_status:string}>();
   if(!event)return reply({error:'Event not found'},404);
   if(event.processing_status!=='pending')return reply({error:'Event is not pending'},409);
   if(event.event_type!=='whatsapp_business_account')return reply({error:'Only WhatsApp text messages are supported by this processor'},422);
   const parsed=JSON.parse(event.payload);if(!Array.isArray(parsed.entry))return reply({error:'Invalid stored webhook entries'},422);
   const inbound:{sender:string;messageId:string;body:string;account:string}[]=[];
   for(const entry of parsed.entry){if(!entry||!Array.isArray(entry.changes))continue;for(const change of entry.changes){if(!change||!Array.isArray(change.value?.messages))continue;for(const message of change.value.messages){if(!message||typeof message!=='object')continue;
    if(message.type!=='text'||typeof message.text?.body!=='string'||typeof message.from!=='string'||typeof message.id!=='string')continue;
    if(!message.text.body.trim()||message.text.body.length>10000||!idOk(message.id.replace(/[^a-zA-Z0-9:_-]/g,'_').slice(0,120)))continue;
    if(typeof change.value?.metadata?.phone_number_id!=='string'||!change.value.metadata.phone_number_id.trim())continue;
    inbound.push({sender:message.from,messageId:message.id,body:message.text.body,account:change.value.metadata.phone_number_id});
   }}}
   if(inbound.length===0||inbound.length>100)return reply({error:'No supported text messages or too many messages'},422);
   if(inbound.some(item=>!item.body.trim()))return reply({error:'Empty inbound message'},422);
   if(inbound.some(item=>item.body.includes('\u0000')))return reply({error:'Invalid message control character'},422);
   if(inbound.some(item=>!/^[A-Za-z0-9._:-]{1,255}$/.test(item.messageId)))return reply({error:'Invalid WhatsApp message ID format'},422);
   if(inbound.some(item=>item.account.length>100||item.sender.length>100||item.messageId.length>255))return reply({error:'Invalid WhatsApp identifier length'},422);
   if(inbound.some(item=>!/^[0-9]{1,30}$/.test(item.account)||!/^[0-9]{1,30}$/.test(item.sender)))return reply({error:'Invalid WhatsApp phone identifier format'},422);
   const seenIds=new Set<string>();
   for(const item of inbound){const key=item.account+':'+item.messageId;if(seenIds.has(key))return reply({error:'Duplicate WhatsApp message IDs within event'},422);seenIds.add(key)}
   const statements:D1PreparedStatement[]=[];
   for(const item of inbound){
    const senderKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.account+':'+item.sender)))).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
    const conversationId='wa_'+senderKey;
    const messageKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.account+':'+item.messageId)))).map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO conversations(id,channel,sender_id) VALUES(?,'whatsapp_business',?)").bind(conversationId,item.account+':'+item.sender));
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO messages(id,conversation_id,direction,body) VALUES(?,?,'inbound',?)").bind('wa_msg_'+messageKey,conversationId,item.body));
    statements.push(env.DB.prepare('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(conversationId));
   }
   statements.push(env.DB.prepare("UPDATE webhook_events SET processing_status='processed' WHERE id=? AND processing_status='pending'").bind(event.id));
   const results=await env.DB.batch(statements);
   if(!(results[results.length-1].meta.changes||0))return reply({error:'Concurrent review; retry'},409);
   const importedMessages=results.filter((result,index)=>index%3===1&&index<results.length-1).reduce((sum,result)=>sum+(result.meta.changes||0),0);
   return reply({processed:true,acceptedMessages:inbound.length,importedMessages,duplicateMessages:inbound.length-importedMessages,externalDelivery:false,automationTriggered:false});
  }catch{return reply({error:'Webhook processing failed; event remains pending if transaction rolled back'},503)}
 }
 if(u.pathname==='/api/webhooks/events/review'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.eventId)||!['ignored','failed'].includes(data?.status))return reply({error:'Provide a valid eventId and ignored or failed status'},400);
  try{
   const result=await env.DB.prepare("UPDATE webhook_events SET processing_status=? WHERE id=? AND processing_status='pending'").bind(data.status,data.eventId).run();
   if(!result.meta.changes)return reply({error:'Event not found or already reviewed'},409);
   return reply({reviewed:true,status:data.status,externalDelivery:false});
  }catch{return reply({error:'Webhook inbox unavailable; apply migration 0002'},503)}
 }
 if(u.pathname==='/api/webhooks/events'&&req.method==='GET'){
  const limitParam=u.searchParams.get('limit')||'25';
  if(!/^[0-9]{1,3}$/.test(limitParam)||Number(limitParam)<1||Number(limitParam)>100)return reply({error:'limit must be an integer from 1 to 100'},400);
  const limit=Number(limitParam);
  try{
   const result=await env.DB.prepare('SELECT id,provider,event_type,processing_status,received_at FROM webhook_events ORDER BY received_at DESC,id DESC LIMIT ?').bind(limit).all();
   const counts=await env.DB.prepare('SELECT processing_status,COUNT(*) AS total FROM webhook_events GROUP BY processing_status').all();
   return reply({items:result.results,counts:counts.results,payloadsExcluded:true,deliveryEnabled:false});
  }catch{return reply({error:'Webhook inbox unavailable; apply migration 0002'},503)}
 }
 if(u.pathname==='/api/operations/data-integrity'&&req.method==='GET'){
  const [orphanMessages,invalidDirections,duplicateAccounts,unverifiedAccounts,waitingDrafts]=await Promise.all([
   env.DB.prepare('SELECT COUNT(*) AS total FROM messages m LEFT JOIN conversations c ON c.id=m.conversation_id WHERE c.id IS NULL').first<{total:number}>(),
   env.DB.prepare("SELECT COUNT(*) AS total FROM messages WHERE direction NOT IN ('inbound','outbound','ai','draft')").first<{total:number}>(),
   env.DB.prepare('SELECT COUNT(*) AS total FROM (SELECT channel,provider_account_ref FROM social_accounts GROUP BY channel,provider_account_ref HAVING COUNT(*)>1)').first<{total:number}>(),
   env.DB.prepare("SELECT COUNT(*) AS total FROM social_accounts WHERE status!='verified'").first<{total:number}>(),
   env.DB.prepare("SELECT COUNT(*) AS total FROM messages WHERE direction='draft'").first<{total:number}>()
  ]);
  const checks=[{name:'orphan_messages',count:orphanMessages?.total??0,passed:!(orphanMessages?.total)},{name:'invalid_message_directions',count:invalidDirections?.total??0,passed:!(invalidDirections?.total)},{name:'duplicate_social_accounts',count:duplicateAccounts?.total??0,passed:!(duplicateAccounts?.total)}];
  return reply({integrityPassed:checks.every(x=>x.passed),checks,unverifiedAccounts:unverifiedAccounts?.total??0,waitingDrafts:waitingDrafts?.total??0,readOnly:true});
 }
 if(u.pathname==='/api/operations/diagnostics'&&req.method==='GET'){
  const checks:{name:string;ok:boolean;detail:string}[]=[{name:'admin_token',ok:!!env.ADMIN_TOKEN,detail:'Administrative authentication configured'},{name:'database_binding',ok:!!env.DB,detail:'Cloudflare D1 binding configured'},{name:'official_provider_oauth',ok:false,detail:'Official provider authorization not implemented'},{name:'external_message_delivery',ok:false,detail:'External messaging adapters not implemented'},{name:'scheduled_publishing',ok:false,detail:'Scheduled publishing worker not implemented'},{name:'gemini_automation',ok:false,detail:'AI processing not enabled'}];
  for(const [name,sql] of [['conversations','SELECT COUNT(*) AS total FROM conversations'],['messages','SELECT COUNT(*) AS total FROM messages'],['social_accounts','SELECT COUNT(*) AS total FROM social_accounts'],['automation_rules','SELECT COUNT(*) AS total FROM automation_rules'],['social_posts','SELECT COUNT(*) AS total FROM social_posts']] as const){try{const row=await env.DB.prepare(sql).first<{total:number}>();checks.push({name:'table_'+name,ok:true,detail:String(row?.total??0)+' records'})}catch{checks.push({name:'table_'+name,ok:false,detail:'Table unavailable or schema not migrated'})}}
  return reply({launchReady:checks.every(x=>x.ok),checks,checkedAt:new Date().toISOString()});
 }
 if(u.pathname==='/api/dashboard'&&req.method==='GET'){
  const counts=await Promise.all(['conversations','messages','automation_rules','social_accounts','social_posts'].map(async table=>{const row=await env.DB.prepare('SELECT COUNT(*) AS n FROM '+table).first<{n:number}>();return [table,row?.n??0]}));
  const human=await env.DB.prepare('SELECT COUNT(*) AS n FROM conversations WHERE requested_human=1').first<{n:number}>();const paused=await env.DB.prepare('SELECT COUNT(*) AS n FROM conversations WHERE human_paused=1').first<{n:number}>();const drafts=await env.DB.prepare("SELECT COUNT(*) AS n FROM social_posts WHERE status='draft'").first<{n:number}>();return reply({account:10,counts:Object.fromEntries(counts),humanRequests:human?.n??0,pausedConversations:paused?.n??0,postDrafts:drafts?.n??0,liveMessaging:false,livePublishing:false,providerAuthorizationsVerified:false});
 }
 if(u.pathname==='/api/migration/source-manifest'&&req.method==='GET')return reply({sourceAccount:2,destinationAccount:10,sourceRoutes:['/api/social/welcome-menu','/api/social/assistant/handover-policy','/api/social/assistant/conversation','/api/social/assistant/conversations','/api/social/assistant/takeover','/api/social/whatsapp/rules','/api/social/whatsapp/rules/preview','/api/social/accounts','/api/social/automation/readiness'],destinationRoutes:['/api/welcome-menu','/api/handover-policy','/api/conversation','/api/conversations','/api/takeover','/api/automation/rules','/api/automation/preview','/api/accounts','/api/automation/readiness'],imports:['/api/conversations/import','/api/messages/import','/api/automation/rules/import','/api/accounts/import'],sourceCredentialsMigrated:false,sourceRecordsVerified:false,externalProvidersConnected:false});
 if(u.pathname==='/api/conversations'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.id)||!allowed.has(data?.channel)||typeof data?.senderId!=='string'||!data.senderId.trim()||data.senderId.length>255)return reply({error:'Invalid conversation'},400);
  const r=await env.DB.prepare('INSERT OR IGNORE INTO conversations(id,channel,sender_id) VALUES(?,?,?)').bind(data.id,data.channel,data.senderId.trim()).run();return reply({id:data.id,created:!!r.meta.changes,providerConnected:false},r.meta.changes?201:200)
 }
 if(u.pathname==='/api/messages/import'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!Array.isArray(data?.items)||data.items.length<1||data.items.length>100)return reply({error:'Provide 1–100 messages'},400);
  for(const m of data.items){if(!idOk(m?.id)||!idOk(m?.conversationId)||!['inbound','outbound','ai','draft'].includes(m?.direction)||typeof m?.body!=='string'||m.body.length>10000)return reply({error:'Invalid imported message'},400)}
  const ids=[...new Set(data.items.map((m:any)=>m.conversationId))];for(const id of ids){if(!await env.DB.prepare('SELECT id FROM conversations WHERE id=?').bind(id).first())return reply({error:'Unknown conversation: '+id},400)}
  let inserted=0;for(const m of data.items){const r=await env.DB.prepare('INSERT OR IGNORE INTO messages(id,conversation_id,direction,body) VALUES(?,?,?,?)').bind(m.id,m.conversationId,m.direction,m.body).run();inserted+=r.meta.changes||0}return reply({processed:data.items.length,inserted,sourceDataDeleted:false,providerDelivery:false})
 }
 if(u.pathname==='/api/messages'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.body!=='string'||!data.body.trim()||data.body.length>10000)return reply({error:'Invalid message'},400);
  const conversation=await env.DB.prepare('SELECT id,human_paused,requested_human FROM conversations WHERE id=?').bind(data.conversationId).first<{id:string;human_paused:number;requested_human:number}>();if(!conversation)return reply({error:'Conversation not found'},404);if(conversation.human_paused||conversation.requested_human)return reply({error:'Human takeover active; automated draft creation blocked'},409);
  const id=crypto.randomUUID();const result=await env.DB.prepare("INSERT INTO messages(id,conversation_id,direction,body) SELECT ?,id,'draft',? FROM conversations WHERE id=? AND human_paused=0 AND requested_human=0").bind(id,data.body.trim(),data.conversationId).run();if(!result.meta.changes)return reply({error:'Human takeover activated; draft not created'},409);await env.DB.prepare('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.conversationId).run();return reply({id,saved:true,sent:false,providerConnected:false,note:'Saved as an operator draft. Not delivered externally.'},201)
 }
 if(u.pathname==='/api/human-requests/resolve'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.resumeAutomation!=='boolean')return reply({error:'Invalid resolution'},400);
  const result=await env.DB.prepare('UPDATE conversations SET requested_human=0,human_paused=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.resumeAutomation?0:1,data.conversationId).run();if(!result.meta.changes)return reply({error:'Conversation not found'},404);return reply({saved:true,humanRequestResolved:true,automationPaused:!data.resumeAutomation,providerEnforced:false})
 }
 if(u.pathname==='/api/human-requests'&&req.method==='GET'){const r=await env.DB.prepare('SELECT id,channel,requested_human,human_paused,updated_at FROM conversations WHERE requested_human=1 ORDER BY updated_at DESC LIMIT 100').all();return reply({items:r.results,externalNotificationsConfigured:false})}
 if(u.pathname==='/api/human-requests'&&req.method==='POST'){let b:any;try{b=await req.json()}catch{return reply({error:'Invalid JSON'},400)}if(!idOk(b?.conversationId))return reply({error:'Invalid conversation ID'},400);const r=await env.DB.prepare('UPDATE conversations SET requested_human=1,human_paused=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(b.conversationId).run();if(!r.meta.changes)return reply({error:'Conversation not found'},404);return reply({saved:true,humanRequested:true,automationPaused:true,externalNotificationsSent:false})}
 if(u.pathname==='/api/handover-policy'&&req.method==='GET')return reply({enabled:false,providerConnected:false,channels:['whatsapp_business','facebook_messenger','online_assistant'],humanRequestOption:{id:'speak_to_evangelist',label:'I want to speak to Evangelist Emmanuel Ogheneochuko Adiohwo'},policy:{humanTakeoverPausesAI:true,resumeRequiresOperator:true,doNotAutoReplyAfterTakeover:true},note:'Policy is not enforced on any external provider until authorized webhook integration.'});
 if(u.pathname==='/api/automation/readiness'&&req.method==='GET'){const r=await env.DB.prepare('SELECT channel,status,COUNT(*) AS total FROM social_accounts GROUP BY channel,status').all();return reply({account:10,accounts:r.results,providerWebhooks:false,providerPublishing:false,geminiConfigured:!!env.GEMINI_API_KEY,account2MigrationComplete:false})}
 if(u.pathname==='/api/accounts'&&req.method==='GET'){const r=await env.DB.prepare('SELECT id,channel,status,created_at FROM social_accounts ORDER BY created_at DESC LIMIT 100').all();return reply({items:r.results,connected:false})}
 if(u.pathname==='/api/accounts'&&req.method==='POST'){let b:any;try{b=await req.json()}catch{return reply({error:'Invalid JSON'},400)}const channels=['whatsapp_business','facebook_messenger','facebook_page','instagram_professional','youtube','tiktok'];if(!channels.includes(b?.channel)||typeof b?.providerAccountRef!=='string'||!b.providerAccountRef.trim()||b.providerAccountRef.length>255)return reply({error:'Invalid social account'},400);const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO social_accounts(id,channel,provider_account_ref,status) VALUES(?,?,?,?)').bind(id,b.channel,b.providerAccountRef.trim(),'unverified').run();return reply({id,status:'unverified',connected:false},201)}
 if(u.pathname==='/api/platforms'&&req.method==='GET')return reply({channels:[{id:'whatsapp_business',inbox:'requires_official_webhook',publishing:'opt_in_messages_only'},{id:'facebook_messenger',inbox:'requires_page_authorization',publishing:'not_general_feed'},{id:'facebook_page',inbox:'requires_page_authorization',publishing:'requires_page_permissions'},{id:'instagram_professional',inbox:'requires_meta_authorization',publishing:'requires_professional_account'},{id:'youtube',inbox:'not_connected',publishing:'requires_google_authorization'},{id:'tiktok',inbox:'not_connected',publishing:'requires_approved_api_access'},{id:'facebook_personal',publishing:'unsupported_general_autopost'},{id:'facebook_groups',publishing:'unsupported_general_autopost'},{id:'whatsapp_groups',publishing:'not_enabled'}],allConnected:false});
 if(u.pathname==='/api/readiness'&&req.method==='GET')return reply({account:10,assetsConfigured:!!env.ASSETS,databaseConnected:!!env.DB,adminTokenConfigured:!!env.ADMIN_TOKEN,geminiConfigured:!!env.GEMINI_API_KEY,liveProviderMessaging:false,livePublishing:false,account2MigrationComplete:false});
 if(u.pathname==='/api/migration/status'&&req.method==='GET'){const counts=await Promise.all(['conversations','messages','automation_rules','social_accounts','social_posts'].map(async table=>{const result=await env.DB.prepare('SELECT COUNT(*) AS total FROM '+table).first<{total:number}>();return {table,count:result?.total??0}}));return reply({account:10,counts,sourceAccount:2,sourceRecordsTransferred:'unverified',sourceDataDeleted:false})}
 if(u.pathname==='/api/migration/verify'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  const tables=['conversations','messages','automation_rules','social_accounts','social_posts'];const expected=data?.expected;if(!expected||typeof expected!=='object'||tables.some(t=>!Number.isSafeInteger(expected[t])||expected[t]<0))return reply({error:'Provide nonnegative source counts for all five tables'},400);
  const checks=await Promise.all(tables.map(async table=>{const r=await env.DB.prepare('SELECT COUNT(*) AS total FROM '+table).first<{total:number}>();return {table,source:expected[table],destination:r?.total??0,match:expected[table]===(r?.total??0)}}));return reply({verified:checks.every(x=>x.match),checks,sourceAccount:2,destinationAccount:10,providerIntegrationsVerified:false,readyForCutover:false});
 }
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
 if(u.pathname==='/api/drafts/approve-internal'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.draftId))return reply({error:'Valid draftId required'},400);
  const draft=await env.DB.prepare("SELECT m.id,m.conversation_id,c.human_paused,c.requested_human FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND m.direction='draft'").bind(data.draftId).first<{id:string;conversation_id:string;human_paused:number;requested_human:number}>();
  if(!draft)return reply({error:'Draft not found'},404);
  if(draft.human_paused||draft.requested_human)return reply({error:'Human takeover active; approval blocked'},409);
  const result=await env.DB.prepare("UPDATE messages SET direction='outbound' WHERE id=? AND direction='draft' AND EXISTS(SELECT 1 FROM conversations WHERE id=? AND human_paused=0 AND requested_human=0)").bind(data.draftId,draft.conversation_id).run();
  if(!result.meta.changes)return reply({error:'Draft changed or human takeover activated'},409);
  return reply({approved:true,internalOnly:true,sent:false,providerConnected:false});
 }
 if(u.pathname==='/api/drafts'&&req.method==='GET'){
  const result=await env.DB.prepare("SELECT m.id,m.conversation_id,m.body,m.created_at,c.channel,c.human_paused,c.requested_human FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.direction='draft' ORDER BY m.created_at DESC LIMIT 100").all();
  return reply({items:result.results,externalDeliveryEnabled:false});
 }
 if(u.pathname==='/api/drafts/discard'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.draftId))return reply({error:'Valid draftId required'},400);
  const result=await env.DB.prepare("DELETE FROM messages WHERE id=? AND direction='draft'").bind(data.draftId).run();
  if(!result.meta.changes)return reply({error:'Draft not found'},404);
  return reply({discarded:true,sent:false});
 }
 if(u.pathname==='/api/automation/evaluate-and-draft'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.message!=='string'||!data.message.trim()||data.message.length>4096)return reply({error:'Valid conversationId and message required'},400);
  const conversation=await env.DB.prepare('SELECT id,human_paused,requested_human FROM conversations WHERE id=?').bind(data.conversationId).first<{id:string;human_paused:number;requested_human:number}>();
  if(!conversation)return reply({error:'Conversation not found'},404);
  if(conversation.human_paused||conversation.requested_human)return reply({action:'human_review',draftCreated:false,sent:false});
  const rules=await env.DB.prepare('SELECT id,keyword,reply FROM automation_rules ORDER BY length(keyword) DESC,keyword ASC LIMIT 100').all<{id:string;keyword:string;reply:string}>();
  const message=data.message.toLocaleLowerCase();
  const match=rules.results.find(r=>r.keyword.trim()&&message.includes(r.keyword.trim().toLocaleLowerCase()));
  if(!match)return reply({action:'no_match',draftCreated:false,sent:false});
  if(data.eventId!==undefined&&!idOk(data.eventId))return reply({error:'eventId must be a valid identifier'},400);
  let draftId=crypto.randomUUID();
  if(data.eventId){const bytes=new TextEncoder().encode(conversation.id+'|'+data.eventId+'|'+match.id);const digest=await crypto.subtle.digest('SHA-256',bytes);draftId='auto_'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,48)}
  const result=await env.DB.prepare("INSERT OR IGNORE INTO messages(id,conversation_id,direction,body) SELECT ?,id,'draft',? FROM conversations WHERE id=? AND human_paused=0 AND requested_human=0").bind(draftId,match.reply,conversation.id).run();
  if(!result.meta.changes){const existing=await env.DB.prepare('SELECT id,direction FROM messages WHERE id=?').bind(draftId).first<{id:string;direction:string}>();if(existing)return reply({action:'already_processed',draftId,existingStatus:existing.direction,draftCreated:false,sent:false});return reply({action:'human_review',draftCreated:false,sent:false},409)}
  return reply({action:'draft_created',draftId,ruleId:match.id,draftCreated:true,sent:false,requiresOperatorApproval:true},201);
 }
 if(u.pathname==='/api/automation/evaluate'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.message!=='string'||!data.message.trim()||data.message.length>4096)return reply({error:'Valid conversationId and message required'},400);
  const conversation=await env.DB.prepare('SELECT id,channel,human_paused,requested_human FROM conversations WHERE id=?').bind(data.conversationId).first<{id:string;channel:string;human_paused:number;requested_human:number}>();
  if(!conversation)return reply({error:'Conversation not found'},404);
  if(conversation.human_paused||conversation.requested_human)return reply({action:'human_review',reason:conversation.requested_human?'human_requested':'automation_paused',sent:false,providerConnected:false});
  const rules=await env.DB.prepare('SELECT id,keyword,reply FROM automation_rules ORDER BY length(keyword) DESC,keyword ASC LIMIT 100').all<{id:string;keyword:string;reply:string}>();
  const message=data.message.toLocaleLowerCase();
  const rule=rules.results.find(r=>r.keyword.trim().length>0&&message.includes(r.keyword.trim().toLocaleLowerCase()));
  if(!rule)return reply({action:'no_match',sent:false,providerConnected:false});
  return reply({action:'suggest_reply',ruleId:rule.id,suggestedReply:rule.reply,sent:false,providerConnected:false,requiresOperatorApproval:true});
 }
 if(u.pathname==='/api/automation/preview'&&req.method==='POST'){let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}if(typeof data?.message!=='string'||data.message.length>4096)return reply({error:'Invalid message'},400);const rows=await env.DB.prepare('SELECT keyword,reply FROM automation_rules LIMIT 100').all<{keyword:string;reply:string}>();const match=rows.results.find(r=>r.keyword.trim().length>0&&data.message.toLowerCase().includes(r.keyword.toLowerCase()));return reply({matched:!!match,reply:match?.reply??null,sent:false})}
 if(u.pathname==='/api/posts'&&req.method==='GET'){
  const result=await env.DB.prepare('SELECT id,body,platform,status,scheduled_at,created_at FROM social_posts ORDER BY created_at DESC LIMIT 100').all();
  return reply({items:result.results,publishingConnected:false});
 }
 if(u.pathname==='/api/posts'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  const platforms=['facebook_page','instagram_professional','youtube','tiktok'];
  if(typeof data?.body!=='string'||!data.body.trim()||data.body.length>5000||!platforms.includes(data.platform))return reply({error:'Provide post text and a supported destination'},400);
  if(data.scheduledAt!==undefined&&(typeof data.scheduledAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(data.scheduledAt)||!Number.isFinite(Date.parse(data.scheduledAt))))return reply({error:'Invalid scheduledAt timestamp'},400);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO social_posts(id,body,platform,status,scheduled_at) VALUES(?,?,?,?,?)').bind(id,data.body.trim(),data.platform,'draft',data.scheduledAt||null).run();
  return reply({id,status:'draft',published:false,note:'Saved for review. Publishing is disabled until verified platform authorization and delivery adapters are installed.'},201);
 }
 if(u.pathname==='/api/takeover'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.paused!=='boolean')return reply({error:'Invalid takeover request'},400);
  const result=await env.DB.prepare('UPDATE conversations SET human_paused=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.paused?1:0,data.conversationId).run();
  if(!result.meta.changes)return reply({error:'Conversation not found'},404);return reply({saved:true,automationPaused:data.paused,providerEnforced:false});
 }
 return reply({error:'Not found'},404);
}};export default app;
