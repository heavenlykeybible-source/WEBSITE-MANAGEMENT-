import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {saveDraft,publishDraft,restoreDraft} from '../src/cms-storage.ts';
import {ownerLogin,ownerSession,setOwnerPassword} from '../src/owner-auth.ts';
import {publicRoute} from '../../cms-public/worker.mjs';
function database(){
 const raw=new DatabaseSync(':memory:');for(const name of ['0001_cms.sql','0002_publications.sql','0003_owner_signin.sql'])raw.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
 const db={prepare(sql){let values=[];const statement={bind(...v){values=v;return statement},async first(){return raw.prepare(sql).get(...values)||null},async all(){return {results:raw.prepare(sql).all(...values)}},async run(){const r=raw.prepare(sql).run(...values);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}};return statement},async batch(statements){raw.exec('BEGIN');try{const results=[];for(const s of statements){try{results.push(await s.all())}catch(e){if(!String(e).includes('does not return data'))throw e;results.push(await s.run())}const n=raw.prepare('SELECT changes() AS n').get().n;results.at(-1).meta={changes:n}}raw.exec('COMMIT');return results}catch(e){raw.exec('ROLLBACK');throw e}},raw};return db;
}
const location={site:'account1',kind:'page',key:'home'};
const document=value=>({schema:1,fields:[{key:'t_1234567',type:'text',value}]});
test('drafts stay private, publication uses current revision, stale save creates no history, restoration remains private',async()=>{
 const db=database(),env={DB:db};await saveDraft(db,location,document('First'),0,'owner');
 const request=()=>new Request('https://public.test/v1/content?site=account1&page=home');
 assert.equal((await (await publicRoute(request(),env)).json()).content,null);
 await publishDraft(db,location,1,'owner');assert.equal((await (await publicRoute(request(),env)).json()).content.fields[0].value,'First');
 await saveDraft(db,location,document('Second'),1,'owner');
 await assert.rejects(saveDraft(db,location,document('Stale'),1,'other'),e=>e.status===409);
 assert.equal(db.raw.prepare('SELECT count(*) n FROM cms_revisions').get().n,2);
 await assert.rejects(publishDraft(db,location,1,'owner'),e=>e.status===409);
 await restoreDraft(db,location,1,2,'owner');assert.equal(db.raw.prepare('SELECT version FROM cms_entries').get().version,3);
 assert.equal((await (await publicRoute(request(),env)).json()).content.version,1);
});
test('owner password is hashed, wrong passwords fail, session token is hashed, password reset invalidates it',async()=>{
 const db=database();await setOwnerPassword(db,'a-strong-owner-password-2026','owner@example.com');
 const req=new Request('https://owner.test/api/owner/login',{headers:{'CF-Connecting-IP':'127.0.0.1'}});
 assert.equal((await ownerLogin(req,db,'wrong')).status,401);
 const result=await ownerLogin(req,db,'a-strong-owner-password-2026');assert.equal(result.ok,true);assert.match(result.cookie,/Secure; HttpOnly; SameSite=Strict/);
 const signed=new Request('https://owner.test/',{headers:{Cookie:result.cookie.split(';')[0]}});assert.equal(await ownerSession(signed,db),'owner@example.com');
 assert.notEqual(db.raw.prepare('SELECT password_hash FROM cms_owner_password').get().password_hash,'a-strong-owner-password-2026');
 assert.notEqual(db.raw.prepare('SELECT session_hash FROM cms_owner_sessions').get().session_hash,result.cookie.split(';')[0].split('=')[1]);
 await setOwnerPassword(db,'another-strong-owner-password','owner@example.com');assert.equal(await ownerSession(signed,db),null);
});
test('public Gemini AI returns actual inference and enforces origin and request limits',async()=>{
 const db=database();let calls=0;const env={DB:db,GEMINI_API_KEY:'test-key-not-a-real-secret'};
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/v1beta/models/'));
  assert.equal(options.headers['x-goog-api-key'],env.GEMINI_API_KEY);
  const payload=JSON.parse(options.body);
  const policy=payload.systemInstruction.parts[0].text;
  assert.match(policy,/Heavenly Key Evangelistic Movement/);
  assert.match(policy,/Authorized King James Version/);
  assert.match(policy,/Restitution & Holy Living/);
  assert.match(policy,/https:\/\/global\.heavenlykey\.org\//);
  assert.match(policy,/https:\/\/heavenlykey\.org\/pages\/radio\.html/);
  assert.match(policy,/https:\/\/heavenlykey\.org\/pages\/partner\.html/);
  assert.match(policy,/https:\/\/www\.facebook\.com\/heavenlykey/);
  assert.doesNotMatch(policy,/UNTRUSTED_OVERRIDE_USE_NIV/);
  calls++;
  return Response.json({candidates:[{content:{parts:[{text:'Study John 3:16 in the Bible portal.'}]}}]});
 };
 try{
  const req=(origin='https://heavenlykey.org')=>new Request('https://public.test/v1/assistant',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'127.0.0.2'},body:JSON.stringify({message:'Help me study John 3:16',context:'UNTRUSTED_OVERRIDE_USE_NIV'+'x'.repeat(18000)})});
  assert.equal((await publicRoute(req('https://other.test'),env)).status,403);
  for(let i=0;i<30;i++){
   const response=await publicRoute(req(),env);
   assert.equal(response.status,200);
   assert.match((await response.json()).response,/John 3:16/);
  }
  assert.equal((await publicRoute(req(),env)).status,429);
  assert.equal(calls,30);
  assert.equal((await publicRoute(new Request('https://public.test/api/publish',{method:'POST'}),env)).status,404);
 }finally{globalThis.fetch=originalFetch}
});
