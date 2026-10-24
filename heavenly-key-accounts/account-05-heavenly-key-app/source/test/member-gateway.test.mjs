import test from 'node:test';
import assert from 'node:assert/strict';
import {memberGateway} from '../src/member-gateway.js';

const ID='a'.repeat(64),ORIGIN='https://app.example.test',enabled={COMMUNITY_MEMBER_ACCESS_ENABLED:'true'};
const member={user:{userId:4,status:'active',role:'owner'},profile:{displayName:'A believer',email:'private',fullName:'Private Name',dateOfBirth:'private'}};
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...extra}});
const request=(path,method='GET',body,headers={})=>new Request(ORIGIN+'/api/member/'+path,{method,headers:{...(method==='POST'?{Origin:ORIGIN,'content-type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});
const signed={'cookie':'other_cookie=private; __Host-hk_session='+ID,'authorization':'Bearer private','Sec-Fetch-Site':'same-origin'};

test('member integration is off by default and exposes no sign-in action or upstream traffic',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error();};
 const r=await memberGateway(request('config'),{},fetcher);assert.deepEqual(await r.json(),{enabled:false});
 for(const [path,method] of [['login','POST'],['session','GET'],['tracks','GET'],['lessons/1/complete','POST']])assert.equal((await memberGateway(request(path,method,method==='POST'?{}:undefined),{},fetcher)).status,503);
 assert.equal(calls,0);
});
test('login uses Account 3 and creates only a protected host cookie',async()=>{
 const r=await memberGateway(request('login','POST',{email:' Test@example.test ',password:'secret',role:'owner'},{Authorization:'Bearer attacker',Cookie:'gc_session=attacker'}),enabled,async(url,options)=>{
  assert.equal(url,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/auth/login');assert.equal(options.headers.Origin,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev');
  assert.equal(options.headers.Cookie,undefined);assert.equal(options.headers.Authorization,undefined);
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');
  assert.deepEqual(JSON.parse(options.body),{email:'test@example.test',password:'secret'});
  return json({ok:true,userId:4,role:'owner'},200,{'set-cookie':'gc_session='+ID+'; Path=/; HttpOnly; Secure; SameSite=Lax'});
 });
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
 assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal(r.headers.get('set-cookie'),'__Host-hk_session='+ID+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000');
});
test('writes require this app origin and enforce method/path/body bounds',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error();};
 for(const headers of [{Origin:'https://evil.test'},{Origin:'null'},{Origin:ORIGIN,'Sec-Fetch-Site':'cross-site'},{Origin:ORIGIN,'Sec-Fetch-Site':'same-site'}])assert.equal((await memberGateway(request('login','POST',{email:'a@b.test',password:'p'},headers),enabled,fetcher)).status,403);
 assert.equal((await memberGateway(new Request(ORIGIN+'/api/member/login',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}),enabled,fetcher)).status,403);
 for(const [path,method] of [['login','GET'],['admin','POST'],['lessons/0/complete','POST'],['lessons/1/complete','GET'],['posts','POST']])assert.equal((await memberGateway(request(path,method,method==='POST'?{}:undefined),enabled,fetcher)).status,404);
 assert.equal((await memberGateway(request('session?url=https://evil.test'),enabled,fetcher)).status,400);
 assert.equal((await memberGateway(request('login','POST',{email:'a@b.test',password:'x'.repeat(9000)}),enabled,fetcher)).status,400);
 assert.equal((await memberGateway(request('login','POST',{email:'a@b.test',password:'p'},signed),enabled,fetcher)).status,409);
 assert.equal(calls,0);
});
test('malformed, missing and duplicate cookies cannot authorize member reads',async()=>{
 for(const Cookie of ['', '__Host-hk_session=bad','gc_session='+ID,'__Host-hk_session='+ID+'; __Host-hk_session='+ID]){
  const r=await memberGateway(request('session','GET',undefined,{Cookie}),enabled,async()=>{throw Error('Must not contact upstream');});
  assert.equal(r.status,401);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);
 }
});
test('profile shows minimum member fields and strips backend role and private details',async()=>{
 const r=await memberGateway(request('session','GET',undefined,signed),enabled,async(url,options)=>{
  assert.equal(url,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/me');assert.deepEqual(options.headers,{Accept:'application/json',Cookie:'gc_session='+ID});return json(member);
 });
 assert.deepEqual(await r.json(),{member:{displayName:'A believer',status:'active'}});assert.equal(r.headers.get('vary'),'Cookie');
});
test('expired and restricted sessions do not load lessons',async()=>{
 for(const restricted of [false,true]){
  let calls=0;const r=await memberGateway(request('tracks','GET',undefined,signed),enabled,async(url)=>{calls++;assert.equal(url,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/me');return restricted?json({...member,user:{...member.user,status:'restricted'}}):json({error:'Expired'},401);});
  assert.equal(r.status,restricted?403:401);assert.equal(calls,1);
 }
});
test('lessons use the existing identity and exclude arbitrary upstream data',async()=>{
 let calls=0;
 const r=await memberGateway(request('tracks','GET',undefined,signed),enabled,async(url,options)=>{
  assert.equal(options.headers.Cookie,'gc_session='+ID);calls++;
  if(calls===1)return json(member);
  assert.equal(url,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/discipleship/tracks');
  return json({items:[{title:'Follow Christ',description:'Foundations',private:'excluded',lessons:[{lesson_id:8,title:'Repentance',scripture_reference:'Acts 3:19',lesson_text:'Read and reflect',reflection_question:'What will you do?',action_step:'Pray',completed:1,private:'excluded'},{lesson_id:-1,title:'Invalid'}]}]});
 });
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{items:[{title:'Follow Christ',description:'Foundations',lessons:[{id:8,title:'Repentance',scripture:'Acts 3:19',body:'Read and reflect',question:'What will you do?',action:'Pray',completed:true}]}]});
});
test('completion forwards only reflection and never invents saved progress',async()=>{
 const r=await memberGateway(request('lessons/8/complete','POST',{reflection:'I will obey',userId:999,completed:true},signed),enabled,async(url,options)=>{
  assert.equal(url,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/discipleship/lessons/8/complete');assert.deepEqual(JSON.parse(options.body),{reflection:'I will obey'});return json({completed:true});
 });
 assert.deepEqual(await r.json(),{completed:true});
 const bad=await memberGateway(request('lessons/8/complete','POST',{reflection:'x'.repeat(1201)},signed),enabled,async()=>{throw Error();});assert.equal(bad.status,400);
 const failed=await memberGateway(request('lessons/8/complete','POST',{reflection:''},signed),enabled,async()=>json({completed:false}));assert.equal(failed.status,502);
});
test('logout revokes upstream and clears the device cookie even on upstream failure',async()=>{
 for(const failed of [false,true]){
  const r=await memberGateway(request('logout','POST',{},signed),enabled,async(url,options)=>{assert.equal(url,'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/auth/logout');assert.equal(options.headers.Cookie,'gc_session='+ID);if(failed)throw Error('private');return json({ok:true});});
  assert.equal(r.status,failed?502:200);assert.match(r.headers.get('set-cookie'),/Max-Age=0/);assert.doesNotMatch(await r.text(),/private/);
 }
});
test('untrusted login cookies and upstream errors never expose sessions or internal failures',async()=>{
 for(const value of ['', 'gc_session=invalid; Path=/','different='+ID+'; Path=/']){
  const r=await memberGateway(request('login','POST',{email:'a@b.test',password:'secret'}),enabled,async()=>json({ok:true},200,{'set-cookie':value}));assert.equal(r.status,502);assert.equal(r.headers.get('set-cookie'),null);
 }
 const r=await memberGateway(request('session','GET',undefined,signed),enabled,async()=>json({error:'D1 internal private details'},500));assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/D1|private/);
});

test('disabled access still allows a same-origin local logout but rejects logout CSRF',async()=>{
 const local=await memberGateway(request('logout','POST',{},signed),{},async()=>{throw Error('No upstream when disabled');});
 assert.equal(local.status,503);assert.match(local.headers.get('set-cookie'),/Max-Age=0/);
 const cross=await memberGateway(request('logout','POST',{}, {...signed,Origin:'https://evil.test'}),{},async()=>{throw Error();});
 assert.equal(cross.status,403);assert.equal(cross.headers.get('set-cookie'),null);
});
