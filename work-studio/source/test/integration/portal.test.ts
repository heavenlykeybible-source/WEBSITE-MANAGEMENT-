import { createRequire } from 'node:module';
import { createHmac } from 'node:crypto';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import core from '../../src/index';
import engine from '../../media-engine/src/index';
import { encryptField } from '../../src/services/encryption-service';
import { runDueJobs, executeJob } from '../../src/services/social-management-service';

function database(folder:string){
 const db=new DatabaseSync(':memory:');
 for(const file of readdirSync(folder).filter(f=>/^\d{4}_.+\.sql$/.test(f)).sort())db.exec(readFileSync(folder+'/'+file,'utf8'));
 return {db,prepare(sql:string){let args:any[]=[];return {bind(...values:any[]){args=values;return this;},async first(){return db.prepare(sql).get(...args)??null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}}},async batch(statements:any[]){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
}
function kv(){const m=new Map<string,string>();return {async get(k:string){return m.get(k)??null;},async put(k:string,v:string){m.set(k,v);},async delete(k:string){m.delete(k);}};}
function bucket(){const m=new Map<string,Uint8Array>(),uploads=new Map<string,{key:string,parts:Map<number,Uint8Array>}>();return {async createMultipartUpload(key:string){const uploadId=crypto.randomUUID();uploads.set(uploadId,{key,parts:new Map()});return {uploadId};},resumeMultipartUpload(key:string,id:string){const u=uploads.get(id);return {async uploadPart(n:number,b:Uint8Array){if(!u)throw Error('No upload');u.parts.set(n,b);return {partNumber:n,etag:'part-'+n};},async complete(parts:any[]){if(!u)throw Error('No upload');const total=parts.reduce((sum,p)=>sum+u.parts.get(p.partNumber)!.length,0),bytes=new Uint8Array(total);let offset=0;for(const p of parts){const b=u.parts.get(p.partNumber)!;bytes.set(b,offset);offset+=b.length;}m.set(key,bytes);uploads.delete(id);},async abort(){uploads.delete(id);}};},async delete(k:string){m.delete(k);},async put(k:string,b:Uint8Array){m.set(k,b);},async head(k:string){const b=m.get(k);return b?{size:b.length,httpEtag:'"test"'}:null;},async get(k:string,options:any){const b=m.get(k);if(!b)return null;const range=options?.range?.get('Range');let offset=0,length=b.length;if(range){const r=/bytes=(\d+)-(\d*)/.exec(range)!;offset=Number(r[1]);length=(r[2]?Number(r[2]):b.length-1)-offset+1;}return {body:b.slice(offset,offset+length),size:b.length,httpEtag:'"test"',range:range?{offset,length}:undefined};}};}

let env:any,mediaEnv:any;
beforeEach(()=>{
 env={DB:database('migrations'),SESSIONS_KV:kv(),RATE_LIMIT_KV:kv(),PASSWORD_PEPPER:'integration-test-pepper',MEDIA_ENGINE_URL:'https://media.test',MEDIA_ENGINE_SHARED_SECRET:'integration-test-shared-key'};
 mediaEnv={LIVE_STATUS_KV:kv(),DB:database('media-engine/migrations'),MEDIA_R2:bucket(),MEDIA_ENGINE_SHARED_SECRET:env.MEDIA_ENGINE_SHARED_SECRET};
 vi.stubGlobal('fetch',async(url:string,init:any)=>engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv));
});
afterEach(()=>{env.DB.db.close();mediaEnv.DB.db.close();vi.unstubAllGlobals();});
async function request(path:string,method='GET',body?:unknown,cookie?:string,headers:Record<string,string>={}){
 const init:any={method,headers:{...headers,'CF-Connecting-IP':'127.0.0.1'}};if(cookie)init.headers.Cookie=cookie;
 if(body!==undefined){if(body instanceof Uint8Array)init.body=body;else{init.body=JSON.stringify(body);init.headers['Content-Type']='application/json';}}
 return core.fetch(new Request('https://website.test'+path,init),env);
}
async function login(role='Member'){
 const email=role.replace(/\s/g,'')+'@example.test';
 const r=await request('/api/auth/register','POST',{name:'Test Member',email,password:'Testing12345',country:'Nigeria'});expect(r.status).toBe(201);const userId=(await r.json() as any).userId;
 if(role!=='Member')env.DB.db.prepare('UPDATE users SET role_id=(SELECT role_id FROM roles WHERE role_name=?) WHERE user_id=?').run(role,userId);
 const response=await request('/api/auth/login','POST',{email,password:'Testing12345'});expect(response.status).toBe(200);return response.headers.get('Set-Cookie')!.split(';')[0];
}
async function upload(cookie:string,publish=false){
 const registered=await request('/api/admin/media-engine/media','POST',{object_key:'test.mp3',media_type:'audio',mime_type:'audio/mpeg',size_bytes:5,keep_media:true},cookie);expect(registered.status).toBe(201);const id=(await registered.json() as any).media_id;
 const response=await request(`/api/admin/media-engine/media/${id}/upload`,'PUT',new Uint8Array([1,2,3,4,5]),cookie,{'Content-Type':'audio/mpeg'});expect(response.status).toBe(200);
 if(publish)expect((await request(`/api/admin/media-engine/media/${id}/publish`,'POST',{published:true},cookie)).status).toBe(200);
 return id;
}
describe('community and studio integration against the real SQL migrations',()=>{
 it('resumes multipart uploads, verifies every part and preserves private access',async()=>{
  const cookie=await login('Administrator'),other=await login('Deputy Super Administrator'),chunk=8*1024*1024;
  const registered=await request('/api/admin/media-engine/media','POST',{object_key:'large.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:chunk+3,keep_media:true},cookie);expect(registered.status).toBe(201);const id=(await registered.json() as any).media_id,path='/api/admin/media-engine/media/'+id+'/multipart';
  expect((await request(path,'POST',{},cookie)).status).toBe(201);
  expect((await request(path+'/status','GET',undefined,other)).status).toBe(403);
  expect((await request(path+'/complete','POST',{},cookie)).status).toBe(409);
  expect((await request(path+'/part/1','PUT',new Uint8Array(2),cookie)).status).toBe(400);
  expect((await request(path+'/part/1','PUT',new Uint8Array(chunk),cookie)).status).toBe(200);
  const resumed=await (await request(path+'/status','GET',undefined,cookie)).json() as any;expect(resumed.parts).toHaveLength(1);expect(resumed.parts[0].size_bytes).toBe(chunk);
  expect((await request(path,'POST',{},cookie)).status).toBe(200);
  expect((await request(path+'/part/2','PUT',new Uint8Array([1,2,3]),cookie)).status).toBe(200);
  expect((await request(path+'/complete','POST',{},cookie)).status).toBe(200);
  expect((await request('/api/broadcast/media/'+id+'/object')).status).toBe(404);
  expect((await request('/api/admin/media-engine/media/'+id+'/preview','HEAD',undefined,cookie)).headers.get('Content-Length')).toBe(String(chunk+3));
 });
 it('keeps radio audio-only for low data use and rejects out-of-bounds byte ranges',async()=>{const cookie=await login('Administrator');const registered=await request('/api/admin/media-engine/media','POST',{object_key:'sound.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:3,keep_media:true},cookie);const id=(await registered.json() as any).media_id;await request('/api/admin/media-engine/media/'+id+'/upload','PUT',new Uint8Array([1,2,3]),cookie,{'Content-Type':'video/mp4'});await request('/api/admin/media-engine/media/'+id+'/publish','POST',{published:true},cookie);const programme=await (await request('/api/broadcast/programme?channel=radio')).json() as any;expect(programme.mode).toBe('offline');expect(programme.items).toEqual([]);expect((await request('/api/admin/media-engine/playlist-order','POST',{channel:'radio',media_ids:[id]},cookie)).status).toBe(400);const range=await request('/api/broadcast/media/'+id+'/object','GET',undefined,undefined,{Range:'bytes=20-30'});expect(range.status).toBe(416);expect(range.headers.get('Content-Range')).toBe('bytes */3');});
 it('accepts a 2 GB registration and rejects larger files',async()=>{const cookie=await login('Administrator');for(const [size,status]of [[2*1024*1024*1024,201],[2*1024*1024*1024+1,400]]){const r=await request('/api/admin/media-engine/media','POST',{object_key:'size-'+size+'.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:size,keep_media:true},cookie);expect(r.status).toBe(status);}});
 it('rejects webpage URLs and falls back from old invalid live sources to the 24/7 playlist',async()=>{const cookie=await login('Administrator');await upload(cookie,true);const invalid=await request('/api/broadcast/live-status','POST',{isLive:true,title:'Page URL',sourceType:'camera',sourceRefId:'https://heavenlykey.alldaywow247.workers.dev/pages/radio'},cookie);expect(invalid.status).toBe(400);mediaEnv.DB.db.prepare("INSERT INTO live_sessions(title,status,source_type,source_ref,last_heartbeat_at,destination,created_by) VALUES('Old page URL','live','camera','https://heavenlykey.alldaywow247.workers.dev/pages/radio',CURRENT_TIMESTAMP,'both','1')").run();const programme=await (await request('/api/broadcast/programme?channel=radio')).json() as any;expect(programme.mode).toBe('playlist');expect(programme.items[0].url).toContain('/api/broadcast/media/');});
 it('verifies and encrypts a streaming connection without exposing credentials',async()=>{
  const cookie=await login('Super Administrator');let probe:any;
  vi.stubGlobal('fetch',async(url:string,init:any)=>{if(String(url).startsWith('https://project.livekit.cloud/')){if(init.redirect==='error')throw new TypeError('Invalid redirect value, must be follow or manual');probe=init;return Response.json({rooms:[]});}return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);});
  const body={url:'wss://project.livekit.cloud',apiKey:'project-key',apiSecret:'private-provider-secret'};
  const response=await request('/api/admin/media-engine/livekit/connection','POST',body,cookie);expect(response.status).toBe(200);
  expect(JSON.parse(atob(probe.headers.Authorization.split(' ')[1].split('.')[1])).video).toEqual({roomList:true});
  const providerToken=probe.headers.Authorization.split(' ')[1];expect(providerToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);const [head,payload,signature]=providerToken.split('.');expect(signature).toBe(createHmac('sha256',body.apiSecret).update(head+'.'+payload).digest('base64url'));
  const stored=await mediaEnv.LIVE_STATUS_KV.get('livekit-connection-v1');expect(stored).not.toContain(body.apiSecret);expect(stored).not.toContain(body.apiKey);
  const state=await (await request('/api/admin/media-engine/livekit/connection','GET',undefined,cookie)).json() as any;expect(state.configured).toBe(true);expect(JSON.stringify(state)).not.toContain(body.apiSecret);expect(state.apiKey).toBeUndefined();
  expect((await request('/api/admin/media-engine/livekit/connection','POST',{action:'check'},cookie)).status).toBe(200);
  const r=await request('/api/broadcast/live-status','POST',{isLive:true,title:'Verified camera',sourceType:'camera',sourceRefId:'livekit:pending'},cookie);expect(r.status).toBe(201);const id=(await r.json() as any).session_id;
  const token=await (await request('/api/admin/media-engine/livekit/publisher-token','POST',{session_id:id},cookie)).json() as any;expect(token.url).toBe(body.url);expect(JSON.parse(atob(token.token.split('.')[1])).iss).toBe(body.apiKey);
 });
 it('rejects unauthorized or unverifiable streaming configuration without saving it',async()=>{
  const admin=await login('Administrator'),owner=await login('Super Administrator');
  const body={url:'wss://project.livekit.cloud',apiKey:'project-key',apiSecret:'private-provider-secret'};
  expect((await request('/api/admin/media-engine/livekit/connection','POST',body)).status).toBe(403);
  expect((await request('/api/admin/media-engine/livekit/connection','POST',body,admin)).status).toBe(403);
  let probes=0;vi.stubGlobal('fetch',async(url:string,init:any)=>{if(String(url).startsWith('https://project.livekit.cloud/')){probes++;return Response.json({error:'denied'}, {status:401});}return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);});
  expect((await request('/api/admin/media-engine/livekit/connection','POST',{...body,url:'https://127.0.0.1'},owner)).status).toBe(400);expect(probes).toBe(0);
  const denied=await request('/api/admin/media-engine/livekit/connection','POST',body,owner);expect(denied.status).toBe(400);expect((await denied.json() as any).code).toBe('credentials_rejected');expect(await mediaEnv.LIVE_STATUS_KV.get('livekit-connection-v1')).toBeNull();
 });

 it('reports invalid project names and provider reachability without returning secrets',async()=>{
  const owner=await login('Super Administrator');const body={url:'Heavenly Key',apiKey:'project-key',apiSecret:'private-provider-secret'};
  const invalid=await request('/api/admin/media-engine/livekit/connection','POST',body,owner);expect(invalid.status).toBe(400);expect((await invalid.json() as any).code).toBe('invalid_project_url');
  vi.stubGlobal('fetch',async(url:string,init:any)=>{if(String(url).startsWith('https://project.livekit.cloud/'))throw new Error('Network details must remain private');return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);});
  const unreachable=await request('/api/admin/media-engine/livekit/connection','POST',{...body,url:'wss://project.livekit.cloud'},owner);expect(unreachable.status).toBe(503);const result=await unreachable.json() as any;expect(result.code).toBe('provider_unreachable');expect(JSON.stringify(result)).not.toContain(body.apiSecret);expect(JSON.stringify(result)).not.toContain('Network details');
 });

 it('rejects provider redirects without forwarding streaming credentials',async()=>{
  const owner=await login('Super Administrator');let calls=0;
  vi.stubGlobal('fetch',async(url:string,init:any)=>{if(String(url).startsWith('https://project.livekit.cloud/')){calls++;expect(init.redirect).toBe('manual');return new Response(null,{status:302,headers:{Location:'https://elsewhere.example/'}});}return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);});
  const response=await request('/api/admin/media-engine/livekit/connection','POST',{url:'wss://project.livekit.cloud',apiKey:'project-key',apiSecret:'private-provider-secret'},owner);expect(response.status).toBe(400);expect((await response.json() as any).code).toBe('provider_redirect');expect(calls).toBe(1);expect(await mediaEnv.LIVE_STATUS_KV.get('livekit-connection-v1')).toBeNull();
 });

 it('stores sanitized studio presets privately for each administrator',async()=>{
  const admin=await login('Administrator'),deputy=await login('Deputy Super Administrator');const preferences={title:'Ministry programme',format:'portrait-720',scene:'starting',micGain:100,showBrand:true,scripture:'Psalm 27:4',secret:'must not be stored',__proto__:{injected:true}};
  expect((await request('/api/admin/media-engine/studio/preferences','POST',{preferences},admin)).status).toBe(200);
  const saved=await (await request('/api/admin/media-engine/studio/preferences','GET',undefined,admin)).json() as any;expect(saved.preferences).toEqual({title:'Ministry programme',format:'portrait-720',scene:'starting',micGain:100,showBrand:true,scripture:'Psalm 27:4'});
  expect((await (await request('/api/admin/media-engine/studio/preferences','GET',undefined,deputy)).json() as any).preferences).toBeNull();
  expect((await request('/api/admin/media-engine/studio/preferences')).status).toBe(403);
  expect((await request('/api/admin/media-engine/studio/preferences','POST',{preferences:{micGain:900}},admin)).status).toBe(400);
  expect((await request('/api/admin/media-engine/studio/preferences','POST',{preferences:{scripture:'x'.repeat(9000)}},admin)).status).toBe(400);
 });

 it('gates camera startup on real transport configuration',async()=>{
  const cookie=await login('Administrator');
  expect((await request('/api/broadcast/live-status','POST',{isLive:true,title:'Camera',sourceType:'camera',sourceRefId:'livekit:pending'},cookie)).status).toBe(503);
  expect(mediaEnv.DB.db.prepare('SELECT COUNT(*) AS n FROM live_sessions').get().n).toBe(0);
 });
 it('issues publisher and viewer tokens with separate permissions and ends viewer access with the session',async()=>{
  mediaEnv.LIVEKIT_URL='wss://test.livekit.cloud';mediaEnv.LIVEKIT_API_KEY='test-key';mediaEnv.LIVEKIT_API_SECRET='test-secret';
  const cookie=await login('Administrator');const r=await request('/api/broadcast/live-status','POST',{isLive:true,title:'Camera',sourceType:'camera',sourceRefId:'livekit:pending',destination:'both'},cookie);expect(r.status).toBe(201);const id=(await r.json() as any).session_id;
  const publicState=await (await request('/api/broadcast/live-status')).json() as any;
  expect(publicState.live.session_id).toBe(id);
  expect(publicState.live.source_ref).toBeUndefined();
  const ownerState=await (await request('/api/broadcast/live-status','GET',undefined,cookie)).json() as any;
  expect(ownerState.live.source_ref).toContain('livekit:');
  const path='/api/admin/media-engine/livekit/publisher-token';expect((await request(path,'POST',{session_id:id})).status).toBe(403);
  const pub=await request(path,'POST',{session_id:id},cookie);expect(pub.status).toBe(200);const p=await pub.json() as any;
  expect(JSON.parse(atob(p.token.split('.')[1])).video.canPublish).toBe(true);
  const unrestricted=await request('/api/admin/media-engine/livekit/token','POST',{room:'unrelated-room',identity:'unrestricted-publisher',publish:true},cookie);
  // Account 1 does not expose this generic route at all.
  expect(unrestricted.status).toBe(404);
  // Even if called directly with a signed internal capability, Account 2
  // must reject arbitrary publishing rooms.
  const now=Math.floor(Date.now()/1000),grant={sub:'1',role:'Administrator',iat:now,exp:now+60,nonce:'publisher-audit'};
  const encoded=btoa(JSON.stringify(grant));
  const signature=createHmac('sha256',mediaEnv.MEDIA_ENGINE_SHARED_SECRET).update(encoded).digest('hex');
  const direct=await engine.fetch(new Request('https://media.test/api/media-engine/livekit/token',{
   method:'POST',headers:{'X-Heavenly-Key-Internal':'media-engine-v1',Authorization:'Bearer '+encoded+'.'+signature,'Content-Type':'application/json'},
   body:JSON.stringify({room:'unrelated-room',identity:'unrestricted-publisher',publish:true})
  }),mediaEnv);
  expect(direct.status).toBe(403);
  const viewer=await request('/api/broadcast/livekit/viewer-token','POST',{});expect(viewer.status).toBe(200);const v=await viewer.json() as any;
  expect(JSON.parse(atob(v.token.split('.')[1])).video).toMatchObject({canPublish:false,canPublishData:false,room:'heavenlykey-live-'+id});
  for(const channel of ['radio','video'])expect((await (await request('/api/broadcast/programme?channel='+channel)).json() as any).transport).toBe('livekit');
  await request('/api/broadcast/live-session/'+id+'/stop','POST',{},cookie);expect((await request('/api/broadcast/livekit/viewer-token','POST',{})).status).toBe(404);
 });

 it('opens the main broadcast dashboard from the Account 2 public address',async()=>{const r=await engine.fetch(new Request('https://media.test/'),mediaEnv);expect(r.status).toBe(302);expect(r.headers.get('Location')).toBe('https://heavenlykey.alldaywow247.workers.dev/pages/admin#studio');});

 it('requires approved group membership for poll votes and hides archived poll results',async()=>{
  const admin=await login('Administrator'),member=await login();
  const group=await request('/api/groups','POST',{name:'Private poll group',description:'Prayer',purposeStatement:'Christian fellowship and prayer',type:'prayer',visibility:'private'},admin);const gid=(await group.json() as any).groupId;
  const poll=await request('/api/groups/'+gid+'/polls','POST',{question:'Prayer meeting time?',options:['Morning','Evening']},admin);expect(poll.status).toBe(201);const pid=(await poll.json() as any).pollId;
  const option=env.DB.db.prepare('SELECT option_id FROM poll_options WHERE poll_id=? LIMIT 1').get(pid) as any;
  expect((await request('/api/polls/'+pid+'/vote','POST',{optionId:option.option_id},member)).status).toBe(400);
  expect((await request('/api/polls/'+pid+'/vote','POST',{optionId:option.option_id},admin)).status).toBe(200);
  await request('/api/admin/groups/'+gid,'POST',{action:'status',status:'archived'},admin);
  expect((await request('/api/polls/'+pid+'/results','GET',undefined,admin)).status).toBe(403);
 });

 it('blocks suspended users even when an old session cookie exists',async()=>{
  const cookie=await login();env.DB.db.prepare("UPDATE users SET status='suspended'").run();
  expect((await request('/api/auth/profile','GET',undefined,cookie)).status).toBe(401);
  expect((await request('/api/comments','POST',{contentType:'discussion',contentId:1,body:'Cannot post'},cookie)).status).toBe(401);
 });
 it('prevents guessed private content IDs from leaking comments or accepting reactions',async()=>{
  const admin=await login('Administrator'),member=await login();
  const group=await request('/api/groups','POST',{name:'Private audit group',description:'Private',purposeStatement:'Christian fellowship and prayer',type:'prayer',visibility:'private'},admin);const gid=(await group.json() as any).groupId;
  const post=await request('/api/groups/'+gid+'/posts','POST',{body:'Private group conversation',postType:'discussion',anonymous:false},admin);const pid=(await post.json() as any).postId;
  expect((await request('/api/comments','POST',{contentType:'group_post',contentId:pid,body:'Private reply'},admin)).status).toBe(201);
  for(const cookie of [undefined,member])expect((await (await request('/api/comments?contentType=group_post&contentId='+pid,'GET',undefined,cookie)).json() as any).items).toHaveLength(0);
  expect((await request('/api/reactions','POST',{contentType:'group_post',contentId:pid,reactionType:'like'},member)).status).toBe(400);
  expect((await (await request('/api/comments?contentType=group_post&contentId='+pid,'GET',undefined,admin)).json() as any).items).toHaveLength(1);
  const category=env.DB.db.prepare("SELECT category_id FROM categories WHERE module='prayer' LIMIT 1").get() as any;
  const prayer=await request('/api/prayer','POST',{title:'Private request',requestText:'For ministry care',visibility:'ministry_only',categoryId:category.category_id},admin);const id=(await prayer.json() as any).prayerId;
  expect((await request('/api/prayer/'+id+'/respond','POST',{responseType:'praying'},member)).status).toBe(400);
  expect((await request('/api/comments','POST',{contentType:'prayer_request',contentId:id,body:'Uninvited'},member)).status).toBe(400);
 });
 it('rejects replies to locked or hidden discussions and invalid parent IDs',async()=>{
  const cookie=await login();const cat=env.DB.db.prepare("SELECT category_id FROM categories WHERE module='discussion' LIMIT 1").get() as any;
  const r=await request('/api/discussions','POST',{title:'Discussion',body:'A real discussion',categoryId:cat.category_id},cookie);const id=(await r.json() as any).discussionId;
  env.DB.db.prepare('UPDATE discussions SET locked=1 WHERE discussion_id=?').run(id);
  expect((await request('/api/comments','POST',{contentType:'discussion',contentId:id,body:'Locked reply'},cookie)).status).toBe(400);
  env.DB.db.prepare("UPDATE discussions SET status='hidden' WHERE discussion_id=?").run(id);
  expect((await (await request('/api/comments?contentType=discussion&contentId='+id)).json() as any).items).toHaveLength(0);
  expect((await request('/api/reactions','POST',{contentType:'discussion',contentId:9999,reactionType:'like'},cookie)).status).toBe(400);
 });
 it('rejects malformed JSON without crashing a Worker',async()=>{
  for(const path of ['/api/auth/login','/api/discussions','/api/comments','/api/admin/media-engine/campaigns']){
   const r=await core.fetch(new Request('https://website.test'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'}),env);expect(r.status).toBe(400);
  }
 });
 it('cleans expired recordings and retains explicitly kept files',async()=>{
  await mediaEnv.MEDIA_R2.put('expired.mp4',new Uint8Array([1]));await mediaEnv.MEDIA_R2.put('kept.mp4',new Uint8Array([2]));
  for(const [key,keep]of [['expired.mp4',0],['kept.mp4',1]])mediaEnv.DB.db.prepare("INSERT INTO recordings(object_key,title,keep_recording,retention_until,created_by) VALUES(?,?,?,'2000-01-01','audit')").run(key,key,keep);
  await engine.scheduled({} as any,mediaEnv);
  expect(await mediaEnv.MEDIA_R2.head('expired.mp4')).toBeNull();expect(await mediaEnv.MEDIA_R2.head('kept.mp4')).not.toBeNull();
  expect(mediaEnv.DB.db.prepare("SELECT status FROM recordings WHERE object_key='expired.mp4'").get().status).toBe('deleted');
 });
 it('runs the public resource APIs against the full real database schema',async()=>{
  for(const path of ['/api/events','/api/homepage-updates','/api/stats/lives-transformed','/api/bible/verse-of-day','/api/bible/memory-verse','/api/devotionals','/api/devotionals/today','/api/kingdom-keys/current','/api/faith-challenges/current','/api/nations','/api/nations/featured','/api/media']){
   const response=await request(path);expect(response.status,path).toBeLessThan(500);expect(response.headers.get('Content-Type'),path).toContain('application/json');await response.json();
  }
 });

 it('previews unpublished media only through the authenticated dashboard',async()=>{
  const admin=await login('Administrator');const id=await upload(admin);const path='/api/admin/media-engine/media/'+id+'/preview';
  expect((await request(path)).status).toBe(403);expect((await request('/api/broadcast/media/'+id+'/object')).status).toBe(404);
  expect((await request(path,'GET',undefined,admin)).status).toBe(200);
  const range=await request(path,'GET',undefined,admin,{Range:'bytes=1-3'});expect(range.status).toBe(206);expect(new Uint8Array(await range.arrayBuffer())).toEqual(new Uint8Array([2,3,4]));
 });

 it('keeps the unified media dashboard private and reports current capabilities honestly',async()=>{
  const paths=['capabilities','social-accounts','campaigns','distribution-jobs'];
  const member=await login();for(const path of paths){expect((await request('/api/admin/media-engine/'+path)).status).toBe(403);expect((await request('/api/admin/media-engine/'+path,'GET',undefined,member)).status).toBe(403);}
  const admin=await login('Administrator');for(const path of paths)expect((await request('/api/admin/media-engine/'+path,'GET',undefined,admin)).status).toBe(200);
  const c=await (await request('/api/admin/media-engine/capabilities','GET',undefined,admin)).json() as any;
  expect(c.transport).toMatchObject({live_camera_ingest:false,social_publishing:true,multi_destination_rtmp:true,social_output_follows_studio_orientation:true,external_stream_url:true,prerecorded_playback:true});expect(c.camera).toMatchObject({device_selection:true,virtual_background_mode:true,moving_video_background:true,subject_protection:true});expect(c.production.resumable_uploads).toBe(true);expect(c.production.quality_profiles).toEqual(['data','balanced','high']);
 });
 it('saves and cancels social campaign plans without pretending to publish them',async()=>{
  const admin=await login('Administrator');const endpoint='/api/admin/media-engine/campaigns';
  expect((await request(endpoint,'POST',{title:'Old',scheduled_for:'2000-01-01'},admin)).status).toBe(400);
  expect((await request(endpoint,'POST',{title:'Invalid media',scheduled_for:new Date(Date.now()+3600000).toISOString(),media_id:999},admin)).status).toBe(400);
  expect((await request(endpoint,'POST',{title:'Plan',scheduled_for:new Date(Date.now()+3600000).toISOString()},admin,{Origin:'https://other.test'})).status).toBe(403);
  const result=await request(endpoint,'POST',{title:'Ministry update',scheduled_for:new Date(Date.now()+3600000).toISOString()},admin);expect(result.status).toBe(201);
  const id=(await result.json() as any).campaign_id;
  expect((await (await request(endpoint,'GET',undefined,admin)).json() as any).items[0].title).toBe('Ministry update');
  expect(mediaEnv.DB.db.prepare('SELECT COUNT(*) AS n FROM distribution_jobs').get().n).toBe(0);
  expect((await request(endpoint+'/'+id+'/cancel','POST',{},admin)).status).toBe(200);
  expect((await (await request(endpoint,'GET',undefined,admin)).json() as any).items[0].status).toBe('cancelled');
 });

 it('delivers volunteer enquiries to the encrypted owner inbox',async()=>{
  env.ENCRYPTION_KEY='ab'.repeat(32);
  const payload={name:'Volunteer',email:'volunteer@example.test',subject:'Volunteer enquiry',message:'I would like to serve with audio production.'};
  expect((await request('/api/contact','POST',payload)).status).toBe(201);
  const row=env.DB.db.prepare('SELECT payload_encrypted FROM public_site_submissions').get() as any;
  expect(row.payload_encrypted).not.toContain(payload.message);
  expect((await request('/api/admin/public-submissions')).status).toBe(403);
  const member=await login();expect((await request('/api/admin/public-submissions','GET',undefined,member)).status).toBe(403);
  const owner=await login('Super Administrator');
  const inbox=await (await request('/api/admin/public-submissions','GET',undefined,owner)).json() as any;
  expect(inbox.items[0].payload).toMatchObject(payload);expect(inbox.items[0].type).toBe('contact');
 });

 it('shares a revocable cookie session and exposes the actual server role',async()=>{const cookie=await login();const response=await request('/api/auth/profile','GET',undefined,cookie);expect((await response.json() as any).profile.roleName).toBe('Member');await request('/api/auth/logout','POST',{},cookie);expect((await request('/api/auth/profile','GET',undefined,cookie)).status).toBe(401);});
 it('prevents anonymous and ordinary members from managing Account 2',async()=>{expect((await request('/api/admin/media-engine/media')).status).toBe(403);const cookie=await login();expect((await request('/api/admin/media-engine/media','POST',{},cookie)).status).toBe(403);expect((await request('/api/admin/testimonies/pending','GET',undefined,cookie)).status).toBe(403);});
 it('keeps private prayers out of the public feed and anonymous names hidden',async()=>{const cookie=await login();const cat=env.DB.db.prepare("SELECT category_id FROM categories WHERE module='prayer' LIMIT 1").get() as any;
  for(const visibility of ['ministry_only','public'])expect((await request('/api/prayer','POST',{title:visibility,requestText:'A prayer for grace.',categoryId:cat.category_id,visibility,anonymous:true},cookie)).status).toBe(201);
  const feed=await (await request('/api/prayer')).json() as any;expect(feed.items).toHaveLength(1);expect(feed.items[0].displayName).toBeNull();expect(feed.items[0].title).toBe('public');});
 it('requires testimony approval before it reaches the public feed',async()=>{const member=await login();const cat=env.DB.db.prepare("SELECT category_id FROM categories WHERE module='testimony' LIMIT 1").get() as any;
  const response=await request('/api/testimonies','POST',{title:'Thanksgiving',story:'A testimony of answered prayer.',categoryId:cat.category_id,anonymous:false},member);expect(response.status).toBe(201);const id=(await response.json() as any).testimonyId;
  expect((await (await request('/api/testimonies')).json() as any).items).toHaveLength(0);expect((await request(`/api/testimonies/${id}/approve`,'POST',{},member)).status).toBe(403);
  const moderator=await login('Moderator');expect((await request('/api/admin/testimonies/pending','GET',undefined,moderator)).status).toBe(200);await request(`/api/testimonies/${id}/approve`,'POST',{},moderator);expect((await (await request('/api/testimonies')).json() as any).items).toHaveLength(1);});
 it('connects the studio to Account 2 without revealing credentials',async()=>{const cookie=await login('Administrator');const response=await request('/api/admin/media-engine/media','GET',undefined,cookie);expect(response.status).toBe(200);expect(await response.json()).toEqual({items:[]});});
 it('keeps uploaded files private until publication, supports byte ranges and unpublishing',async()=>{const cookie=await login('Administrator');const id=await upload(cookie);expect((await request(`/api/broadcast/media/${id}/object`)).status).toBe(404);expect((await (await request('/api/broadcast/programme?channel=radio')).json() as any).items).toHaveLength(0);
  await request(`/api/admin/media-engine/media/${id}/publish`,'POST',{published:true},cookie);const programme=await (await request('/api/broadcast/programme?channel=radio')).json() as any;expect(programme.mode).toBe('playlist');expect(programme.items[0].url).toBe(`/api/broadcast/media/${id}/object`);
  const object=await request(`/api/broadcast/media/${id}/object`,'GET',undefined,undefined,{Range:'bytes=1-3'});expect(object.status).toBe(206);expect(object.headers.get('Content-Range')).toBe('bytes 1-3/5');expect([...new Uint8Array(await object.arrayBuffer())]).toEqual([2,3,4]);
  await request(`/api/admin/media-engine/media/${id}/publish`,'POST',{published:false},cookie);expect((await request(`/api/broadcast/media/${id}/object`)).status).toBe(404);});
 it('does not publish missing or expired objects',async()=>{const cookie=await login('Administrator');const id=await upload(cookie);mediaEnv.DB.db.prepare("UPDATE media_objects SET keep_media=0,retention_until='2000-01-01T00:00:00.000Z' WHERE media_id=?").run(id);expect((await request(`/api/admin/media-engine/media/${id}/publish`,'POST',{published:true},cookie)).status).toBe(400);});
 it('selects a scheduled recording using its time window, independently of cron timing',async()=>{const cookie=await login('Administrator');const id=await upload(cookie);const response=await request('/api/broadcast/playout','POST',{mediaId:id,title:'Prayer hour',startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+60000).toISOString()},cookie);expect(response.status).toBe(201);const programme=await (await request('/api/broadcast/programme?channel=radio')).json() as any;expect(programme.mode).toBe('scheduled');expect((await request(`/api/broadcast/media/${id}/object`)).status).toBe(200);});
 it('refuses a fake camera start without a streaming source',async()=>{const cookie=await login('Administrator');expect((await request('/api/broadcast/live-status','POST',{isLive:true,title:'Live test',sourceType:'camera'},cookie)).status).toBe(400);});
 it('rejects cross-origin administration writes even with a valid session',async()=>{const cookie=await login('Administrator');expect((await request('/api/admin/media-engine/media','POST',{},cookie,{Origin:'https://other.test'})).status).toBe(403);});
 it('supports private group approval, post moderation and archival from the dashboard',async()=>{
  const admin=await login('Administrator'),member=await login();
  const created=await request('/api/groups','POST',{name:'Prayer fellowship',description:'Pray together',purposeStatement:'A fellowship for Christian prayer',type:'prayer',visibility:'private'},admin);expect(created.status).toBe(201);const id=(await created.json() as any).groupId;
  expect((await request(`/api/groups/${id}/posts`)).status).toBe(403);
  expect((await request(`/api/groups/${id}/join`,'POST',{},member)).status).toBe(200);
  expect((await request(`/api/admin/groups/${id}`,'GET',undefined,member)).status).toBe(403);
  const details=await (await request(`/api/admin/groups/${id}`,'GET',undefined,admin)).json() as any;
  expect(details.requests).toHaveLength(1);
  expect((await request(`/api/admin/groups/${id}`,'POST',{action:'join',requestId:details.requests[0].request_id,status:'approved'},admin)).status).toBe(200);
  const post=await request(`/api/groups/${id}/posts`,'POST',{body:'Let us pray together',postType:'discussion',anonymous:true},member);expect(post.status).toBe(201);const pid=(await post.json() as any).postId;
  expect((await (await request(`/api/groups/${id}/posts`,'GET',undefined,member)).json() as any).posts[0].displayName).toBeNull();
  await request(`/api/admin/groups/${id}`,'POST',{action:'post',postId:pid,status:'hidden'},admin);
  expect((await (await request(`/api/groups/${id}/posts`,'GET',undefined,member)).json() as any).posts).toHaveLength(0);
  await request(`/api/admin/groups/${id}`,'POST',{action:'status',status:'archived'},admin);
  expect((await request(`/api/groups/${id}/posts`,'POST',{body:'Blocked post',postType:'discussion'},member)).status).toBe(400);
  expect((await (await request('/api/groups')).json() as any).items).toHaveLength(0);
 });
 it('keeps hidden groups out of the public directory while administrators can manage them',async()=>{
  const cookie=await login('Administrator');await request('/api/groups','POST',{name:'Hidden ministry team',description:'Team',purposeStatement:'Christian ministry coordination',type:'custom',visibility:'hidden'},cookie);
  expect((await (await request('/api/groups')).json() as any).items).toHaveLength(0);
  expect((await (await request('/api/admin/groups','GET',undefined,cookie)).json() as any).items).toHaveLength(1);
 });
 it('allows discussion replies and reversible encouraged reactions',async()=>{
  const cookie=await login();const cat=env.DB.db.prepare("SELECT category_id FROM categories WHERE module='discussion' LIMIT 1").get() as any;
  const d=await request('/api/discussions','POST',{categoryId:cat.category_id,title:'Fellowship',body:'An encouragement',anonymous:false},cookie);const id=(await d.json() as any).discussionId;
  expect((await request('/api/comments','POST',{contentType:'discussion',contentId:id,body:'Amen'},cookie)).status).toBe(201);
  expect((await (await request('/api/comments?contentType=discussion&contentId='+id)).json() as any).items[0].body).toBe('Amen');
  for(const active of [true,false])expect((await (await request('/api/reactions','POST',{contentType:'discussion',contentId:id,reactionType:'encouraged'},cookie)).json() as any).active).toBe(active);
 });
 it('persists administrator-defined 24/7 radio and TV running order',async()=>{
  const cookie=await login('Administrator');
  async function add(name:string,type:'audio'|'video',mime:string){
   const registered=await request('/api/admin/media-engine/media','POST',{object_key:name,media_type:type,mime_type:mime,size_bytes:3,keep_media:true},cookie);expect(registered.status).toBe(201);const id=(await registered.json() as any).media_id;
   expect((await request('/api/admin/media-engine/media/'+id+'/upload','PUT',new Uint8Array([1,2,3]),cookie,{'Content-Type':mime})).status).toBe(200);
   expect((await request('/api/admin/media-engine/media/'+id+'/publish','POST',{published:true},cookie)).status).toBe(200);return id;
  }
  const radio1=await add('radio-one.mp3','audio','audio/mpeg'),radio2=await add('radio-two.mp3','audio','audio/mpeg');
  expect((await request('/api/admin/media-engine/playlist-order','POST',{channel:'radio',media_ids:[radio2,radio1]},cookie)).status).toBe(200);
  const radio=await (await request('/api/broadcast/programme?channel=radio')).json() as any;expect(radio.items.map((x:any)=>x.mediaId)).toEqual([radio2,radio1]);
  const tv1=await add('tv-one.mp4','video','video/mp4'),tv2=await add('tv-two.mp4','video','video/mp4');
  expect((await request('/api/admin/media-engine/playlist-order','POST',{channel:'video',media_ids:[tv2,tv1]},cookie)).status).toBe(200);
  const video=await (await request('/api/broadcast/programme?channel=video')).json() as any;expect(video.items.map((x:any)=>x.mediaId)).toEqual([tv2,tv1]);
  expect((await request('/api/admin/media-engine/playlist-order','POST',{channel:'video',media_ids:[tv1,tv1]},cookie)).status).toBe(400);
 });
 it('persists independent playlist switches without deleting published media',async()=>{
  const cookie=await login('Administrator');await upload(cookie,true);
  expect((await request('/api/admin/media-engine/broadcast-settings','POST',{channel:'radio',enabled:false},await login())).status).toBe(403);
  await request('/api/admin/media-engine/broadcast-settings','POST',{channel:'radio',enabled:false},cookie);
  expect((await (await request('/api/broadcast/programme?channel=radio')).json() as any).mode).toBe('offline');
  const settings=await (await request('/api/admin/media-engine/broadcast-settings','GET',undefined,cookie)).json() as any;expect(settings.items.find((x:any)=>x.channel==='video').playlist_enabled).toBe(1);
  await request('/api/admin/media-engine/broadcast-settings','POST',{channel:'radio',enabled:true},cookie);
  expect((await (await request('/api/broadcast/programme?channel=radio')).json() as any).mode).toBe('playlist');
 });
 it('cancels a current programme and resumes the published playlist',async()=>{
  const cookie=await login('Administrator');const id=await upload(cookie,true);
  const scheduled=await request('/api/broadcast/playout','POST',{mediaId:id,title:'Prayer hour',startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+60000).toISOString()},cookie);const pid=(await scheduled.json() as any).playout_id;
  expect((await (await request('/api/broadcast/programme?channel=radio')).json() as any).mode).toBe('scheduled');
  expect((await request(`/api/admin/media-engine/playout/${pid}/cancel`,'POST',{},cookie)).status).toBe(200);
  expect((await (await request('/api/broadcast/programme?channel=radio')).json() as any).mode).toBe('playlist');
 });
 it('routes a live stream to the selected channel and resumes 24/7 after stop',async()=>{
  const cookie=await login('Administrator');await upload(cookie,true);
  const started=await request('/api/broadcast/live-status','POST',{isLive:true,title:'TV only',sourceType:'camera',sourceRefId:'https://stream.example.test/live.mp4',destination:'video'},cookie);expect(started.status).toBe(201);const sid=(await started.json() as any).session_id;
  expect((await (await request('/api/broadcast/programme?channel=video')).json() as any).mode).toBe('live');
  expect((await (await request('/api/broadcast/programme?channel=radio')).json() as any).mode).toBe('playlist');
  await request(`/api/broadcast/live-session/${sid}/stop`,'POST',{},cookie);
  expect((await (await request('/api/broadcast/programme?channel=video')).json() as any).mode).toBe('offline');
 });
 it('blocks cross-origin community writes as well as studio writes',async()=>{
  const cookie=await login();expect((await request('/api/groups','POST',{},cookie,{Origin:'https://other.test'})).status).toBe(403);
 });

 it('lets guests browse every public community feed and group conversation while refusing posts',async()=>{
  for(const path of ['/api/discussions','/api/prayer','/api/testimonies','/api/groups','/api/community/categories'])expect((await request(path)).status).toBe(200);
  const admin=await login('Administrator');const created=await request('/api/groups','POST',{name:'Open fellowship',description:'All may read',purposeStatement:'Christian fellowship and encouragement',type:'custom',visibility:'public'},admin);const id=(await created.json() as any).groupId;
  expect((await request(`/api/groups/${id}/posts`)).status).toBe(200);
  for(const path of ['/api/discussions','/api/prayer','/api/testimonies','/api/comments',`/api/groups/${id}/posts`,'/api/public/testimony'])expect((await request(path,'POST',{})).status).toBe(401);
 });

 it('plays the selected standby advert during reconnect grace and restores live on heartbeat',async()=>{
  mediaEnv.LIVEKIT_URL='wss://test.livekit.cloud';mediaEnv.LIVEKIT_API_KEY='test-key';mediaEnv.LIVEKIT_API_SECRET='test-secret';
  const cookie=await login('Administrator');
  const registered=await request('/api/admin/media-engine/media','POST',{object_key:'standby.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:4,keep_media:true},cookie);expect(registered.status).toBe(201);const advert=(await registered.json() as any).media_id;
  expect((await request('/api/admin/media-engine/media/'+advert+'/upload','PUT',new Uint8Array([1,2,3,4]),cookie,{'Content-Type':'video/mp4'})).status).toBe(200);
  expect((await request('/api/admin/media-engine/media/'+advert+'/publish','POST',{published:true},cookie)).status).toBe(200);
  const started=await request('/api/broadcast/live-status','POST',{isLive:true,title:'Resilient live',sourceType:'camera',sourceRefId:'livekit:pending',destination:'video',fallbackMediaId:advert},cookie);
  expect(started.status).toBe(201);const sid=(await started.json() as any).session_id;
  mediaEnv.DB.db.prepare("UPDATE live_sessions SET status='reconnecting',reconnect_deadline=datetime('now','+10 minutes'),last_heartbeat_at=datetime('now','-4 minutes') WHERE session_id=?").run(sid);
  const during=await (await request('/api/broadcast/programme?channel=video')).json() as any;
  expect(during.mode).toBe('reconnecting');expect(during.items[0].mediaId).toBe(advert);expect(during.reconnectDeadline).toBeTruthy();
  const reclaim=await request('/api/admin/media-engine/livekit/publisher-token','POST',{session_id:sid},cookie);expect(reclaim.status).toBe(200);const reclaimBody=await reclaim.json() as any;expect(reclaimBody.url).toBe('wss://test.livekit.cloud');
  expect((await request('/api/broadcast/live-session/'+sid+'/heartbeat','POST',{},cookie)).status).toBe(200);
  const restored=await (await request('/api/broadcast/programme?channel=video')).json() as any;
  expect(restored.mode).toBe('live');expect(restored.transport).toBe('livekit');
 });
 it('encrypts social stream destinations and starts and stops a signed LiveKit egress',async()=>{
  mediaEnv.LIVEKIT_URL='wss://test.livekit.cloud';mediaEnv.LIVEKIT_API_KEY='test-key';mediaEnv.LIVEKIT_API_SECRET='test-secret';
  const owner=await login('Super Administrator'),serverUrl='rtmps://live.example.test/app',streamKey='private-stream-key',streamUrl=serverUrl+'/'+streamKey;let startBody:any,stopBody:any,startGrant:any,egressVisible=true;
  vi.stubGlobal('fetch',async(url:string,init:any)=>{
   if(String(url).includes('/twirp/livekit.Egress/StartEgress')){startBody=JSON.parse(init.body);startGrant=JSON.parse(atob(init.headers.Authorization.split(' ')[1].split('.')[1])).video;egressVisible=true;return Response.json({egress_id:'EG_TEST',status:'EGRESS_STARTING'});}
   if(String(url).includes('/twirp/livekit.Egress/ListEgress'))return Response.json({items:egressVisible?[{egress_id:'EG_TEST',status:'EGRESS_ACTIVE'}]:[]});
   if(String(url).includes('/twirp/livekit.Egress/StopEgress')){stopBody=JSON.parse(init.body);egressVisible=false;return Response.json({egress_id:'EG_TEST',status:'EGRESS_COMPLETE'});}
   return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
  });
  expect((await request('/api/admin/media-engine/restream/destination','POST',{destination:'youtube',server_url:serverUrl,stream_key:streamKey,enabled:true},owner)).status).toBe(200);
  const stored=await mediaEnv.LIVE_STATUS_KV.get('restream-destinations-v1');expect(stored).toBeTruthy();expect(stored).not.toContain('private-stream-key');expect(stored).not.toContain('live.example.test');
  const state=await (await request('/api/admin/media-engine/restream','GET',undefined,owner)).json() as any;
  expect(state.destinations.find((x:any)=>x.destination==='youtube')).toMatchObject({configured:true,enabled:true,host:'live.example.test'});
  const live=await request('/api/broadcast/live-status','POST',{isLive:true,title:'Social live',sourceType:'camera',sourceRefId:'livekit:pending',destination:'video'},owner);const sid=(await live.json() as any).session_id;
  const start=await request('/api/admin/media-engine/restream/start','POST',{source:'live',session_id:sid,format:'portrait-720',quality:'balanced'},owner);expect(start.status).toBe(201);
  expect((await request('/api/admin/media-engine/restream/destination','POST',{destination:'youtube',enabled:false},owner)).status).toBe(409);
  expect(startGrant).toEqual({roomRecord:true});expect(startBody.room_name).toBe('heavenlykey-live-'+sid);expect(startBody.preset).toBe('PORTRAIT_H264_720P_30');expect(startBody.outputs[0].stream.urls).toEqual([streamUrl]);expect(startBody.outputs[0].stream.protocol).toBe('RTMP');
  const invalidReplacement=await request('/api/admin/media-engine/restream/start','POST',{source:'live',session_id:sid+99999},owner);
  expect(invalidReplacement.status).toBe(503);
  expect((await invalidReplacement.json() as any).error).toContain('not on air');
  expect(stopBody).toBeUndefined();
  const stillLive=await (await request('/api/admin/media-engine/restream','GET',undefined,owner)).json() as any;
  expect(stillLive.active?.egressId).toBe('EG_TEST');
  const twentyFourRadio=await request('/api/admin/media-engine/restream/start','POST',{source:'247',channel:'radio'},owner);expect(twentyFourRadio.status).toBe(201);const twentyFourRadioBody=await twentyFourRadio.json() as any;expect(twentyFourRadioBody.replacedEgressId).toBe('EG_TEST');expect(stopBody).toEqual({egress_id:'EG_TEST'});expect(startBody.web.url).toBe('https://heavenlykey.alldaywow247.workers.dev/pages/radio.html?egress=1');
  const twentyFourTv=await request('/api/admin/media-engine/restream/start','POST',{source:'247',channel:'video'},owner);expect(twentyFourTv.status).toBe(201);expect(startBody.web.url).toBe('https://heavenlykey.alldaywow247.workers.dev/pages/video.html?egress=1');
  let activeState=await (await request('/api/admin/media-engine/restream','GET',undefined,owner)).json() as any;expect(activeState.active).toMatchObject({egressId:'EG_TEST',providerStatus:'EGRESS_ACTIVE'});
  egressVisible=false;activeState=await (await request('/api/admin/media-engine/restream','GET',undefined,owner)).json() as any;expect(activeState.active).toBeNull();
  expect((await request('/api/admin/media-engine/restream/stop','POST',{},owner)).status).toBe(200);
  expect((await request('/api/admin/media-engine/restream/destination','POST',{destination:'youtube',action:'remove'},owner)).status).toBe(200);
  const removed=await (await request('/api/admin/media-engine/restream','GET',undefined,owner)).json() as any;expect(removed.destinations.find((x:any)=>x.destination==='youtube')).toMatchObject({configured:false,enabled:false});
 });

 it('protects scheduled media integrity and supports safe deletion',async()=>{
  const admin=await login('Administrator');
  const uploaded=await upload(admin,true);
  const now=Date.now(),start=new Date(now+60_000).toISOString(),end=new Date(now+3_600_000).toISOString();
  const first=await request('/api/broadcast/playout','POST',{mediaId:uploaded,title:'First programme',startsAt:start,endsAt:end},admin);expect(first.status).toBe(201);
  const overlap=await request('/api/broadcast/playout','POST',{mediaId:uploaded,title:'Overlap',startsAt:new Date(now+120_000).toISOString(),endsAt:new Date(now+300_000).toISOString()},admin);expect(overlap.status).toBe(409);
  expect((await request('/api/admin/media-engine/media/'+uploaded+'/delete','POST',{},admin)).status).toBe(409);
  const pid=(await first.json() as any).playout_id;expect((await request('/api/admin/media-engine/playout/'+pid+'/cancel','POST',{},admin)).status).toBe(200);
  expect((await request('/api/admin/media-engine/media/'+uploaded+'/delete','POST',{},admin)).status).toBe(200);
  const files=await (await request('/api/admin/media-engine/media','GET',undefined,admin)).json() as any;expect(files.items.some((x:any)=>x.media_id===uploaded)).toBe(false);
 });
 it('rejects schedules that outlive temporary media retention',async()=>{
  const admin=await login('Administrator');
  const registered=await request('/api/admin/media-engine/media','POST',{object_key:'temporary.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:4,keep_media:false,retention_hours:1},admin);expect(registered.status).toBe(201);const id=(await registered.json() as any).media_id;
  expect((await request('/api/admin/media-engine/media/'+id+'/upload','PUT',new Uint8Array([1,2,3,4]),admin,{'Content-Type':'video/mp4'})).status).toBe(200);
  const r=await request('/api/broadcast/playout','POST',{mediaId:id,title:'Too late',startsAt:new Date(Date.now()+2*3600_000).toISOString(),endsAt:new Date(Date.now()+3*3600_000).toISOString()},admin);expect(r.status).toBe(409);
 });

 it('switches the same session from live camera to prerecorded video and back to live',async()=>{
  mediaEnv.LIVEKIT_URL='wss://test.livekit.cloud';mediaEnv.LIVEKIT_API_KEY='test-key';mediaEnv.LIVEKIT_API_SECRET='test-secret';
  const admin=await login('Administrator');
  const registered=await request('/api/admin/media-engine/media','POST',{object_key:'takeover.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:4,keep_media:true},admin);expect(registered.status).toBe(201);const video=(await registered.json() as any).media_id;
  expect((await request('/api/admin/media-engine/media/'+video+'/upload','PUT',new Uint8Array([1,2,3,4]),admin,{'Content-Type':'video/mp4'})).status).toBe(200);
  const started=await request('/api/broadcast/live-status','POST',{isLive:true,title:'Seamless takeover',sourceType:'camera',sourceRefId:'livekit:pending',destination:'video'},admin);
  expect(started.status).toBe(201);const sid=(await started.json() as any).session_id;
  expect((await request('/api/broadcast/live-session/'+sid+'/switch-to-prerecorded','POST',{mediaId:video},admin)).status).toBe(200);
  let programme=await (await request('/api/broadcast/programme?channel=video')).json() as any;
  expect(programme.mode).toBe('live');expect(programme.items[0].mediaId).toBe(video);
  expect((await request('/api/broadcast/live-session/'+sid+'/switch-to-live','POST',{},admin)).status).toBe(200);
  programme=await (await request('/api/broadcast/programme?channel=video')).json() as any;
  expect(programme.mode).toBe('live');expect(programme.transport).toBe('livekit');expect(programme.sessionId).toBe(sid);
  const status=await (await request('/api/broadcast/live-status','GET',undefined,admin)).json() as any;
  expect(status.live.session_id).toBe(sid);expect(status.live.source_type).toBe('camera');expect(String(status.live.source_ref)).toBe('livekit:'+sid);
 });

 it('honours the administrator-selected 24/7 TV playlist order',async()=>{
  const admin=await login('Administrator');
  const makeVideo=async(name:string)=>{
    const r=await request('/api/admin/media-engine/media','POST',{object_key:name,media_type:'video',mime_type:'video/mp4',size_bytes:4,keep_media:true},admin);expect(r.status).toBe(201);const id=(await r.json() as any).media_id;
    expect((await request('/api/admin/media-engine/media/'+id+'/upload','PUT',new Uint8Array([1,2,3,4]),admin,{'Content-Type':'video/mp4'})).status).toBe(200);
    expect((await request('/api/admin/media-engine/media/'+id+'/publish','POST',{published:true},admin)).status).toBe(200);return id;
  };
  const first=await makeVideo('first.mp4'),second=await makeVideo('second.mp4');
  expect((await request('/api/admin/media-engine/playlist-order','POST',{channel:'video',media_ids:[second,first]},admin)).status).toBe(200);
  const order=await (await request('/api/admin/media-engine/playlist-order','GET',undefined,admin)).json() as any;expect(order.video).toEqual([second,first]);
  const programme=await (await request('/api/broadcast/programme?channel=video')).json() as any;
  expect(programme.mode).toBe('playlist');expect(programme.items.map((x:any)=>x.mediaId).slice(0,2)).toEqual([second,first]);
 });

 it('allows administrators to pre-authorize VIP WhatsApp numbers that bypass automation',async()=>{
  const admin=await login('Administrator');
  const saved=await request('/api/admin/whatsapp/direct-access','POST',{wa_id:'+234 801 234 5678',profile_name:'Trusted Pastor',notes:'Direct access'},admin);
  expect(saved.status).toBe(201);
  const contact=env.DB.db.prepare("SELECT wa_id,profile_name,access_mode FROM whatsapp_contacts WHERE wa_id=?").get('2348012345678') as any;
  expect(contact.access_mode).toBe('human_only');
  expect(contact.profile_name).toBe('Trusted Pastor');

  env.WHATSAPP_VERIFY_TOKEN='verify-me';env.META_APP_SECRET='meta-app-secret';env.WHATSAPP_ACCESS_TOKEN='whatsapp-access-token-that-is-long-enough';env.WHATSAPP_PHONE_NUMBER_ID='1234567890';
  const payload={entry:[{changes:[{value:{contacts:[{wa_id:'2348012345678',profile:{name:'Trusted Pastor'}}],messages:[{id:'wamid.vip.1',from:'2348012345678',type:'text',text:{body:'Hello Evangelist'},timestamp:'1770000100'}]}}]}]};
  const raw=JSON.stringify(payload),signature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(raw).digest('hex');
  const incoming=await request('/api/integrations/whatsapp/webhook','POST',payload,undefined,{'x-hub-signature-256':signature});
  expect(incoming.status).toBe(200);
  const conversation=env.DB.db.prepare("SELECT c.conversation_id,c.unread_count,w.access_mode FROM whatsapp_conversations c JOIN whatsapp_contacts w ON w.contact_id=c.contact_id WHERE w.wa_id=?").get('2348012345678') as any;
  expect(conversation.access_mode).toBe('human_only');
  expect(conversation.unread_count).toBe(1);
  const outbound=(env.DB.db.prepare("SELECT COUNT(*) AS n FROM whatsapp_messages WHERE conversation_id=? AND direction='outbound'").get(conversation.conversation_id) as any).n;
  expect(outbound).toBe(0);
  const notice=env.DB.db.prepare("SELECT title FROM whatsapp_notifications WHERE conversation_id=? ORDER BY notification_id DESC LIMIT 1").get(conversation.conversation_id) as any;
  expect(notice.title).toContain('human attention');
 });
 it('protects the WhatsApp inbox and routes a signed prayer request into human follow-up',async()=>{
  const member=await login(),admin=await login('Administrator');
  expect((await request('/api/admin/whatsapp/conversations','GET',undefined,member)).status).toBe(403);
  env.WHATSAPP_VERIFY_TOKEN='verify-me';env.META_APP_SECRET='meta-app-secret';env.WHATSAPP_ACCESS_TOKEN='whatsapp-access-token-that-is-long-enough';env.WHATSAPP_PHONE_NUMBER_ID='1234567890';
  const verify=await request('/api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123');expect(verify.status).toBe(200);expect(await verify.text()).toBe('abc123');
  const payload={entry:[{changes:[{value:{contacts:[{wa_id:'2348000000000',profile:{name:'Prayer Contact'}}],messages:[{id:'wamid.in.1',from:'2348000000000',type:'text',text:{body:'1'},timestamp:'1770000000'}]}}]}]};
  const raw=JSON.stringify(payload),signature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(raw).digest('hex');
  let outboundWhatsApp=0;
  vi.stubGlobal('fetch',async(url:string,init:any)=>{
    if(String(url).startsWith('https://graph.facebook.com/'))return Response.json({messages:[{id:'wamid.out.'+(++outboundWhatsApp)}]});
    return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
  });
  const webhook=await request('/api/integrations/whatsapp/webhook','POST',payload,undefined,{'x-hub-signature-256':signature});expect(webhook.status).toBe(200);
  const list=await (await request('/api/admin/whatsapp/conversations','GET',undefined,admin)).json() as any;expect(list.items).toHaveLength(1);expect(list.items[0]).toMatchObject({profile_name:'Prayer Contact',category:'prayer',unread_count:1});
  let detail=await (await request('/api/admin/whatsapp/conversations/'+list.items[0].conversation_id,'GET',undefined,admin)).json() as any;expect(detail.messages.map((m:any)=>m.direction)).toEqual(['inbound','outbound']);
  const optionTwoPayload={entry:[{changes:[{value:{contacts:[{wa_id:'2348000000001',profile:{name:'Prayer Option Two'}}],messages:[{id:'wamid.in.option2',from:'2348000000001',type:'text',text:{body:'2'},timestamp:'1770000000'}]}}]}]};
  const optionTwoRaw=JSON.stringify(optionTwoPayload),optionTwoSignature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(optionTwoRaw).digest('hex');
  expect((await request('/api/integrations/whatsapp/webhook','POST',optionTwoPayload,undefined,{'x-hub-signature-256':optionTwoSignature})).status).toBe(200);
  const optionTwoList=await (await request('/api/admin/whatsapp/conversations','GET',undefined,admin)).json() as any;const optionTwoConversation=optionTwoList.items.find((x:any)=>x.wa_id==='2348000000001');expect(optionTwoConversation).toMatchObject({profile_name:'Prayer Option Two',category:'prayer',unread_count:1});
  const optionTwoSaved=env.DB.db.prepare("SELECT COUNT(*) AS count FROM ministry_prayer_requests WHERE wa_id=?").get('2348000000001') as any;expect(Number(optionTwoSaved.count)).toBe(0);
  let alerts=await (await request('/api/admin/whatsapp/notifications','GET',undefined,admin)).json() as any;expect(alerts.items.find((x:any)=>x.kind==='prayer')).toBeUndefined();
  const requestPayload={entry:[{changes:[{value:{contacts:[{wa_id:'2348000000000',profile:{name:'Prayer Contact'}}],messages:[{id:'wamid.in.2',from:'2348000000000',type:'text',text:{body:'Please pray for my family.'},timestamp:'1770000001'}]}}]}]};
  const requestRaw=JSON.stringify(requestPayload),requestSignature='sha256='+createHmac('sha256',env.META_APP_SECRET).update(requestRaw).digest('hex');
  expect((await request('/api/integrations/whatsapp/webhook','POST',requestPayload,undefined,{'x-hub-signature-256':requestSignature})).status).toBe(200);
  detail=await (await request('/api/admin/whatsapp/conversations/'+list.items[0].conversation_id,'GET',undefined,admin)).json() as any;expect(detail.messages.map((m:any)=>m.direction)).toEqual(['inbound','outbound','inbound','outbound']);
  alerts=await (await request('/api/admin/whatsapp/notifications','GET',undefined,admin)).json() as any;expect(alerts.items.find((x:any)=>x.kind==='prayer')?.kind).toBe('prayer');
  const prayer=await (await request('/api/admin/ministry/prayer-requests','GET',undefined,admin)).json() as any;expect(prayer.items[0]).toMatchObject({wa_id:'2348000000000',request:'Please pray for my family.',status:'new'});
 });
 it('stores WhatsApp connection credentials encrypted and limits connection changes to owner/deputy',async()=>{
  env.ENCRYPTION_KEY='11'.repeat(32);
  const admin=await login('Administrator'),deputy=await login('Deputy Super Administrator');
  const body={display_name:'HKEM WhatsApp',phone_number_id:'123456789012345',business_account_id:'987654321',access_token:'super-secret-whatsapp-token-value-12345'};
  expect((await request('/api/admin/whatsapp/connection','POST',body,admin)).status).toBe(403);
  expect((await request('/api/admin/whatsapp/connection','POST',body,deputy)).status).toBe(201);
  const row=env.DB.db.prepare('SELECT credential_ciphertext,credential_iv,status FROM whatsapp_accounts WHERE phone_number_id=?').get(body.phone_number_id) as any;
  expect(row.status).toBe('connected');expect(row.credential_ciphertext).not.toContain(body.access_token);expect(row.credential_iv).toBeTruthy();
 });
 it('keeps social authorization status separate from the enabled switch',async()=>{
  const admin=await login('Administrator');
  env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')").run('facebook_state_test','facebook','State Test Page','state-page','cipher','iv');
  expect((await request('/api/admin/social/accounts/facebook_state_test/state','POST',{active:false},admin)).status).toBe(200);
  let row=env.DB.db.prepare("SELECT active,connection_status FROM social_managed_accounts WHERE id=?").get('facebook_state_test') as any;expect(Number(row.active)).toBe(0);expect(row.connection_status).toBe('connected');
  expect((await request('/api/admin/social/accounts/facebook_state_test/state','POST',{active:true},admin)).status).toBe(200);
  row=env.DB.db.prepare("SELECT active,connection_status FROM social_managed_accounts WHERE id=?").get('facebook_state_test') as any;expect(Number(row.active)).toBe(1);expect(row.connection_status).toBe('connected');
  env.DB.db.prepare("UPDATE social_managed_accounts SET active=0,connection_status='disconnected' WHERE id=?").run('facebook_state_test');
  const cannotEnable=await request('/api/admin/social/accounts/facebook_state_test/state','POST',{active:true},admin);expect(cannotEnable.status).toBe(400);
  row=env.DB.db.prepare("SELECT active,connection_status FROM social_managed_accounts WHERE id=?").get('facebook_state_test') as any;expect(Number(row.active)).toBe(0);expect(row.connection_status).toBe('disconnected');
 });
 it('publishes through an encrypted connected social account and records the provider result',async()=>{
  env.ENCRYPTION_KEY='22'.repeat(32);
  const admin=await login('Administrator');
  const sealed=await encryptField(JSON.stringify({access_token:'provider-token-value'}),env.ENCRYPTION_KEY);
  env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')")
    .run('x_42','x','Heavenly Key X','42',sealed.ciphertext,sealed.iv);
  vi.stubGlobal('fetch',async(url:string,init:any)=>{
    if(String(url)==='https://api.x.com/2/tweets')return Response.json({data:{id:'tweet-123'}});
    return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
  });
  const publish=await request('/api/admin/social/publish','POST',{account_ids:['x_42'],text:'Taking Christ to the Nations of the World',media_ids:[]},admin);expect(publish.status).toBe(201);
  const publishBody=await publish.json() as any;expect(publishBody).toMatchObject({status:'published',summary:{total:1,published:1,publishing:0,failed:0}});expect(publishBody.results[0]).toMatchObject({platform:'x',status:'published',provider_post_id:'tweet-123'});
  const history=await (await request('/api/admin/social/jobs','GET',undefined,admin)).json() as any;expect(history.items[0]).toMatchObject({platform:'x',status:'published',provider_post_id:'tweet-123'});
  expect((await request('/api/admin/social/accounts','GET',undefined,await login())).status).toBe(403);
 });
 it('keeps scheduled media until every selected destination succeeds, then deletes it immediately',async()=>{
  env.ENCRYPTION_KEY='55'.repeat(32);env.PUBLIC_SITE_URL='https://website.test';
  const admin=await login('Administrator'),profile=await (await request('/api/auth/profile','GET',undefined,admin)).json() as any;
  const sealed=await encryptField(JSON.stringify({access_token:'provider-token-value'}),env.ENCRYPTION_KEY);
  for(const id of ['fb_cleanup_1','fb_cleanup_2'])env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')")
    .run(id,'facebook',id,id,sealed.ciphertext,sealed.iv);
  const registered=await request('/api/admin/media-engine/media','POST',{object_key:'social/cleanup.jpg',media_type:'image',mime_type:'image/jpeg',size_bytes:4,keep_media:false,retention_hours:720},admin);expect(registered.status).toBe(201);const mediaId=Number((await registered.json() as any).media_id);
  expect((await request('/api/admin/media-engine/media/'+mediaId+'/upload','PUT',new Uint8Array([255,216,255,217]),admin,{'Content-Type':'image/jpeg'})).status).toBe(200);
  vi.stubGlobal('fetch',async(url:string,init:any)=>{
    if(String(url).startsWith('https://graph.facebook.com/'))return Response.json({id:'photo-'+crypto.randomUUID(),post_id:'post-'+crypto.randomUUID()});
    return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
  });
  const scheduled=await request('/api/admin/social/publish','POST',{account_ids:['fb_cleanup_1','fb_cleanup_2'],text:'Scheduled image',media_ids:[mediaId],media_type:'image',publish_at:new Date(Date.now()+3600000).toISOString(),publish_mode:'scheduled'},admin);
  expect(scheduled.status).toBe(202);const ids=(await scheduled.json() as any).job_ids.map(Number);
   const retained=mediaEnv.DB.db.prepare("SELECT keep_media,retention_until FROM media_objects WHERE media_id=?").get(mediaId) as any;
   expect(retained.keep_media).toBe(1);expect(retained.retention_until).toBeNull();
  env.DB.db.prepare("UPDATE social_publish_jobs SET status='publishing' WHERE job_id=?").run(ids[0]);await executeJob(env,ids[0]);
  expect((mediaEnv.DB.db.prepare("SELECT status FROM media_objects WHERE media_id=?").get(mediaId) as any).status).toBe('approved');
  env.DB.db.prepare("UPDATE social_publish_jobs SET status='publishing' WHERE job_id=?").run(ids[1]);await executeJob(env,ids[1]);
  expect((mediaEnv.DB.db.prepare("SELECT status FROM media_objects WHERE media_id=?").get(mediaId) as any).status).toBe('deleted');
  expect(profile.profile.userId).toBeTruthy();
 });
 it('queues scheduled social posts, executes them when due, and safely cancels queued jobs',async()=>{
  env.ENCRYPTION_KEY='44'.repeat(32);
  const admin=await login('Administrator');
  const sealed=await encryptField(JSON.stringify({access_token:'provider-token-value'}),env.ENCRYPTION_KEY);
  env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')")
    .run('x_schedule','x','Heavenly Key Scheduled X','77',sealed.ciphertext,sealed.iv);
  vi.stubGlobal('fetch',async(url:string,init:any)=>{
    if(String(url)==='https://api.x.com/2/tweets')return Response.json({data:{id:'scheduled-tweet-1'}});
    return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
  });

  const future=new Date(Date.now()+3600000).toISOString();
  const queued=await request('/api/admin/social/publish','POST',{account_ids:['x_schedule'],text:'Scheduled ministry post',media_ids:[],publish_at:future,publish_mode:'scheduled'},admin);
  expect(queued.status).toBe(202);
  const queuedBody=await queued.json() as any;expect(queuedBody).toMatchObject({status:'queued',publish_mode:'scheduled'});
  const jobId=Number(queuedBody.job_ids[0]);
  let row=env.DB.db.prepare('SELECT status,publish_mode,publish_at FROM social_publish_jobs WHERE job_id=?').get(jobId) as any;
  expect(row.status).toBe('queued');expect(row.publish_mode).toBe('scheduled');expect(row.publish_at).toBe(future);

  env.DB.db.prepare("UPDATE social_publish_jobs SET publish_at=datetime('now','-1 minute') WHERE job_id=?").run(jobId);
  await runDueJobs(env);
  row=env.DB.db.prepare('SELECT status,provider_post_id FROM social_publish_jobs WHERE job_id=?').get(jobId) as any;
  expect(row).toMatchObject({status:'published',provider_post_id:'scheduled-tweet-1'});

  const second=await request('/api/admin/social/publish','POST',{account_ids:['x_schedule'],text:'Cancel this scheduled post',media_ids:[],publish_at:new Date(Date.now()+7200000).toISOString(),publish_mode:'scheduled'},admin);
  expect(second.status).toBe(202);const secondId=Number((await second.json() as any).job_ids[0]);
  const cancel=await request('/api/admin/social/jobs/'+secondId+'/cancel','POST',{},admin);expect(cancel.status).toBe(200);
  const cancelled=env.DB.db.prepare('SELECT status,error FROM social_publish_jobs WHERE job_id=?').get(secondId) as any;
  expect(cancelled).toMatchObject({status:'failed',error:'Cancelled by administrator'});
  expect((await request('/api/admin/social/jobs/'+jobId+'/cancel','POST',{},admin)).status).toBe(400);
 });
 it('validates every selected social account before creating any publish job',async()=>{
  const admin=await login('Administrator');
  env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES('x_valid','x','Valid X','42','cipher','iv',1,'connected')").run();
  env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES('x_disconnected','x','Disconnected X','43','cipher','iv',0,'disconnected')").run();
  const before=(env.DB.db.prepare('SELECT COUNT(*) AS n FROM social_publish_jobs').get() as any).n;
  const publish=await request('/api/admin/social/publish','POST',{account_ids:['x_valid','x_disconnected'],text:'Validation should be atomic',media_ids:[],publish_mode:'post_now'},admin);
  expect(publish.status).toBe(400);
  expect((await publish.json() as any).error.message).toContain('not connected');
  const after=(env.DB.db.prepare('SELECT COUNT(*) AS n FROM social_publish_jobs').get() as any).n;
  expect(after).toBe(before);
 });
 it('returns truthful immediate POST NOW provider failures',async()=>{
  env.ENCRYPTION_KEY='33'.repeat(32);
  const admin=await login('Administrator'),sealed=await encryptField(JSON.stringify({access_token:'provider-token-value'}),env.ENCRYPTION_KEY);
  env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')").run('x_fail','x','Heavenly Key X Failure','99',sealed.ciphertext,sealed.iv);
  vi.stubGlobal('fetch',async(url:string,init:any)=>{
   if(String(url)==='https://api.x.com/2/tweets')return Response.json({error:{message:'Provider denied this post'}},{status:403});
   return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
  });
  const publish=await request('/api/admin/social/publish','POST',{account_ids:['x_fail'],text:'Test provider failure',media_ids:[],publish_mode:'post_now'},admin);expect(publish.status).toBe(201);
  const body=await publish.json() as any;expect(body).toMatchObject({status:'failed',summary:{total:1,published:0,publishing:0,failed:1}});expect(body.results[0]).toMatchObject({account_id:'x_fail',platform:'x',status:'failed',error:'Provider denied this post'});
 });

  it('quarantines abandoned submissions instead of sending duplicate posts',async()=>{
   const admin=await login('Administrator');
   env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES('fb_ambiguous','facebook','Audit Page','123','cipher','iv',1,'connected')").run();
   const id=Number(env.DB.db.prepare("INSERT INTO social_publish_jobs(account_id,text,media_ids,status,publish_mode,organization_id,updated_at) VALUES('fb_ambiguous','Pending review','[]','publishing','scheduled',1,datetime('now','-25 minutes'))").run().lastInsertRowid);
   await runDueJobs(env);
   const row=env.DB.db.prepare('SELECT status,error FROM social_publish_jobs WHERE job_id=?').get(id) as any;
   expect(row.status).toBe('failed');
   expect(row.error).toContain('Publication result unknown');
   expect((await request('/api/admin/social/jobs/'+id+'/retry','POST',{},admin)).status).toBe(400);
  });
  it('prevents automatic cleanup from deleting published radio recordings',async()=>{
   const admin=await login('Administrator');
   const mediaId=await upload(admin,true);
   const blocked=await request('/api/admin/media-engine/media/'+mediaId+'/delete','POST',{protect_broadcast:true},admin);
   expect(blocked.status).toBe(409);
   expect((mediaEnv.DB.db.prepare('SELECT status FROM media_objects WHERE media_id=?').get(mediaId) as any).status).toBe('published');
  });

  it('releases temporary images when their only scheduled post is cancelled',async()=>{
   env.ENCRYPTION_KEY='77'.repeat(32);
   env.PUBLIC_SITE_URL='https://website.test';
   const admin=await login('Administrator');
   const sealed=await encryptField(JSON.stringify({access_token:'provider-token-value'}),env.ENCRYPTION_KEY);
   env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')").run('fb_cancel_media','facebook','Page','123',sealed.ciphertext,sealed.iv);
   const registered=await request('/api/admin/media-engine/media','POST',{object_key:'social/cancel.jpg',media_type:'image',mime_type:'image/jpeg',size_bytes:4,keep_media:false,retention_hours:24},admin);
   const id=Number((await registered.json() as any).media_id);
   expect((await request('/api/admin/media-engine/media/'+id+'/upload','PUT',new Uint8Array([255,216,255,217]),admin,{'Content-Type':'image/jpeg'})).status).toBe(200);
   const scheduled=await request('/api/admin/social/publish','POST',{account_ids:['fb_cancel_media'],text:'Temporary picture',media_ids:[id],media_type:'image',publish_at:new Date(Date.now()+3600000).toISOString(),publish_mode:'scheduled'},admin);
   expect(scheduled.status).toBe(202);
   expect((mediaEnv.DB.db.prepare('SELECT keep_media FROM media_objects WHERE media_id=?').get(id) as any).keep_media).toBe(1);
   const jobId=(await scheduled.json() as any).job_ids[0];
   expect((await request('/api/admin/social/jobs/'+jobId+'/cancel','POST',{},admin)).status).toBe(200);
   expect((mediaEnv.DB.db.prepare('SELECT status FROM media_objects WHERE media_id=?').get(id) as any).status).toBe('deleted');
  });

  it('rejects disconnected destinations without retaining an unscheduled uploaded image',async()=>{
   env.PUBLIC_SITE_URL='https://website.test';
   const admin=await login('Administrator');
   const registered=await request('/api/admin/media-engine/media','POST',{object_key:'social/unscheduled.jpg',media_type:'image',mime_type:'image/jpeg',size_bytes:4,keep_media:false,retention_hours:24},admin);
   const mediaId=Number((await registered.json() as any).media_id);
   expect((await request('/api/admin/media-engine/media/'+mediaId+'/upload','PUT',new Uint8Array([255,216,255,217]),admin,{'Content-Type':'image/jpeg'})).status).toBe(200);
   env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES('fb_inactive_check','facebook','Inactive Page','12','cipher','iv',0,'connected')").run();
   const rejected=await request('/api/admin/social/publish','POST',{account_ids:['fb_inactive_check'],text:'Image post',media_ids:[mediaId],media_type:'image',publish_at:new Date(Date.now()+3600000).toISOString(),publish_mode:'scheduled'},admin);
   expect(rejected.status).toBe(400);
   expect((mediaEnv.DB.db.prepare('SELECT keep_media FROM media_objects WHERE media_id=?').get(mediaId) as any).keep_media).toBe(0);
  });
  it('does not delete a Facebook video until provider processing confirms readiness',async()=>{
   env.ENCRYPTION_KEY='88'.repeat(32);env.PUBLIC_SITE_URL='https://website.test';
   const admin=await login('Administrator');
   const sealed=await encryptField(JSON.stringify({access_token:'provider-token-value'}),env.ENCRYPTION_KEY);
   env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES(?,?,?,?,?,?,1,'connected')").run('fb_video_audit','facebook','Media Page','page-55',sealed.ciphertext,sealed.iv);
   const registered=await request('/api/admin/media-engine/media','POST',{object_key:'social/video-audit.mp4',media_type:'video',mime_type:'video/mp4',size_bytes:4,keep_media:false,retention_hours:24},admin);
   const mediaId=Number((await registered.json() as any).media_id);
   expect((await request('/api/admin/media-engine/media/'+mediaId+'/upload','PUT',new Uint8Array([1,2,3,4]),admin,{'Content-Type':'video/mp4'})).status).toBe(200);
   let ready=false;
   vi.stubGlobal('fetch',async(url:string,init:any)=>{
    if(String(url).startsWith('https://graph.facebook.com/')){
      if(String(url).includes('/videos')){
       expect(String(init.headers.authorization)).toBe('Bearer provider-token-value');
       expect(String(init.body)).not.toContain('access_token');
       return Response.json({id:'video-status-42'});
      }
      if(String(url).includes('video-status-42'))return Response.json({status:{video_status:ready?'ready':'processing'}});
    }
    return engine.fetch(new Request(url,{...init,duplex:'half'}),mediaEnv);
   });
   const publish=await request('/api/admin/social/publish','POST',{account_ids:['fb_video_audit'],text:'Ministry video',media_ids:[mediaId],media_type:'video',publish_mode:'post_now'},admin);
   expect(publish.status).toBe(201);
   expect((await publish.json() as any).status).toBe('publishing');
   await runDueJobs(env);
   expect((mediaEnv.DB.db.prepare('SELECT status FROM media_objects WHERE media_id=?').get(mediaId) as any).status).toBe('approved');
   ready=true;await runDueJobs(env);
   expect((mediaEnv.DB.db.prepare('SELECT status FROM media_objects WHERE media_id=?').get(mediaId) as any).status).toBe('deleted');
   expect((env.DB.db.prepare("SELECT status FROM social_publish_jobs WHERE account_id='fb_video_audit'").get() as any).status).toBe('published');
  });

  it('does not remove a connected social account while its posts remain queued',async()=>{
   const owner=await login('Deputy Super Administrator');
   env.DB.db.prepare("INSERT INTO social_managed_accounts(id,platform,display_name,account_ref,credential_ciphertext,credential_iv,active,connection_status) VALUES('fb_owner_guard','facebook','Owner Page','77','cipher','iv',1,'connected')").run();
   const r=await request('/api/admin/social/publish','POST',{account_ids:['fb_owner_guard'],text:'Pending evangelism',media_ids:[],publish_at:new Date(Date.now()+3600000).toISOString(),publish_mode:'scheduled'},owner);
   expect(r.status).toBe(202);
   const disabled=await request('/api/admin/social/accounts/fb_owner_guard/state','POST',{active:false},owner);
   expect(disabled.status).toBe(400);
   expect((await disabled.json() as any).error.message).toContain('queued or publishing');
   const blocked=await request('/api/admin/social/accounts/fb_owner_guard/remove','POST',{},owner);
   expect(blocked.status).toBe(400);
   expect((await blocked.json() as any).error.message).toContain('queued or publishing');
   const jobId=(await r.json() as any).job_ids[0];
   expect((await request('/api/admin/social/jobs/'+jobId+'/cancel','POST',{},owner)).status).toBe(200);
   expect((await request('/api/admin/social/accounts/fb_owner_guard/remove','POST',{},owner)).status).toBe(200);
   const row=env.DB.db.prepare("SELECT active,connection_status,credential_ciphertext FROM social_managed_accounts WHERE id='fb_owner_guard'").get() as any;
   expect(row).toMatchObject({active:0,connection_status:'disconnected',credential_ciphertext:''});
   expect((env.DB.db.prepare('SELECT COUNT(*) AS n FROM social_publish_jobs WHERE account_id=?').get('fb_owner_guard') as any).n).toBe(1);
  });

  it('never discloses external signed live URLs to anonymous programme viewers',async()=>{
   const admin=await login('Administrator');
   const secretSource='https://live.example.test/stream.m3u8?access_token=private-provider-source-123';
   const created=await request('/api/broadcast/live-status','POST',{isLive:true,title:'External source privacy',sourceType:'camera',sourceRefId:secretSource,destination:'video'},admin);
   expect(created.status).toBe(201);
   const publicStatus=await request('/api/broadcast/live-status');
   const publicBody=await publicStatus.json() as any;
   expect(publicStatus.status).toBe(200);
   expect(JSON.stringify(publicBody)).not.toContain('private-provider-source-123');
   expect(publicBody.live.source_ref).toBeUndefined();
   const privateStatus=await (await request('/api/broadcast/live-status','GET',undefined,admin)).json() as any;
   expect(privateStatus.live.source_ref).toBe(secretSource);
  });


});
