import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('..',import.meta.url));
test('Easy posting: real Worker and SQLite round-trip, ownership and moderation',async()=>{
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

 const input={postFormat:'design_card',title:'',body:'Faith 🙏\nHope for every nation',designCategory:null,design:{templateId:'card-192',alignment:'center',fontSize:'standard',size:'auto',decoration:'normal'}};
 const created=await req('/api/posts',input,member);assert.equal(created.status,201,JSON.stringify(created));const id=created.data.postId;
 const read=()=>req('/api/feed?postId='+id,null,member);
 let row=(await read()).data.items[0];assert.equal(row.title||null,null);assert.equal(row.design_category||null,null);assert.equal(row.body,input.body);assert.equal(JSON.parse(row.design_settings).templateId,'card-192');
 assert.equal((await req('/api/posts/'+id,{...input,body:'Updated hope',design:{...input.design,templateId:'card-1001'}},member,'PATCH')).status,200);
 row=(await read()).data.items[0];assert.equal(row.body,'Updated hope');assert.equal(JSON.parse(row.design_settings).templateId,'card-1001');
 assert.equal((await req('/api/posts/'+id,input,admin,'PATCH')).status,403);assert.equal((await req('/api/posts',input)).status,401);
 env.COMMUNITY_BLOCKED_WORDS='blockedphrase';assert.equal((await req('/api/posts',{...input,body:'A blockedphrase message'},member)).status,400);assert.equal((await req('/api/posts/'+id,{...input,body:'A blockedphrase message'},member,'PATCH')).status,400);assert.equal((await read()).data.items[0].body,'Updated hope');
 delete env.COMMUNITY_BLOCKED_WORDS;const held=await req('/api/posts',{...input,body:'You are stupid'},member);assert.equal(held.status,201);assert.equal(held.data.status,'held');assert.equal((await req('/api/feed?postId='+held.data.postId)).data.items.length,0);
 assert.equal((await req('/api/posts',{...input,body:'x'.repeat(10001)},member)).status,400);
 }finally{globalThis.fetch=realFetch;db.close();rmSync(dir,{recursive:true,force:true});}
});
