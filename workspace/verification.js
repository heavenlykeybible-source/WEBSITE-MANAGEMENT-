const PROVIDER_VERIFICATION_URLS={cloudflare:'https://dash.cloudflare.com/',github:'https://github.com/login',google:'https://accounts.google.com/'};
async function requestProviderVerification(env,actor,b){
 if(actor.ow||actor.a?.owner_id||actor.a?.site_id||!actor.a?.can_read)fail('Use an unscoped owner-authorized AI connection for verification requests.',403);
 if(!actor.chatUserId){const owner=await env.DB.prepare("SELECT id FROM users WHERE role='owner' AND kind='staff' AND status='active'").first();if(!owner)fail('Owner account not available',403);actor={...actor,chatUserId:owner.id};}
 const owner=await env.DB.prepare("SELECT role,kind FROM users WHERE id=? AND status='active'").bind(actor.chatUserId).first();if(owner?.role!=='owner'||owner.kind==='member')fail('Owner access required',403);
 if(!Object.hasOwn(PROVIDER_VERIFICATION_URLS,b.provider))fail('Choose Cloudflare, GitHub or Google');
 const reason=String(b.reason||'').trim();if(!reason||reason.length>500)fail('Explain why verification is needed.');
 if(b.provider==='cloudflare')await connById(env,b.connection);else if(b.provider==='github')await ghById(env,b.connection,scopeOf({kind:'owner',user:{id:actor.chatUserId,kind:'staff'},ow:null}));
 const pending=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 50").bind('workspace:verification:'+actor.chatUserId+':%').all();const prior=pending.results.map(r=>JSON.parse(r.value_json)).find(r=>r.status==='pending'&&r.expires>Date.now()&&r.provider===b.provider&&String(r.connection)===String(b.connection||'')&&r.conversation===(actor.chatConversationId||''));if(prior)return {verification_request:prior};
 const id=crypto.randomUUID(),record={id,provider:b.provider,connection:String(b.connection||''),reason,url:PROVIDER_VERIFICATION_URLS[b.provider],conversation:actor.chatConversationId||'',status:'pending',expires:Date.now()+24*3600000};
 await env.DB.prepare('INSERT INTO settings(key,value_json)VALUES(?,?)').bind('workspace:verification:'+actor.chatUserId+':'+id,JSON.stringify(record)).run();return {verification_request:record,notice:'The owner must verify directly with the official provider. Do not ask for passwords, email codes or CAPTCHA answers in chat. Provider verification and AI permissions are separate.'};
}
async function providerVerificationRoutes(req,env,user,sub,m){
 if(!sub.startsWith('verification'))return null;if(user.role!=='owner'||user.kind==='member')fail('Owner access required',403);
 if(sub==='verification'&&m==='GET'){const rows=await env.DB.prepare("SELECT value_json FROM settings WHERE key LIKE ? ORDER BY updated_at DESC LIMIT 50").bind('workspace:verification:'+user.id+':%').all();return json({requests:rows.results.map(r=>JSON.parse(r.value_json)).filter(r=>r.status==='pending'&&r.expires>Date.now())});}
 if(sub==='verification/resolve'&&m==='POST'){
  const b=await body(req);if(!/^[a-f0-9-]{36}$/.test(String(b.id))||!['decline','recheck'].includes(b.action))fail('Choose Decline or Recheck');
  return withOperationLock(env,'verification:'+b.id,async()=>{const key='workspace:verification:'+user.id+':'+b.id,row=await env.DB.prepare('SELECT value_json FROM settings WHERE key=?').bind(key).first();if(!row)fail('Verification request not found',404);const record=JSON.parse(row.value_json);if(record.status!=='pending'||record.expires<Date.now())fail('Request expired or already resolved.',409);
   if(b.action==='decline')record.status='declined';
   else if(record.provider==='cloudflare'){const c=await connById(env,record.connection);await cf(env,c,'GET','/workers/scripts');record.status='connection-verified';}
   else if(record.provider==='github'){const g=await ghById(env,record.connection,scopeOf({kind:'owner',user,ow:null}));await ghHead(env,g);record.status='connection-verified';}
   else fail('Google sign-in cannot be confirmed here. Test the connected Google Drive source after completing the official provider step.',409);
   await env.DB.prepare('UPDATE settings SET value_json=? WHERE key=?').bind(JSON.stringify(record),key).run();await audit(env,user.username,'provider-verification',record.provider+' '+record.status);return json({ok:true,status:record.status,notice:record.status==='connection-verified'?'Saved API connection can be read. This does not prove browser sign-in or write permission.':'No access granted.'});
  });
 }
 fail('Method not allowed',405);
}
