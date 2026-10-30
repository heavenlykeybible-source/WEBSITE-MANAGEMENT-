interface Env { DB: D1Database; MEDIA_BUCKET?: R2Bucket; ADMIN_TOKEN: string; GEMINI_API_KEY?: string; META_WEBHOOK_VERIFY_TOKEN?: string; META_APP_SECRET?: string; META_WHATSAPP_ACCESS_TOKEN?: string; ASSETS?: Fetcher }
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",'strict-transport-security':'max-age=31536000; includeSubDomains'}});
const allowed=new Set(['whatsapp_business','facebook_messenger','online_assistant']);
const idOk=(s:unknown):s is string=>typeof s==='string'&&/^[a-zA-Z0-9:_-]{1,120}$/.test(s);
const app={async fetch(req:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
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
  const newlyStored=!!(saved.meta.changes||0);
  const autoProcess=payload.object==='whatsapp_business_account'&&newlyStored&&!!env.ADMIN_TOKEN&&!!env.DB;
  if(autoProcess){
   const internal=new Request(new URL('/api/webhooks/events/process',req.url),{
    method:'POST',headers:{authorization:'Bearer '+env.ADMIN_TOKEN,'content-type':'application/json'},
    body:JSON.stringify({eventId})
   });
   ctx.waitUntil(app.fetch(internal,env,ctx).then(async result=>{
    if(!result.ok)console.error('Inbound webhook import requires review',result.status);
   }).catch(()=>console.error('Inbound webhook import failed')));
  }
  return reply({received:true,signatureVerified:true,stored:true,duplicate:!newlyStored,processed:false,importQueued:autoProcess,eventEntries:count,eventCategories:[...new Set(types)],sent:false});
 }
 if(u.pathname==='/health')return reply({service:'Heavenly Key Social Management',account:10,status:'setup_required',providerConnected:false,detail:'Public health response does not verify deployment readiness; run authenticated diagnostics and live provider tests.'});
 if(!u.pathname.startsWith('/api/')){if((req.method==='GET'||req.method==='HEAD')&&env.ASSETS)return env.ASSETS.fetch(req);return reply({error:'Not found'},404)}
 if(req.method==='OPTIONS')return reply({error:'Cross-origin API access is disabled'},403);
 const type=req.headers.get('content-type')||'';
 if(['POST','PUT','PATCH'].includes(req.method)&&!type.toLowerCase().startsWith('application/json'))return reply({error:'JSON content type required'},415);
 const declaredLength=req.headers.get('content-length');
 if(declaredLength!==null&&(!/^[0-9]+$/.test(declaredLength)||!Number.isSafeInteger(Number(declaredLength))))return reply({error:'Invalid Content-Length'},400);
 if(declaredLength!==null&&Number(declaredLength)>1048576)return reply({error:'Request exceeds 1 MiB limit'},413);
 if(!env.ADMIN_TOKEN)return reply({error:'ADMIN_TOKEN is not configured'},503);
 const provided=req.headers.get('authorization')||'';
 if(provided!==`Bearer ${env.ADMIN_TOKEN}`)return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'D1 database binding missing'},503);
 if(['POST','PUT','PATCH'].includes(req.method)){
  const contentType=req.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|\s*$)/i.test(contentType))return reply({error:'Content-Type must be application/json'},415);
  const declared=req.headers.get('content-length');
  if(declared!==null&&(!/^[0-9]+$/.test(declared)||!Number.isSafeInteger(Number(declared))))return reply({error:'Invalid Content-Length'},400);
  if(declared!==null&&Number(declared)>1048576)return reply({error:'Request payload too large'},413);
  const reader=req.clone().body?.getReader();
  if(reader){let received=0;try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;if(received>1048576){await reader.cancel();return reply({error:'Request payload too large'},413)}}}catch{return reply({error:'Unable to read request payload'},400)}}
 }

 if(u.pathname==='/api/storage/readiness'&&req.method==='GET'){
  const dbBound=!!env.DB,mediaBound=!!env.MEDIA_BUCKET;
  let databaseQueryOk=false,mediaBucketReadOk=false;
  try{if(dbBound){await env.DB.prepare('SELECT 1 AS ok').first();databaseQueryOk=true}}catch{}
  try{if(mediaBound){await env.MEDIA_BUCKET.head('account10-readiness-probe');mediaBucketReadOk=true}}catch{}
  return reply({account:10,dbBound,mediaBound,assetsBound:!!env.ASSETS,databaseQueryOk,mediaBucketReadOk,storageReady:databaseQueryOk&&mediaBucketReadOk,mediaOperationsEnabled:false,providerPublishingVerified:false,note:'Read-only probes; bucket head returning null counts as successful access. Schema migrations, write access and provider authorization remain unverified.'});
 }
 if(u.pathname==='/api/media'&&req.method==='POST'){
  if(!env.MEDIA_BUCKET)return reply({error:'Media storage is not configured'},503);
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(typeof data?.base64!=='string'||data.base64.length>1000000||!data.base64.length||typeof data?.contentType!=='string')return reply({error:'Provide a supported media file under 750 KB'},400);
  const supported=['image/png','image/jpeg','image/webp'];
  if(!supported.includes(data.contentType)||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data.base64))return reply({error:'Invalid media format or encoding'},400);
  let bytes:Uint8Array;
  try{const binary=atob(data.base64);if(binary.length<12||binary.length>750000)return reply({error:'Invalid media size'},400);bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))}catch{return reply({error:'Invalid base64'},400)}
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10;
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!(data.contentType==='image/png'&&png||data.contentType==='image/jpeg'&&jpeg||data.contentType==='image/webp'&&webp))return reply({error:'Media content does not match declared format'},415);
  const id=crypto.randomUUID(),key='account10/uploads/'+id;
  try{await env.MEDIA_BUCKET.put(key,bytes,{httpMetadata:{contentType:data.contentType},customMetadata:{source:'authenticated-operator'}})}catch{return reply({error:'Media storage write failed'},503)}
  return reply({id,contentType:data.contentType,size:bytes.length,stored:true,published:false,publicUrl:null},201);
 }
 if(u.pathname==='/api/media/list'&&req.method==='GET'){
  if(!env.MEDIA_BUCKET)return reply({error:'Media storage is not configured'},503);
  const cursor=u.searchParams.get('cursor')||undefined;
  if(cursor&&(cursor.length>1024||!/^[A-Za-z0-9_+\/=:-]+$/.test(cursor)))return reply({error:'Invalid page cursor'},400);
  try{
   const result=await env.MEDIA_BUCKET.list({prefix:'account10/uploads/',limit:50,...(cursor?{cursor}:{})});
   return reply({items:result.objects.map(item=>({id:item.key.slice('account10/uploads/'.length),size:item.size,uploadedAt:item.uploaded.toISOString()})).filter(item=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)),cursor:result.truncated?result.cursor:null,private:true});
  }catch{return reply({error:'Unable to list private media'},503)}
 }
 if(u.pathname==='/api/media'&&req.method==='GET'){
  if(!env.MEDIA_BUCKET)return reply({error:'Media storage is not configured'},503);
  const id=u.searchParams.get('id');if(!id||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return reply({error:'Valid media id required'},400);
  let object:R2ObjectBody|null;try{object=await env.MEDIA_BUCKET.get('account10/uploads/'+id)}catch{return reply({error:'Media storage read failed'},503)}
  if(!object)return reply({error:'Media not found'},404);
  return new Response(object.body,{headers:{'content-type':object.httpMetadata?.contentType||'application/octet-stream','cache-control':'private, no-store','x-content-type-options':'nosniff','content-disposition':'attachment; filename="socialplus-media"','content-security-policy':"default-src 'none'; sandbox",'referrer-policy':'no-referrer'}});
 }
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
   const inbound:{sender:string;messageId:string;body:string;account:string;timestamp:number}[]=[];
   const receipts:{account:string;messageId:string;status:'sent'|'delivered'|'read'|'failed'}[]=[];
   for(const entry of parsed.entry){if(!entry||!Array.isArray(entry.changes))continue;for(const change of entry.changes){
    if(!change)continue;
    const accountId=change.value?.metadata?.phone_number_id;
    if(Array.isArray(change.value?.statuses)&&typeof accountId==='string'){
     for(const receipt of change.value.statuses){
      if(receipt&&typeof receipt.id==='string'&&receipt.id.length<=255&&['sent','delivered','read','failed'].includes(receipt.status)){
       receipts.push({account:accountId,messageId:receipt.id,status:receipt.status});
      }
     }
    }
    if(!Array.isArray(change.value?.messages))continue;
    for(const message of change.value.messages){if(!message||typeof message!=='object')continue;
    if(message.type!=='text'||typeof message.text?.body!=='string'||typeof message.from!=='string'||typeof message.id!=='string')continue;
    if(!message.text.body.trim()||message.text.body.length>10000||!idOk(message.id.replace(/[^a-zA-Z0-9:_-]/g,'_').slice(0,120)))continue;
    if(typeof change.value?.metadata?.phone_number_id!=='string'||!change.value.metadata.phone_number_id.trim())continue;
    if(typeof message.timestamp!=='string'||!/^[0-9]{10,11}$/.test(message.timestamp))continue;
    const timestamp=Number(message.timestamp);
    if(!Number.isSafeInteger(timestamp)||timestamp*1000>Date.now()+300000)continue;
    inbound.push({sender:message.from,messageId:message.id,body:message.text.body,account:change.value.metadata.phone_number_id,timestamp});
   }}}
   if((inbound.length===0&&receipts.length===0)||inbound.length>100||receipts.length>100)return reply({error:'No supported messages or receipts, or too many records'},422);
   if(receipts.some(item=>!/^[0-9]{1,30}$/.test(item.account)||!/^[A-Za-z0-9._:-]{1,255}$/.test(item.messageId)))return reply({error:'Invalid WhatsApp receipt identifier'},422);
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
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO messages(id,conversation_id,direction,body,created_at) VALUES(?,?,'inbound',?,datetime(?,'unixepoch'))").bind('wa_msg_'+messageKey,conversationId,item.body,item.timestamp));
    statements.push(env.DB.prepare('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(conversationId));
   }
   for(const item of receipts){
    statements.push(env.DB.prepare("INSERT OR IGNORE INTO whatsapp_receipt_inbox(provider_message_id,phone_number_id,delivery_status) VALUES(?,?,?)").bind(item.messageId,item.account,item.status));
    statements.push(env.DB.prepare("UPDATE whatsapp_receipt_inbox SET delivery_status=CASE WHEN delivery_status='read' OR ?='read' THEN 'read' WHEN delivery_status='delivered' OR ?='delivered' THEN 'delivered' WHEN delivery_status='failed' THEN 'failed' ELSE ? END,received_at=CURRENT_TIMESTAMP WHERE provider_message_id=? AND phone_number_id=?").bind(item.status,item.status,item.status,item.messageId,item.account));
    statements.push(env.DB.prepare("UPDATE whatsapp_delivery_attempts SET delivery_status=(SELECT delivery_status FROM whatsapp_receipt_inbox WHERE provider_message_id=? AND phone_number_id=?),receipt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE provider_message_id=? AND phone_number_id=?").bind(item.messageId,item.account,item.messageId,item.account));
   }
   statements.push(env.DB.prepare("UPDATE webhook_events SET processing_status='processed' WHERE id=? AND processing_status='pending'").bind(event.id));
   const results=await env.DB.batch(statements);
   if(!(results[results.length-1].meta.changes||0))return reply({error:'Concurrent review; retry'},409);
   const importedMessages=results.filter((result,index)=>index%3===1&&index<inbound.length*3).reduce((sum,result)=>sum+(result.meta.changes||0),0);
   return reply({processed:true,acceptedMessages:inbound.length,importedMessages,duplicateMessages:inbound.length-importedMessages,receiptRecords:receipts.length,externalDelivery:false,automationTriggered:false});
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
  const checks:{name:string;ok:boolean;detail:string}[]=[{name:'admin_token',ok:!!env.ADMIN_TOKEN,detail:'Administrative authentication configured'},{name:'database_binding',ok:!!env.DB,detail:'Cloudflare D1 binding configured'},{name:'official_provider_oauth',ok:false,detail:'Official provider authorization not implemented'},{name:'external_message_delivery',ok:false,detail:'Guarded WhatsApp sender implemented; live provider delivery unverified, other providers not implemented'},{name:'whatsapp_access_token',ok:!!env.META_WHATSAPP_ACCESS_TOKEN,detail:env.META_WHATSAPP_ACCESS_TOKEN?'WhatsApp token configured; live permissions unverified':'WhatsApp token missing'}, {name:'scheduled_publishing',ok:false,detail:'Scheduled publishing worker not implemented'},{name:'gemini_reply_suggestions',ok:!!env.GEMINI_API_KEY,detail:env.GEMINI_API_KEY?'AI operator suggestions configured; live request remains unverified':'Gemini API key not configured'}];
  for(const [name,sql] of [['conversations','SELECT COUNT(*) AS total FROM conversations'],['messages','SELECT COUNT(*) AS total FROM messages'],['social_accounts','SELECT COUNT(*) AS total FROM social_accounts'],['automation_rules','SELECT COUNT(*) AS total FROM automation_rules'],['social_posts','SELECT COUNT(*) AS total FROM social_posts'],['webhook_events','SELECT COUNT(*) AS total FROM webhook_events'],['whatsapp_delivery_attempts','SELECT COUNT(*) AS total FROM whatsapp_delivery_attempts'],['whatsapp_receipt_inbox','SELECT COUNT(*) AS total FROM whatsapp_receipt_inbox'],['whatsapp_receipt_column','SELECT COUNT(delivery_status) AS total FROM whatsapp_delivery_attempts']] as const){try{const row=await env.DB.prepare(sql).first<{total:number}>();checks.push({name:'table_'+name,ok:true,detail:String(row?.total??0)+' records'})}catch{checks.push({name:'table_'+name,ok:false,detail:'Table unavailable or schema not migrated'})}}
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
  const conversation=await env.DB.prepare('SELECT id,human_paused,requested_human FROM conversations WHERE id=?').bind(data.conversationId).first<{id:string;human_paused:number;requested_human:number}>();if(!conversation)return reply({error:'Conversation not found'},404);
  const id=crypto.randomUUID();const result=await env.DB.prepare("INSERT INTO messages(id,conversation_id,direction,body) SELECT ?,id,'draft',? FROM conversations WHERE id=?").bind(id,data.body.trim(),data.conversationId).run();if(!result.meta.changes)return reply({error:'Conversation unavailable; draft not created'},409);await env.DB.prepare('UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(data.conversationId).run();return reply({id,saved:true,sent:false,providerConnected:false,note:'Saved as an operator draft. Not delivered externally.'},201)
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
  
  const result=await env.DB.prepare("UPDATE messages SET direction='outbound' WHERE id=? AND direction='draft'").bind(data.draftId).run();
  if(!result.meta.changes)return reply({error:'Draft already processed'},409);
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

 if(u.pathname==='/api/whatsapp/readiness'&&req.method==='GET'){
  const rows=await env.DB.prepare("SELECT provider_account_ref,status FROM social_accounts WHERE channel='whatsapp_business' ORDER BY created_at DESC LIMIT 20").all<{provider_account_ref:string;status:string}>();
  return reply({
   provider:'whatsapp_cloud_api',
   configured:{appSecret:!!env.META_APP_SECRET,verifyToken:!!env.META_WEBHOOK_VERIFY_TOKEN,accessToken:!!env.META_WHATSAPP_ACCESS_TOKEN},
   registeredAccounts:rows.results.length,
   accounts:rows.results.map(x=>({idSuffix:x.provider_account_ref.slice(-4),status:x.status})),
   inboundWebhookVerificationImplemented:true,
   automaticInboundTextImportImplemented:true,
   providerConnectionCheckImplemented:true,
   outboundDeliveryImplemented:true,
   outboundDeliveryEnabled:!!env.META_WHATSAPP_ACCESS_TOKEN,
   outboundDeliveryVerified:false,
   nextStep:'Verify Meta app subscriptions, provider permissions, and live messaging tests before enabling delivery'
  });
 }
 if(u.pathname==='/api/whatsapp/deliveries'&&req.method==='GET'){
  const conversationId=u.searchParams.get('conversationId');
  if(!idOk(conversationId))return reply({error:'Valid conversationId required'},400);
  try{
   const result=await env.DB.prepare("SELECT a.draft_id,a.state,a.delivery_status,a.provider_status,a.created_at FROM whatsapp_delivery_attempts a JOIN messages m ON m.id=a.draft_id WHERE m.conversation_id=? ORDER BY a.created_at DESC LIMIT 100").bind(conversationId).all();
   return reply({items:result.results,providerDeliveryVerified:false});
  }catch{return reply({error:'Delivery ledger unavailable; apply migrations 0004 and 0005'},503)}
 }
 if(u.pathname==='/api/whatsapp/send-approved'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.draftId)||data?.confirmSend!==true)return reply({error:'Valid draftId and explicit confirmSend=true required'},400);
  if(!env.META_WHATSAPP_ACCESS_TOKEN)return reply({error:'WhatsApp access token is not configured',sent:false},503);
  const draft=await env.DB.prepare("SELECT m.id,m.body,m.direction,c.channel,c.sender_id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=?").bind(data.draftId).first<{id:string;body:string;direction:string;channel:string;sender_id:string}>();
  if(!draft)return reply({error:'Draft not found'},404);
  if(draft.direction!=='outbound')return reply({error:'Draft requires internal approval before sending',sent:false},409);
  if(draft.channel!=='whatsapp_business')return reply({error:'This endpoint only supports WhatsApp Business',sent:false},422);
  const ids=draft.sender_id.split(':');
  if(ids.length!==2||ids.some(x=>!/^[0-9]{1,30}$/.test(x)))return reply({error:'Invalid WhatsApp conversation identifiers',sent:false},422);
  const [phoneNumberId,recipient]=ids;
  const account=await env.DB.prepare("SELECT id FROM social_accounts WHERE channel='whatsapp_business' AND status='verified' AND provider_account_ref=? LIMIT 1").bind(phoneNumberId).first();
  if(!account)return reply({error:'WhatsApp account not verified; run connection check before sending',sent:false},409);
  if(!draft.body.trim()||draft.body.length>4096)return reply({error:'WhatsApp text must contain 1 to 4096 characters',sent:false},422);
  const recent=await env.DB.prepare("SELECT id FROM messages WHERE conversation_id=(SELECT conversation_id FROM messages WHERE id=?) AND direction='inbound' AND id GLOB 'wa_msg_*' AND datetime(created_at)>=datetime('now','-24 hours') ORDER BY created_at DESC LIMIT 1").bind(draft.id).first();
  if(!recent)return reply({error:'WhatsApp 24-hour customer service window is not confirmed; free-form message blocked',sent:false},409);
  try{await env.DB.prepare('SELECT provider_message_id FROM whatsapp_receipt_inbox LIMIT 1').first()}catch{return reply({error:'Receipt reconciliation schema unavailable; apply migration 0006 before sending',sent:false},503)}
  let reservation;
  try{
   reservation=await env.DB.prepare("INSERT OR IGNORE INTO whatsapp_delivery_attempts(draft_id,phone_number_id,state) VALUES(?,?,'reserved')").bind(draft.id,phoneNumberId).run();
  }catch{return reply({error:'Delivery ledger unavailable; apply migration 0004 before sending',sent:false},503)}
  if(!reservation.meta.changes)return reply({error:'Delivery already attempted; review delivery status before further action',sent:false},409);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
  let state:'sent'|'rejected'|'unknown'='unknown';let providerStatus:number|null=null;let providerMessageId:string|null=null;
  try{
   const response=await fetch('https://graph.facebook.com/v23.0/'+encodeURIComponent(phoneNumberId)+'/messages',{
    method:'POST',
    headers:{authorization:'Bearer '+env.META_WHATSAPP_ACCESS_TOKEN,'content-type':'application/json'},
    body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:recipient,type:'text',text:{preview_url:false,body:draft.body}}),
    signal:controller.signal
   });
   providerStatus=response.status;
   if(response.ok){
    const result:any=await response.json();
    if(typeof result?.messages?.[0]?.id==='string'&&result.messages[0].id.length<=255){
     providerMessageId=result.messages[0].id;state='sent';
    }
   }else if(response.status>=400&&response.status<500&&response.status!==408&&response.status!==429){state='rejected'}
  }catch{/* A lost response may still mean Meta accepted the message; do not retry automatically. */}
  finally{clearTimeout(timeout)}
  try{
   const updates=[env.DB.prepare("UPDATE whatsapp_delivery_attempts SET state=?,provider_message_id=?,provider_status=?,updated_at=CURRENT_TIMESTAMP WHERE draft_id=? AND state='reserved'").bind(state,providerMessageId,providerStatus,draft.id)];
   if(providerMessageId)updates.push(env.DB.prepare("UPDATE whatsapp_delivery_attempts SET delivery_status=(SELECT delivery_status FROM whatsapp_receipt_inbox WHERE provider_message_id=? AND phone_number_id=?),receipt_at=(SELECT received_at FROM whatsapp_receipt_inbox WHERE provider_message_id=? AND phone_number_id=?),updated_at=CURRENT_TIMESTAMP WHERE draft_id=? AND EXISTS(SELECT 1 FROM whatsapp_receipt_inbox WHERE provider_message_id=? AND phone_number_id=?)").bind(providerMessageId,phoneNumberId,providerMessageId,phoneNumberId,draft.id,providerMessageId,phoneNumberId));
   await env.DB.batch(updates);
  }catch{return reply({error:'Provider call completed but delivery ledger update failed; reconcile manually before any further action',sent:false,deliveryUncertain:true},503)}
  if(state==='sent')return reply({sent:true,providerAccepted:true,deliveryConfirmed:false,draftId:draft.id,providerMessageId},200);
  if(state==='rejected')return reply({sent:false,providerRejected:true,providerStatus,automaticRetry:false},502);
  return reply({sent:false,deliveryUncertain:true,providerStatus,automaticRetry:false,note:'Provider response was inconclusive. Reconcile the attempt; never resend automatically.'},502);
 }
 if(u.pathname==='/api/whatsapp/connection-check'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  const phoneNumberId=data?.phoneNumberId;
  if(typeof phoneNumberId!=='string'||!/^[0-9]{1,30}$/.test(phoneNumberId))return reply({error:'Valid WhatsApp phone number ID required'},400);
  if(!env.META_WHATSAPP_ACCESS_TOKEN)return reply({error:'WhatsApp Cloud API access token is not configured',connected:false},503);
  const account=await env.DB.prepare("SELECT id FROM social_accounts WHERE channel='whatsapp_business' AND provider_account_ref=? LIMIT 1").bind(phoneNumberId).first<{id:string}>();
  if(!account)return reply({error:'Register WhatsApp business account metadata before checking access'},404);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('https://graph.facebook.com/v23.0/'+encodeURIComponent(phoneNumberId)+'?fields=id,display_phone_number,verified_name',{
    headers:{authorization:'Bearer '+env.META_WHATSAPP_ACCESS_TOKEN},signal:controller.signal
   });
   if(!response.ok)return reply({connected:false,providerStatus:response.status,error:'Meta account authorization check failed',sendPermissionVerified:false},502);
   const result:any=await response.json();
   if(result?.id!==phoneNumberId)return reply({connected:false,error:'Unexpected provider account identifier'},502);
   await env.DB.prepare("UPDATE social_accounts SET status='verified' WHERE id=? AND channel='whatsapp_business'").bind(account.id).run();
   return reply({connected:true,accountId:account.id,phoneNumberId,resultName:typeof result.verified_name==='string'?result.verified_name:null,sendPermissionVerified:false,webhookSubscriptionVerified:false,note:'Token can read the registered WhatsApp phone number. Sending and webhook delivery require separate verification.'});
  }catch{return reply({connected:false,error:'Meta connection timed out or failed'},502)}
  finally{clearTimeout(timeout)}
 }
 if(u.pathname==='/api/ai/suggest-reply'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(!idOk(data?.conversationId)||typeof data?.message!=='string'||!data.message.trim()||data.message.length>4000)return reply({error:'Valid conversation and message required'},400);
  if(!env.GEMINI_API_KEY)return reply({error:'Gemini API key is not configured'},503);
  const conversation=await env.DB.prepare('SELECT id,human_paused,requested_human FROM conversations WHERE id=?').bind(data.conversationId).first<{id:string;human_paused:number;requested_human:number}>();
  if(!conversation)return reply({error:'Conversation not found'},404);
  if(conversation.human_paused||conversation.requested_human)return reply({action:'human_review',suggestion:null,sent:false,reason:'Human takeover active'});
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',{
    method:'POST',signal:controller.signal,
    headers:{'content-type':'application/json','x-goog-api-key':env.GEMINI_API_KEY},
    body:JSON.stringify({systemInstruction:{parts:[{text:'Draft a concise, respectful suggested customer-service reply. Do not claim to have sent any message or completed any action. Avoid requesting sensitive personal information. A human operator must review this draft.'}]},contents:[{role:'user',parts:[{text:data.message}]}],generationConfig:{maxOutputTokens:400,temperature:0.5}})
   });
   if(!response.ok)return reply({error:'AI provider request failed',providerStatus:response.status,sent:false},502);
   const result:any=await response.json();const suggestion=(result?.candidates?.[0]?.content?.parts||[]).map((p:any)=>typeof p?.text==='string'?p.text:'').join('').trim().slice(0,3000);
   if(!suggestion)return reply({error:'AI provider returned no usable text',sent:false},502);
   return reply({action:'suggest_reply',suggestion,provider:'gemini',sent:false,saved:false,requiresOperatorApproval:true});
  }catch{return reply({error:'AI provider timeout or network failure',sent:false},502)}
  finally{clearTimeout(timeout)}
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
  const result=await env.DB.prepare('SELECT id,body,platform,status,scheduled_at,media_id,created_at FROM social_posts ORDER BY created_at DESC LIMIT 100').all();
  return reply({items:result.results,publishingConnected:false});
 }
 if(u.pathname==='/api/posts'&&req.method==='DELETE'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(typeof data?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id))return reply({error:'Valid draft id required'},400);
  const result=await env.DB.prepare("DELETE FROM social_posts WHERE id=? AND status='draft'").bind(data.id).run();
  if(!result.meta?.changes)return reply({error:'Draft not found or not deletable'},404);
  return reply({id:data.id,deleted:true,published:false});
 }
 if(u.pathname==='/api/posts'&&req.method==='PATCH'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(typeof data?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id))return reply({error:'Valid draft id required'},400);
  const platforms=['facebook_page','instagram_professional','youtube','tiktok'];
  if(typeof data.body!=='string'||!data.body.trim()||data.body.length>5000||!platforms.includes(data.platform))return reply({error:'Provide valid post text and destination'},400);
  if(data.mediaId!==undefined&&data.mediaId!==null){if(typeof data.mediaId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.mediaId))return reply({error:'Invalid media ID'},400);if(!env.MEDIA_BUCKET)return reply({error:'Media storage is unavailable'},503);const object=await env.MEDIA_BUCKET.head('account10/uploads/'+data.mediaId);if(!object)return reply({error:'Attached media was not found'},404)}
  const result=await env.DB.prepare("UPDATE social_posts SET body=?,platform=?,media_id=CASE WHEN ? THEN ? ELSE media_id END WHERE id=? AND status='draft'").bind(data.body.trim(),data.platform,data.mediaId!==undefined?1:0,data.mediaId??null,data.id).run();
  if(!result.meta?.changes)return reply({error:'Draft not found or not editable'},404);
  return reply({id:data.id,status:'draft',updated:true,published:false});
 }
 if(u.pathname==='/api/posts/queue'&&req.method==='PUT'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(typeof data?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id))return reply({error:'Valid draft id required'},400);
  if(typeof data?.scheduledAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.scheduledAt)||!Number.isFinite(Date.parse(data.scheduledAt))||Date.parse(data.scheduledAt)<=Date.now())return reply({error:'Provide a future ISO 8601 timestamp with timezone'},400);
  const result=await env.DB.prepare("UPDATE social_posts SET scheduled_at=? WHERE id=? AND status='draft'").bind(data.scheduledAt,data.id).run();
  if(!result.meta?.changes)return reply({error:'Draft not found or no longer editable'},404);
  return reply({id:data.id,status:'draft',scheduledAt:data.scheduledAt,published:false});
 }
 if(u.pathname==='/api/posts/queue'&&req.method==='PATCH'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  if(typeof data?.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id))return reply({error:'Valid draft id required'},400);
  if(data.action!=='unschedule')return reply({error:'Only unschedule is supported; external publishing is disabled'},400);
  const result=await env.DB.prepare("UPDATE social_posts SET scheduled_at=NULL WHERE id=? AND status='draft' AND scheduled_at IS NOT NULL").bind(data.id).run();
  if(!result.meta?.changes)return reply({error:'Scheduled draft not found or already changed'},404);
  return reply({id:data.id,status:'draft',scheduledAt:null,published:false});
 }
 if(u.pathname==='/api/posts/queue'&&req.method==='GET'){
  const result=await env.DB.prepare("SELECT id,body,platform,status,scheduled_at,media_id,created_at FROM social_posts WHERE status='draft' AND scheduled_at IS NOT NULL ORDER BY scheduled_at ASC LIMIT 100").all();
  const now=Date.now();
  return reply({items:(result.results||[]).map((post:any)=>({...post,due:Number.isFinite(Date.parse(String(post.scheduled_at)))&&Date.parse(String(post.scheduled_at))<=now})),publishingConnected:false,note:'Review-only queue. No automatic publishing or platform delivery is enabled.'});
 }
 if(u.pathname==='/api/posts'&&req.method==='POST'){
  let data:any;try{data=await req.json()}catch{return reply({error:'Invalid JSON'},400)}
  const platforms=['facebook_page','instagram_professional','youtube','tiktok'];
  if(typeof data?.body!=='string'||!data.body.trim()||data.body.length>5000||!platforms.includes(data.platform))return reply({error:'Provide post text and a supported destination'},400);
  if(data.scheduledAt!==undefined&&(typeof data.scheduledAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(data.scheduledAt)||!Number.isFinite(Date.parse(data.scheduledAt))||Date.parse(data.scheduledAt)<=Date.now()))return reply({error:'scheduledAt must be a future ISO 8601 timestamp with timezone'},400);
  if(data.mediaId!==undefined&&data.mediaId!==null){if(typeof data.mediaId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.mediaId))return reply({error:'Invalid media ID'},400);if(!env.MEDIA_BUCKET)return reply({error:'Media storage is unavailable'},503);const object=await env.MEDIA_BUCKET.head('account10/uploads/'+data.mediaId);if(!object)return reply({error:'Attached media was not found'},404)}
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO social_posts(id,body,platform,status,scheduled_at,media_id) VALUES(?,?,?,?,?,?)').bind(id,data.body.trim(),data.platform,'draft',data.scheduledAt||null,data.mediaId??null).run();
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
