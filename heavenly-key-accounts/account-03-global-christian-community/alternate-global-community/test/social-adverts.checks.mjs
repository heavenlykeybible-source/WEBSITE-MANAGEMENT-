import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('..',import.meta.url));
test('Social sign-in and adverts: permissions, encrypted settings, identity validation, replay, consent and schedules',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'social-adverts-')),db=new DatabaseSync(':memory:'),realFetch=globalThis.fetch;
 try{
 for(const file of readdirSync(path.join(base,'migrations')).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(path.join(base,'migrations',file),'utf8'));
 for(const file of readdirSync(path.join(base,'src')).filter(x=>x.endsWith('.ts'))){let source=stripTypeScriptTypes(readFileSync(path.join(base,'src',file),'utf8'));source=source.replace(/from (["'])\.\/([a-z-]+)\1/g,(_,q,n)=>'from '+q+'./'+n+'.mjs'+q).replace(/from (["'])\.\.\/public\/([a-z-]+\.js)\1/g,(_,q,n)=>'from '+q+pathToFileURL(path.join(base,'public',n)).href+q);writeFileSync(path.join(dir,file.replace(/\.ts$/,'.mjs')),source);}
 const worker=(await import(pathToFileURL(path.join(dir,'index.mjs')).href)).default,auth=await import(pathToFileURL(path.join(dir,'auth.mjs')).href),social=await import(pathToFileURL(path.join(dir,'social-auth.mjs')).href);
 const images=new Map(),entries=new Map(),statement=(sql,params=[])=>({sql,params,bind(...p){return statement(sql,p);},async first(){return db.prepare(sql).get(...params)||null;},async all(){return {results:db.prepare(sql).all(...params)};},async run(){const r=db.prepare(sql).run(...params);return {meta:{changes:Number(r.changes)}};}}),env={DB:{prepare:sql=>statement(sql),async batch(items){db.exec('BEGIN');try{const result=items.map(item=>({results:db.prepare(item.sql).all(...item.params)}));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},SESSIONS:{async get(k){return entries.get(k)||null;},async put(k,v){entries.set(k,v);},async delete(k){entries.delete(k);}},PASSWORD_PEPPER:'disposable-test-only-pepper',SESSION_SECRET:'disposable-settings-secret',MEDIA:{async put(k,b){images.set(k,new Uint8Array(b));},async get(k){const b=images.get(k);return b?{body:new Response(b).body,httpEtag:'test-etag'}:null;},async delete(k){images.delete(k);}}};
 let ip=0;async function req(route,data,cookie,method=data?'POST':'GET',extra={}){const r=await worker.fetch(new Request('https://community.example'+route,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':'test-'+(++ip),...(cookie?{Cookie:cookie}:{}),...extra},body:data?JSON.stringify(data):undefined}),env);return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():null,cookies:r.headers.getSetCookie(),location:r.headers.get('location')};}
 const cookies=r=>r.cookies.map(c=>c.split(';')[0]).join('; ');
 function seed(id,role='member'){db.prepare("INSERT INTO users(user_id,email,password_hash,password_salt,role) VALUES(?,?,?,?,?)").run(id,'member'+id+'@example.invalid','not-a-password','',role);db.prepare("INSERT INTO profiles(user_id,full_name,display_name) VALUES(?,?,?)").run(id,'Member '+id,'Member '+id);}
 seed(1);seed(2,'administrator');seed(3,'moderator');const member='gc_session='+await auth.createSession(env,{userId:1,role:'member',status:'active'}),admin='gc_session='+await auth.createSession(env,{userId:2,role:'administrator',status:'active'}),moderator='gc_session='+await auth.createSession(env,{userId:3,role:'moderator',status:'active'});
 for(const route of ['/api/admin/adverts','/api/admin/social-signin'])for(const cookie of [null,member,moderator])assert.equal((await req(route,null,cookie)).status,403);
 assert.equal((await req('/api/auth/social/providers')).data.items.every(p=>!p.ready),true);
 assert.equal((await req('/api/auth/social/google/start',{})).status,503);
 const credentials={clientId:'test-client',clientSecret:'test-private-secret',enabled:true};
 assert.equal((await req('/api/admin/social-signin/google',credentials,member)).status,403);
 assert.equal((await req('/api/admin/social-signin/google',credentials,admin)).status,200);assert.ok(!entries.get('social-config:google').includes(credentials.clientSecret));
 assert.equal((await req('/api/admin/social-signin/google',{...credentials,clientSecret:''},admin)).status,200);
 const settings=(await req('/api/admin/social-signin',null,admin)).data;assert.ok(!JSON.stringify(settings).includes(credentials.clientSecret));assert.equal(settings.items[0].secretConfigured,true);
 const start=await req('/api/auth/social/google/start',{}),url=new URL(start.data.url),state=url.searchParams.get('state'),f=JSON.parse(db.prepare('SELECT payload FROM social_login_flows WHERE state=?').get(state).payload);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),'https://community.example/api/auth/social/google/callback');
 const mismatch=await req('/api/auth/social/google/callback?state='+state+'&code=valid',null,'gc_social_state=wrong');assert.match(mismatch.location,/socialError=failed/);assert.ok(db.prepare('SELECT 1 FROM social_login_flows WHERE state=?').get(state));
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='local-test-key';
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');let claims={iss:'https://accounts.google.com',aud:'test-client',sub:'google-member-1',nonce:f.nonce,exp:Math.floor(Date.now()/1000)+300,iat:Math.floor(Date.now()/1000),name:'Social Member',email:'social@example.invalid',email_verified:true};
 async function token(c=claims){const data=encode({alg:'RS256',kid:jwk.kid})+'.'+encode(c);return data+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(data))).toString('base64url');}
 globalThis.fetch=async (url,init)=>{if(String(url).includes('/oauth2/v3/certs'))return Response.json({keys:[jwk]});if(String(url)==='https://oauth2.googleapis.com/token'){assert.equal(init.body.get('code_verifier'),f.verifier);return Response.json({id_token:await token()});}throw Error('Unexpected external request');};
 await assert.rejects(social.verifyGoogleToken(await token({...claims,aud:'another-app'}),'test-client',f.nonce));await assert.rejects(social.verifyGoogleToken(await token({...claims,nonce:'another-browser'}),'test-client',f.nonce));await assert.rejects(social.verifyGoogleToken(await token({...claims,exp:1}),'test-client',f.nonce));
 const goodToken=await token(),badToken=goodToken.slice(0,goodToken.lastIndexOf('.')+1)+Buffer.alloc(256).toString('base64url');await assert.rejects(social.verifyGoogleToken(badToken,'test-client',f.nonce));
 const callback=await req('/api/auth/social/google/callback?state='+state+'&code=valid',null,cookies(start));assert.equal(callback.location,'https://community.example/account.html?social=complete');
 const pending=cookies(callback);assert.equal((await req('/api/auth/social/complete',{fullName:'Social Member',ageConfirmed:false,standardsAccepted:true},pending)).status,400);
 const created=await req('/api/auth/social/complete',{fullName:'Social Member',ageConfirmed:true,standardsAccepted:true},pending);assert.equal(created.status,201,JSON.stringify(created));assert.equal(db.prepare("SELECT COUNT(*) n FROM social_identities WHERE provider='google'").get().n,1);
 assert.equal((await req('/api/auth/social/complete',{fullName:'Social Member',ageConfirmed:true,standardsAccepted:true},pending)).status,400);
 assert.match((await req('/api/auth/social/google/callback?state='+state+'&code=valid',null,cookies(start))).location,/socialError=failed/);
 // A matching email cannot attach a provider identity to an existing password account.
 db.prepare("INSERT INTO social_login_flows(state,provider,payload,expires_at) VALUES(?,?,?,?)").run('a'.repeat(64),'google',JSON.stringify({kind:'onboard',subject:'unlinked',name:'Existing member',email:'member1@example.invalid'}),Date.now()+600000);
 assert.equal((await req('/api/auth/social/complete',{ageConfirmed:true,standardsAccepted:true},'gc_social_pending='+'a'.repeat(64))).status,409);assert.equal(db.prepare("SELECT COUNT(*) n FROM social_identities WHERE subject='unlinked'").get().n,0);
 assert.equal((await req('/api/admin/social-signin/google',credentials,admin,'POST',{Origin:'https://evil.example'})).status,403);
 const fb={clientId:'test-fb-app',clientSecret:'test-fb-secret',enabled:true};assert.equal((await req('/api/admin/social-signin/facebook',fb,admin)).status,200);
 let facebookAppId=fb.clientId;
 globalThis.fetch=async(url,init)=>{url=String(url);if(url.endsWith('/oauth/access_token')){assert.equal(init.body.get('client_secret'),fb.clientSecret);return Response.json({access_token:'test-fb-token'});}if(url.includes('/debug_token?'))return Response.json({data:{is_valid:true,app_id:facebookAppId,user_id:'fb-member',expires_at:Date.now()/1000+1000}});if(url.includes('/me?')){assert.match(url,/appsecret_proof=[a-f0-9]{64}/);return Response.json({id:'fb-member',name:'Member One',email:'member1@example.invalid'});}throw Error('Unexpected provider request');};
 const wrongApp=await req('/api/auth/social/facebook/start',{link:true},member),wrongState=new URL(wrongApp.data.url).searchParams.get('state');facebookAppId='wrong-app';
 assert.match((await req('/api/auth/social/facebook/callback?state='+wrongState+'&code=valid',null,member+'; '+cookies(wrongApp))).location,/socialError=failed/);assert.equal(db.prepare("SELECT COUNT(*) n FROM social_identities WHERE provider='facebook'").get().n,0);
 facebookAppId=fb.clientId;const fbStart=await req('/api/auth/social/facebook/start',{link:true},member),fbState=new URL(fbStart.data.url).searchParams.get('state');
 assert.equal((await req('/api/auth/social/facebook/callback?state='+fbState+'&code=valid',null,member+'; '+cookies(fbStart))).location,'https://community.example/account.html?socialConnected=facebook');assert.equal(db.prepare("SELECT user_id FROM social_identities WHERE provider='facebook'").get().user_id,1);
 db.prepare("UPDATE users SET status='restricted' WHERE user_id=1").run();
 const fbLogin=await req('/api/auth/social/facebook/start',{}),fbLoginState=new URL(fbLogin.data.url).searchParams.get('state'),restrictedLogin=await req('/api/auth/social/facebook/callback?state='+fbLoginState+'&code=valid',null,cookies(fbLogin));
 assert.equal(restrictedLogin.location,'https://community.example/safety.html');assert.equal((await req('/api/me',null,cookies(restrictedLogin))).data.user.status,'restricted');
 const expiredStart=await req('/api/auth/social/facebook/start',{}),expiredState=new URL(expiredStart.data.url).searchParams.get('state');db.prepare('UPDATE social_login_flows SET expires_at=0 WHERE state=?').run(expiredState);assert.match((await req('/api/auth/social/facebook/callback?state='+expiredState+'&code=valid',null,cookies(expiredStart))).location,/socialError=failed/);
 const input={title:'Faith conference',body:'Join believers for Scripture and prayer.',sponsor:'Test ministry',linkUrl:'https://example.org/program',buttonLabel:'View programme',placement:'feed',status:'draft',priority:5};
 assert.equal((await req('/api/admin/adverts',input,member)).status,403);assert.equal((await req('/api/admin/adverts',{...input,linkUrl:'javascript:alert(1)'},admin)).status,400);
 assert.equal((await req('/api/admin/adverts',{...input,startsAt:'2030-01-02',endsAt:'2030-01-01'},admin)).status,400);
 const draft=await req('/api/admin/adverts',input,admin);assert.equal(draft.status,201);assert.equal((await req('/api/adverts')).data.items.length,0);
 assert.equal((await req('/api/admin/adverts/'+draft.data.advertId,{...input,status:'published'},admin,'PATCH')).status,200);assert.equal((await req('/api/adverts')).data.items.length,1);
 const future=await req('/api/admin/adverts',{...input,status:'published',startsAt:new Date(Date.now()+86400000).toISOString()},admin);assert.equal(future.status,201);assert.equal((await req('/api/adverts')).data.items.length,1);
 const expired=await req('/api/admin/adverts',{...input,status:'published',endsAt:new Date(Date.now()-1000).toISOString()},admin);assert.equal(expired.status,201);assert.equal((await req('/api/adverts')).data.items.length,1);
 assert.equal((await req('/api/admin/adverts/'+draft.data.advertId,{...input,status:'paused'},admin,'PATCH')).status,200);assert.equal((await req('/api/adverts')).data.items.length,0);
 for(let i=0;i<51;i++)assert.equal((await req('/api/admin/adverts',{...input,title:'Draft '+i},admin)).status,201);
 const first=(await req('/api/admin/adverts',null,admin)).data;assert.equal(first.items.length,50);assert.ok(first.nextBefore);assert.equal((await req('/api/admin/adverts?before='+first.nextBefore,null,admin)).data.items.length,4);
 const audit=db.prepare("SELECT target_id FROM safety_audit WHERE action='advert_create' ORDER BY audit_id LIMIT 1").get();assert.equal(audit.target_id,draft.data.advertId);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6P1EAAAAASUVORK5CYII=','base64');
 async function uploadImage(cookie,bytes=png,type='image/png'){return worker.fetch(new Request('https://community.example/api/admin/adverts/images',{method:'POST',headers:{Cookie:cookie,'Content-Type':type},body:bytes}),env);}
 assert.equal((await uploadImage(member)).status,403);assert.equal((await uploadImage(admin,Buffer.from('<svg></svg>'),'image/svg+xml')).status,400);assert.equal((await uploadImage(admin,Buffer.from('wrong file signature'))).status,400);assert.equal((await uploadImage(admin,Buffer.alloc(2*1024*1024+1))).status,413);
 const imageUpload=await uploadImage(admin);assert.equal(imageUpload.status,201);const imageUrl=(await imageUpload.json()).imageUrl;
 assert.equal((await req('/api/admin/adverts',{...input,imageUrl:'https://tracker.example/image.png'},admin)).status,400);
 assert.equal((await req(imageUrl)).status,404);const pictured=await req('/api/admin/adverts',{...input,imageUrl,status:'published'},admin);assert.equal(pictured.status,201);
 const imageResponse=await worker.fetch(new Request('https://community.example'+imageUrl),env);assert.equal(imageResponse.status,200);assert.equal(imageResponse.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await imageResponse.arrayBuffer()),png);
 await req('/api/admin/adverts/'+pictured.data.advertId,{...input,imageUrl,status:'paused'},admin,'PATCH');assert.equal((await req(imageUrl)).status,404);

 db.prepare("UPDATE users SET status='restricted' WHERE user_id=2").run();assert.equal((await req('/api/admin/adverts',input,admin)).status,403);
 }finally{globalThis.fetch=realFetch;db.close();rmSync(dir,{recursive:true,force:true});}
});
