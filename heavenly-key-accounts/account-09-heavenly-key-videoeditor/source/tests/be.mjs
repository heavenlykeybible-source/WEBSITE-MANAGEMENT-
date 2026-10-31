import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { onRequest } from '../functions/api/[[path]].js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const auditIndex=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_user_action_at'").get();
if(!auditIndex)throw Error('Missing audit event query index');
db.exec(readFileSync(new URL('../migrations/0003_audit_event_index.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('../migrations/0004_session_user_expiry_index.sql',import.meta.url),'utf8'));
if(!db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sessions_user_expires'").get())throw Error('Missing session user expiry index');

const objects = new Map();
const env = {
  DB: { prepare(sql) {
    const stmt = db.prepare(sql);
    let params = [];
    const query = {
      bind(...values) { params = values; return query; },
      async first() { return stmt.get(...params) ?? null; },
      async all() { return { results: stmt.all(...params) }; },
      async run() { return { meta: { changes: Number(stmt.run(...params).changes) } }; }
    };
    return query;
  } },
  MEDIA: {
    async put(key, value) { objects.set(key, Buffer.from(await new Response(value).arrayBuffer())); },
    async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; },
    async delete(key) { objects.delete(key); }
  },
  AI: { async run() { return { text: 'hello', words: [{ word: 'hello', start: 0, end: 0.5 }] }; } }
};
let passed = 0;
let total = 0;
function check(label, condition) {
  total++;
  if (condition) passed++;
  else process.exitCode = 1;
  console.log(condition ? 'PASS' : 'FAIL', label);
}
async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  if (method !== 'GET') h['x-requested-with'] = 'hk';
  let payload;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    h['content-type'] = 'application/json';
  }
  const response = await onRequest({
    request: new Request('https://studio.example/api/' + path, { method, headers: h, body: payload }),
    env,
    params: { path: path.split('?')[0].split('/') }
  });
  const type = response.headers.get('content-type') || '';
  return { response, status: response.status, data: type.includes('json') ? await response.json() : null,
    cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}
const healthy = await request('health');
check('Health reports D1, media and AI bindings ready', healthy.status === 200 && healthy.data?.status === 'ready' && Object.keys(healthy.data).length === 1);
const missingAI = await onRequest({
  request:new Request('https://studio.example/api/health'),
  env:{...env,AI:null},
  params:{path:['health']}
});
check('Health rejects missing Workers AI without leaking resources', missingAI.status === 503 && (await missingAI.json()).status === 'degraded');
const missingStorage = await onRequest({
  request:new Request('https://studio.example/api/health'),
  env:{...env,MEDIA:null},
  params:{path:['health']}
});
check('Health rejects missing private media binding', missingStorage.status === 503);
const uninitializedSchema = await onRequest({
  request:new Request('https://studio.example/api/health'),
  env:{...env,DB:{prepare(){throw Error('no such table: users')}}},
  params:{path:['health']}
});
check('Health detects uninitialized or missing D1 schema without leaking errors',uninitializedSchema.status===503&&(await uninitializedSchema.json()).status==='degraded');

let jsonChunks = 0;
const oversizedJsonStream = new ReadableStream({
  pull(controller) {
    if (jsonChunks++ < 3) controller.enqueue(new Uint8Array(450000).fill(65));
    else controller.close();
  }
});
const oversizedJsonResponse=await onRequest({
  request:new Request('https://studio.example/api/register',{
    method:'POST',headers:{'content-type':'application/json','x-requested-with':'hk'},
    body:oversizedJsonStream,duplex:'half'
  }),env,params:{path:['register']}
});
check('Oversized unknown-length JSON is rejected before parsing',oversizedJsonResponse.status===400);
const mismatchedJsonLength = await onRequest({
  request:new Request('https://studio.example/api/register',{
    method:'POST',
    headers:{'x-requested-with':'hk','content-type':'application/json','content-length':'200'},
    body:JSON.stringify({email:'mismatch@example.com',password:'long enough password'})
  }),env,params:{path:['register']}
});
check('Declared JSON Content-Length mismatch is rejected',mismatchedJsonLength.status===400);
check('Mismatched JSON length does not create user',!db.prepare('SELECT 1 FROM users WHERE email=?').get('mismatch@example.com'));
const wrongTypeRegister = await onRequest({
  request: new Request('https://studio.example/api/register',{
    method:'POST',
    headers:{'x-requested-with':'hk','content-type':'text/plain'},
    body:JSON.stringify({email:'wrong-type@example.com',password:'long enough password'})
  }),
  env,params:{path:['register']}
});
check('Reject JSON-shaped registration sent as text/plain',wrongTypeRegister.status===400);
const unsupportedJsonBytes = await onRequest({
  request: new Request('https://studio.example/api/register',{
    method:'POST',
    headers:{'x-requested-with':'hk','content-type':'application/json'},
    body:new Uint8Array([0xff,0xfe,0xff,0xfe])
  }),
  env,params:{path:['register']}
});
check('Reject invalid UTF-8 JSON input',unsupportedJsonBytes.status===400);
const invalid = await request('register', { method: 'POST', body: { email: 'invalid', password: 'long enough password' } });
check('Invalid registration rejected', invalid.status === 400);
const malformedRegistration=await request('register',{method:'POST',body:{email:'malformed@example.com',password:{value:'not-a-password'}}});
check('Registration rejects non-string passwords',malformedRegistration.status===400);

const signupKey='ip:'+createHash('sha256').update('203.0.113.9').digest('hex');
for(let i=0;i<10;i++) db.prepare('INSERT INTO audit(user_id,action,at) VALUES(?,?,?)').run(signupKey,'register_ip_attempt',Date.now());
const rateLimitedSignup=await request('register',{method:'POST',headers:{'cf-connecting-ip':'203.0.113.9'},body:{email:'blocked@example.com',password:'correct horse battery'}});
check('Registration velocity limit blocks excess signups from one IP',rateLimitedSignup.status===429);
check('Rate-limited registration does not create a member',!db.prepare('SELECT 1 FROM users WHERE email=?').get('blocked@example.com'));
const invalidSignupIP='203.0.113.29';
for(let i=0;i<10;i++){
  const attempt=await request('register',{method:'POST',headers:{'cf-connecting-ip':invalidSignupIP},body:{email:'failed-signup@example.com',password:'another long valid password'}});
  check('Repeated signup attempt '+(i+1)+' is rejected after duplicate email',attempt.status===200&&i===0||attempt.status===409&&i>0);
}
const rejectedSignup=await request('register',{method:'POST',headers:{'cf-connecting-ip':invalidSignupIP},body:{email:'eleventh-signup@example.com',password:'another long valid password'}});
check('Atomic signup quota blocks IP after ten attempts including duplicates',rejectedSignup.status===429);

const created = await request('register', { method: 'POST', body: { email: 'smoke@example.com', password: 'correct horse battery' } });
check('Account registration succeeds', created.status === 200);
const targetedEmail='distributed-attempts@example.com';
for(let i=0;i<40;i++)db.prepare('INSERT INTO audit(user_id,action,at) VALUES(?,?,?)').run(targetedEmail,'login_attempt_account',Date.now());
const distributedLogin=await request('login',{method:'POST',headers:{'cf-connecting-ip':'203.0.113.88'},body:{email:targetedEmail,password:'not the real password'}});
check('Atomic per-account login limit rejects attempts across different IPs',distributedLogin.status===429);
const saturatedLoginIp='203.0.113.77';
const saturatedLoginKey='ip:'+createHash('sha256').update(saturatedLoginIp).digest('hex');
for(let i=0;i<100;i++) db.prepare('INSERT INTO audit(user_id,action,at) VALUES(?,?,?)').run(saturatedLoginKey,'login_attempt_ip',Date.now());
const throttledLogin=await request('login',{method:'POST',headers:{'cf-connecting-ip':saturatedLoginIp},body:{email:'smoke@example.com',password:'correct horse battery'}});
check('Atomic IP login attempt cap rejects request 101 before authentication',throttledLogin.status===429&&!throttledLogin.cookie);
const independentLoginIp=await request('login',{method:'POST',headers:{'cf-connecting-ip':'203.0.113.78'},body:{email:'smoke@example.com',password:'correct horse battery'}});
check('Login throttling is isolated by IP address',independentLoginIp.status===200&&independentLoginIp.cookie.length>5);
const login = await request('login', { method: 'POST', body: { email: 'smoke@example.com', password: 'correct horse battery' } });
check('Login creates session cookie', login.status === 200 && login.cookie.length > 5);
const failedLogin = await request('login',{method:'POST',body:{email:'smoke@example.com',password:'incorrect password'}});
check('Incorrect password is rejected without exposing a session',failedLogin.status===401&&!failedLogin.cookie);
const oversizedPassword=await request('login',{method:'POST',body:{email:'smoke@example.com',password:'a'.repeat(10000)}});
check('Oversized login passwords are rejected without creating sessions',oversizedPassword.status===401&&!oversizedPassword.cookie);
const malformedPassword=await request('login',{method:'POST',body:{email:'smoke@example.com',password:{unexpected:'object'}}});
check('Malformed login passwords are rejected safely',malformedPassword.status===401&&!malformedPassword.cookie);

const recoveredLogin = await request('login',{method:'POST',body:{email:'smoke@example.com',password:'correct horse battery'}});
check('Legitimate members can log in after an incorrect attempt',recoveredLogin.status===200&&recoveredLogin.cookie.length>5);
const sessionTestUser=db.prepare('SELECT id FROM users WHERE email=?').get('smoke@example.com').id;
const extraSession=db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)');
for(let i=0;i<25;i++)extraSession.run('old-device-session-'+i,sessionTestUser,Date.now()+3600000);
const boundedLogin=await request('login',{method:'POST',body:{email:'smoke@example.com',password:'correct horse battery'}});
const sessionCount=db.prepare('SELECT COUNT(*) c FROM sessions WHERE user_id=?').get(sessionTestUser).c;
check('Member sessions capped at twenty after login',boundedLogin.status===200&&sessionCount===20);
const originalSessionAfterPrune=await request('me',{cookie:login.cookie});
const newSessionAfterPrune=await request('me',{cookie:boundedLogin.cookie});
check('Session cap preserves original and newest real sessions',originalSessionAfterPrune.status===200&&newSessionAfterPrune.status===200);
check('Oldest device sessions removed after session cap',!db.prepare('SELECT 1 FROM sessions WHERE token_hash=?').get('old-device-session-0'));


const me = await request('me', { cookie: login.cookie });
check('Authenticated identity returned', me.status === 200 && me.data?.email === 'smoke@example.com');
const invalidCookieSuffix=await request('me',{cookie:login.cookie+'garbage'});
check('Session cookie rejects suffix appended to valid token',invalidCookieSuffix.status===401);
const invalidCookiePrefix=await request('me',{cookie:'fakehk='+login.cookie.slice(3)});
check('Session cookie rejects token embedded in another cookie name',invalidCookiePrefix.status===401);
const withOtherCookie=await request('me',{cookie:'other=test; '+login.cookie});
check('Session cookie accepts exact token after another cookie',withOtherCookie.status===200);
const invalidLogout=await request('logout',{method:'POST',cookie:login.cookie+'garbage'});
const stillSignedInAfterInvalidLogout=await request('me',{cookie:login.cookie});
check('Invalid cookie cannot log out a valid session',invalidLogout.status===200&&stillSignedInAfterInvalidLogout.status===200);

const unauthorized = await request('me');
check('Anonymous identity request rejected', unauthorized.status === 401);
const blockedOriginLogin = await request('login',{method:'POST',headers:{origin:'https://untrusted.example'},body:{email:'smoke@example.com',password:'correct horse battery'}});
check('Cross-site login requests cannot create sessions',blockedOriginLogin.status===403&&!blockedOriginLogin.cookie);
const validOriginLogin = await request('login',{method:'POST',headers:{origin:'https://studio.example'},body:{email:'smoke@example.com',password:'correct horse battery'}});
check('Same-origin member login remains allowed',validOriginLogin.status===200&&validOriginLogin.cookie.length>5);

const project = await request('projects', { method: 'POST', cookie: login.cookie, body: { name: 'Smoke test', data: { layers: [] } } });
check('Project creation succeeds', project.status === 200 && !!project.data?.id);
const projects = await request('projects', { cookie: login.cookie });
check('Project listing succeeds', projects.status === 200 && Array.isArray(projects.data));
const secondRegistered = await request('register',{method:'POST',body:{email:'other-user@example.com',password:'separate long passphrase'}});
check('A second member account can register',secondRegistered.status===200);
const secondLogin = await request('login',{method:'POST',body:{email:'other-user@example.com',password:'separate long passphrase'}});
check('A second member can authenticate',secondLogin.status===200);
const otherProject = await request('projects/'+project.data.id,{cookie:secondLogin.cookie});
check('Project data is isolated between users',otherProject.status===404);
const otherEdit = await request('projects/'+project.data.id,{method:'PUT',cookie:secondLogin.cookie,body:{name:'Unauthorized',data:{}}});
check('Members cannot edit other members projects',otherEdit.status===404);
const otherDelete = await request('projects/'+project.data.id,{method:'DELETE',cookie:secondLogin.cookie});
check('Members cannot delete other members projects',otherDelete.status===404);
const unsafeOrigin = await request('projects',{method:'POST',cookie:login.cookie,headers:{origin:'https://malicious.example'},body:{name:'Blocked',data:{}}});
check('Cross-site project modifications are rejected',unsafeOrigin.status===403);

const accountId = db.prepare('SELECT id FROM users WHERE email=?').get('smoke@example.com').id;
const seed = db.prepare('INSERT INTO projects(id,user_id,name,data,updated_at) VALUES(?,?,?,?,?)');
for(let n=1;n<200;n++) seed.run('project-seed-'+n,accountId,'Seed project','{}',Date.now());
const overflow = await request('projects',{method:'POST',cookie:login.cookie,body:{name:'Beyond limit',data:{}}});
check('Project quota rejects creation past 200',overflow.status===409);
check('Project quota retains exactly 200 records',db.prepare('SELECT COUNT(*) count FROM projects WHERE user_id=?').get(accountId).count===200);
const removed = await request('projects/'+project.data.id,{method:'DELETE',cookie:login.cookie});
check('Removing a project frees a quota slot',removed.status===200);
const afterRemoval = await request('projects',{method:'POST',cookie:login.cookie,body:{name:'Replacement',data:{}}});
check('Project creation resumes after deletion',afterRemoval.status===200);
const missingProjectDelete = await request('projects/not-a-real-project',{method:'DELETE',cookie:login.cookie});
check('Deleting a nonexistent cloud project returns 404',missingProjectDelete.status===404);

const anonymousGateway = await request('ai-connections');
check('AI accounts cannot be listed anonymously', anonymousGateway.status === 401);
const accounts = await request('ai-connections', { cookie: login.cookie });
check('Authenticated AI account list omits secrets', accounts.status === 200 && Array.isArray(accounts.data) && !JSON.stringify(accounts.data).includes('apiKey'));
const missingConnection = await request('ai-gateway', { method: 'POST', cookie: login.cookie, body: { connectionId: 'missing', task: 'chat', prompt: 'Hello there' } });
check('Unconfigured AI accounts cannot run', missingConnection.status === 400);
const invalidPrompt = await request('ai-gateway', { method: 'POST', cookie: login.cookie, body: { connectionId: 'missing', task: 'chat', prompt: 'X' } });
check('Short AI prompts rejected', invalidPrompt.status === 400);
const aiEnv={...env,AI_CONNECTIONS_JSON:JSON.stringify([{id:'test-gateway',name:'Test Gateway',provider:'openai',model:'gpt-4o-mini',apiKey:'test-secret-not-real'}])};
const aiRequest=()=>new Request('https://studio.example/api/ai-gateway',{
  method:'POST',headers:{cookie:login.cookie,'x-requested-with':'hk','content-type':'application/json'},
  body:JSON.stringify({connectionId:'test-gateway',task:'chat',prompt:'Test a safe script'})
});
const oldGatewayFetch=globalThis.fetch;
try {
  globalThis.fetch=async()=>new Response(new ReadableStream({
    pull(controller){controller.enqueue(new Uint8Array(500000));}
  }),{status:200});
  const oversizedProvider=await onRequest({request:aiRequest(),env:aiEnv,params:{path:['ai-gateway']}});
  check('Oversized external AI response rejected before JSON decoding',oversizedProvider.status===503);
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'Disguised result'}}]}),{status:200,headers:{'content-type':'text/html'}});
  const wrongProviderType=await onRequest({request:aiRequest(),env:aiEnv,params:{path:['ai-gateway']}});
  check('Successful AI provider response with HTML MIME is rejected',wrongProviderType.status===503);
  globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'Provider works'}}]}),{status:200,headers:{'content-type':'application/json'}});
  const normalProvider=await onRequest({request:aiRequest(),env:aiEnv,params:{path:['ai-gateway']}});
  check('Bounded external AI response still succeeds',normalProvider.status===200&&(await normalProvider.json()).result==='Provider works');
} finally {globalThis.fetch=oldGatewayFetch;}
const recordedAIAttempts=db.prepare("SELECT COUNT(*) count FROM audit WHERE user_id=? AND action='ai_gateway_attempt'").get(accountId).count;
check('Failed external AI calls count towards daily attempt limit',recordedAIAttempts===3);
for(let i=recordedAIAttempts;i<60;i++)db.prepare("INSERT INTO audit(user_id,action,at) VALUES(?,?,?)").run(accountId,'ai_gateway_attempt',Date.now());
const gatewayLimit=await onRequest({request:aiRequest(),env:aiEnv,params:{path:['ai-gateway']}});
check('External AI gateway blocks excess attempted calls before provider dispatch',gatewayLimit.status===429);
const aiToolsNormal=await request('ai-tools',{method:'POST',cookie:login.cookie,body:{task:'summary',text:'Create a meaningful summary of the supplied content.'}});
check('AI tools consume one reserved request before provider execution',aiToolsNormal.status===200&&db.prepare("SELECT COUNT(*) c FROM audit WHERE user_id=? AND action='ai_tools_attempt'").get(accountId).c===1);
const failedAiTools=await onRequest({
  request:new Request('https://studio.example/api/ai-tools',{method:'POST',headers:{cookie:login.cookie,'content-type':'application/json','x-requested-with':'hk'},body:JSON.stringify({task:'summary',text:'Summarize this test input.'})}),
  env:{...env,AI:{run:async()=>{throw Error('Simulated provider outage')}}},params:{path:['ai-tools']}
});
check('Failed AI tools provider call still consumes one reserved attempt',failedAiTools.status===500&&db.prepare("SELECT COUNT(*) c FROM audit WHERE user_id=? AND action='ai_tools_attempt'").get(accountId).c===2);
for(let i=2;i<30;i++)db.prepare("INSERT INTO audit(user_id,action,at) VALUES(?,?,?)").run(accountId,'ai_tools_attempt',Date.now());
const aiToolsFull=await request('ai-tools',{method:'POST',cookie:login.cookie,body:{task:'summary',text:'Create a meaningful summary of the supplied content.'}});
check('AI tools atomically enforce thirty attempted requests daily',aiToolsFull.status===429);
const noVoice = await request('voice-config', { cookie: login.cookie });
check('Voice configuration reports unavailable without secrets', noVoice.status === 200 && noVoice.data?.available === false);
const noVoiceRequest = await request('voice-synthesize', { method: 'POST', cookie: login.cookie, body: { text: 'Hello world', consentConfirmed: true } });
check('Unconfigured voice service returns 503', noVoiceRequest.status === 503);
const originalFetch=globalThis.fetch;
try {
  globalThis.fetch=async()=>new Response(new ReadableStream({
    start(controller) {
      for(let i=0;i<6;i++) controller.enqueue(new Uint8Array(1024*1024));
      controller.close();
    }
  }),{status:200});
  const tooLargeVoice=await onRequest({
    request:new Request('https://studio.example/api/voice-synthesize',{
      method:'POST',
      headers:{cookie:login.cookie,'content-type':'application/json','x-requested-with':'hk'},
      body:JSON.stringify({text:'Authorized test text',consentConfirmed:true})
    }),
    env:{...env,VOICE_TTS_API_KEY:'test-only',VOICE_TTS_VOICE_ID:'test-voice'},
    params:{path:['voice-synthesize']}
  });
  check('Oversized synthesized audio is rejected while streaming',tooLargeVoice.status===413);
  globalThis.fetch=async()=>new Response(new TextEncoder().encode('<html>fake audio response</html>'),{status:200,headers:{'content-type':'audio/mpeg'}});
  const invalidVoice=await onRequest({
    request:new Request('https://studio.example/api/voice-synthesize',{
      method:'POST',headers:{cookie:login.cookie,'content-type':'application/json','x-requested-with':'hk'},
      body:JSON.stringify({text:'Authorized test text',consentConfirmed:true})
    }),
    env:{...env,VOICE_TTS_API_KEY:'test-only',VOICE_TTS_VOICE_ID:'test-voice'},
    params:{path:['voice-synthesize']}
  });
  check('Voice provider HTML masquerading as MP3 is rejected',invalidVoice.status===502);
} finally { globalThis.fetch=originalFetch; }
const countedVoiceAttempts=db.prepare("SELECT COUNT(*) c FROM audit WHERE user_id=? AND action='voice_synthesize_attempt'").get(accountId).c;
check('Failed voice provider responses consume reserved attempts',countedVoiceAttempts===2);
for(let i=countedVoiceAttempts;i<10;i++)db.prepare("INSERT INTO audit(user_id,action,at) VALUES(?,?,?)").run(accountId,'voice_synthesize_attempt',Date.now());
const voiceRateLimited=await onRequest({
  request:new Request('https://studio.example/api/voice-synthesize',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'application/json','x-requested-with':'hk'},
    body:JSON.stringify({text:'Authorized sample',consentConfirmed:true})
  }),
  env:{...env,VOICE_TTS_API_KEY:'test-only',VOICE_TTS_VOICE_ID:'test-voice'},
  params:{path:['voice-synthesize']}
});
check('Voice synthesis quota blocks attempt eleven',voiceRateLimited.status===429);
const anonymousVoice = await request('voice-config');
check('Anonymous voice configuration forbidden', anonymousVoice.status === 401);

const noLengthUpload = await onRequest({
  request: new Request('https://studio.example/api/media?name=sample.png',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'image/png','x-requested-with':'hk'},
    body:Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X9uSAAAAAElFTkSuQmCC','base64'))
  }),env,params:{path:['media']}
});
check('Media supports absent content length',noLengthUpload.status===200);
for (const [label, payload] of [
  ['Truncated GIF header',new TextEncoder().encode('GIF89a')],
  ['Zero-width GIF',Uint8Array.from([71,73,70,56,57,97,0,0,1,0,128,0,0])],
  ['Excessive GIF dimensions',Uint8Array.from([71,73,70,56,57,97,255,255,255,255,128,0,0])]
]) {
  const gifResponse=await onRequest({
    request:new Request('https://studio.example/api/media?name=invalid.gif',{
      method:'POST',headers:{cookie:login.cookie,'content-type':'image/gif','x-requested-with':'hk'},body:payload
    }),env,params:{path:['media']}
  });
  check('Invalid GIF rejected: '+label,gifResponse.status===415);
}
const sampleWebP=Uint8Array.from(Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAkA4JaACdLoB+AADsAD+8JtD/yC0rlvAH/8SF+JC/Ehf+LmAAAA=','base64'));
for (const [label, payload, expected] of [
  ['Valid WebP container',sampleWebP,200],
  ['Truncated WebP header',sampleWebP.slice(0,12),415],
  ['Incorrect WebP RIFF size',Uint8Array.from(sampleWebP.map((n,i)=>i===4?13:n)),415],
  ['Unsupported WebP chunk',Uint8Array.from(sampleWebP.map((n,i)=>i===12?88:n)),415],
  ['WebP chunk exceeding file',Uint8Array.from(sampleWebP.map((n,i)=>i===16?240:n)),415],
  ['WebP frame signature mismatch',Uint8Array.from(sampleWebP.map((n,i)=>i===23?0:n)),415],
  ['Zero WebP image width',Uint8Array.from(sampleWebP.map((n,i)=>i===26||i===27?0:n)),415]
]) {
  const response=await onRequest({
    request:new Request('https://studio.example/api/media?name=example.webp',{
      method:'POST',headers:{cookie:login.cookie,'content-type':'image/webp','x-requested-with':'hk'},body:payload
    }),env,params:{path:['media']}
  });
  check('WebP container validation: '+label,response.status===expected);
  if(response.status===200){
    const saved=await response.json();
    const deleted=await request('media/'+saved.id,{method:'DELETE',cookie:login.cookie});
    check('WebP test media can be deleted',deleted.status===200);
  }
}
const sampleJpeg=Uint8Array.from(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAABv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJoA2EX/2Q==','base64'));
const sofIndex=sampleJpeg.findIndex((byte,i)=>byte===255&&sampleJpeg[i+1]===192);
if(sofIndex<0)throw Error('JPEG regression fixture missing baseline frame');
const invalidWidth=sampleJpeg.slice();invalidWidth[sofIndex+7]=0;invalidWidth[sofIndex+8]=0;
const excessiveJpeg=sampleJpeg.slice();for(const i of [sofIndex+5,sofIndex+7]){excessiveJpeg[i]=63;excessiveJpeg[i+1]=255;}
for(const [label,payload,expected] of [
  ['Real 1x1 baseline JPEG',sampleJpeg,200],
  ['Truncated JPEG signature',Uint8Array.from([255,216,255]),415],
  ['JPEG cut off after frame header',sampleJpeg.slice(0,sofIndex+12),415],
  ['JPEG missing end-of-image marker',sampleJpeg.slice(0,-2),415],
  ['Zero JPEG frame width',invalidWidth,415],
  ['Oversized JPEG frame dimensions',excessiveJpeg,415]
]){
  const response=await onRequest({
    request:new Request('https://studio.example/api/media?name=image.jpg',{
      method:'POST',headers:{cookie:login.cookie,'content-type':'image/jpeg','x-requested-with':'hk'},body:payload
    }),env,params:{path:['media']}
  });
  check('JPEG frame validation: '+label,response.status===expected);
  if(response.status===200){
    const saved=await response.json();
    const removed=await request('media/'+saved.id,{method:'DELETE',cookie:login.cookie});
    check('JPEG test media can be deleted',removed.status===200);
  }
}
const spoofedImage = await onRequest({
  request: new Request('https://studio.example/api/media?name=disguised.png',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'image/png','x-requested-with':'hk'},
    body:new Uint8Array([82,73,70,70,0,0,0,0,87,65,86,69])
  }),env,params:{path:['media']}
});
check('Rejects WAV data disguised as an image before storage',spoofedImage.status===415);
const hugePng = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X9uSAAAAAElFTkSuQmCC','base64'));
hugePng.set([0,0,64,0,0,0,64,0],16);
const excessiveDimensions=await onRequest({
  request:new Request('https://studio.example/api/media?name=oversized.png',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'image/png','x-requested-with':'hk'},body:hugePng
  }),env,params:{path:['media']}
});
check('PNG decompression bomb dimensions rejected before storage',excessiveDimensions.status===415);

let uploadChunks=0;
const unboundedUpload = new ReadableStream({
  pull(controller) {
    if (uploadChunks++ < 51) controller.enqueue(new Uint8Array(1024 * 1024));
    else controller.close();
  }
});
const rejectedOversize = await onRequest({
  request:new Request('https://studio.example/api/media?name=oversize.png',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'image/png','x-requested-with':'hk'},
    body:unboundedUpload,duplex:'half'
  }),env,params:{path:['media']}
});
check('Unknown-length upload exceeding 50 MB is rejected while streaming',rejectedOversize.status===413);
const mediaCreated = await noLengthUpload.json();
const otherMediaRead = await request('media/'+mediaCreated.id,{cookie:secondLogin.cookie});
check('Members cannot read another member media',otherMediaRead.status===404);
const otherMediaDelete = await request('media/'+mediaCreated.id,{method:'DELETE',cookie:secondLogin.cookie});
check('Members cannot delete another member media',otherMediaDelete.status===404);

const deletedMedia = await request('media/'+mediaCreated.id,{method:'DELETE',cookie:login.cookie});
check('Media deletion succeeds for owned file',deletedMedia.status===200);
const repeatedMediaDelete = await request('media/'+mediaCreated.id,{method:'DELETE',cookie:login.cookie});
check('Repeated media deletion reports not found',repeatedMediaDelete.status===404);
const storageAfterDelete = await request('media',{cookie:login.cookie});
check('Media deletion returns storage quota',storageAfterDelete.status===200&&storageAfterDelete.data.used===0);

const validWav=(()=>{
  const bytes=new Uint8Array(46),dv=new DataView(bytes.buffer);
  const put=(index,str)=>{for(let j=0;j<str.length;j++)bytes[index+j]=str.charCodeAt(j)};
  put(0,'RIFF');dv.setUint32(4,38,true);put(8,'WAVEfmt ');dv.setUint32(16,16,true);
  dv.setUint16(20,1,true);dv.setUint16(22,1,true);dv.setUint32(24,16000,true);
  dv.setUint32(28,32000,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);
  put(36,'data');dv.setUint32(40,2,true);
  return bytes;
})();
const noLengthWav = await onRequest({
  request: new Request('https://studio.example/api/transcribe',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},
    body:validWav
  }),env,params:{path:['transcribe']}
});
check('Transcription supports absent content length',noLengthWav.status===200);
const providerOutput=await onRequest({
 request:new Request('https://studio.example/api/transcribe',{method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},body:validWav}),
 env:{...env,AI:{run:async()=>({text:'x'.repeat(15000),words:Array.from({length:2100},(_,i)=>({word:'w'.repeat(200),start:i,end:i+1}))})}},
 params:{path:['transcribe']}
});
const boundedProviderOutput=await providerOutput.json();
check('Oversized Whisper output is bounded',providerOutput.status===200&&boundedProviderOutput.text.length===12000&&boundedProviderOutput.words.length===2000&&boundedProviderOutput.words[0].word.length===160);
const oddProviderOutput=await onRequest({
 request:new Request('https://studio.example/api/transcribe',{method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},body:validWav}),
 env:{...env,AI:{run:async()=>({text:42,words:[null,{word:'invalid',start:-1,end:1},{word:'valid',start:0,end:1}]})}},
 params:{path:['transcribe']}
});
const oddTranscription=await oddProviderOutput.json();
check('Invalid Whisper word timestamps safely removed',oddProviderOutput.status===200&&oddTranscription.text==='42'&&oddTranscription.words.length===1&&oddTranscription.words[0].word==='valid');


for (const [label, mutate] of [
  ['RIFF length mismatch', b => new DataView(b.buffer).setUint32(4,999,true)],
  ['Payload declares more audio than present', b => new DataView(b.buffer).setUint32(40,999,true)],
  ['Unsupported WAV encoding', b => new DataView(b.buffer).setUint16(20,3,true)],
  ['Invalid WAV sample rate', b => new DataView(b.buffer).setUint32(24,0,true)],
  ['Invalid WAV block alignment', b => new DataView(b.buffer).setUint16(32,0,true)]
]) {
  const altered = validWav.slice();
  mutate(altered);
  const response = await onRequest({
    request:new Request('https://studio.example/api/transcribe',{
      method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},
      body:altered
    }),env,params:{path:['transcribe']}
  });
  check('Malformed WAV rejected: '+label,response.status===415);
}
let wavChunkCount=0;
const oversizedWavStream=new ReadableStream({
  pull(controller){
    if(wavChunkCount++<4) controller.enqueue(new Uint8Array(1024*1024));
    else controller.close();
  }
});
const oversizedTranscription=await onRequest({
  request:new Request('https://studio.example/api/transcribe',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},
    body:oversizedWavStream,duplex:'half'
  }),env,params:{path:['transcribe']}
});
check('Oversized WAV with no Content-Length rejected while streaming',oversizedTranscription.status===413);
const brokenWav=await onRequest({
  request:new Request('https://studio.example/api/transcribe',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},body:new Uint8Array([1,2,3,4,5])
  }),env,params:{path:['transcribe']}
});
check('Malformed audio is rejected before AI usage',brokenWav.status===415);

check('Validated transcription requests reserve three attempted AI operations',db.prepare("SELECT COUNT(*) c FROM audit WHERE user_id=? AND action='transcribe_attempt'").get(accountId).c===3);
const failedTranscription=await onRequest({
  request:new Request('https://studio.example/api/transcribe',{method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},body:validWav}),
  env:{...env,AI:{run:async()=>{throw Error('Simulated transcription outage')}}},params:{path:['transcribe']}
});
check('Failed transcription provider still consumes one reserved attempt',failedTranscription.status===500&&db.prepare("SELECT COUNT(*) c FROM audit WHERE user_id=? AND action='transcribe_attempt'").get(accountId).c===4);
for(let i=4;i<120;i++)db.prepare("INSERT INTO audit(user_id,action,at) VALUES(?,?,?)").run(accountId,'transcribe_attempt',Date.now());
const tooManyTranscriptions=await onRequest({
  request:new Request('https://studio.example/api/transcribe',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},body:validWav
  }),env,params:{path:['transcribe']}
});
check('Audio transcription atomically caps 120 attempted operations per day',tooManyTranscriptions.status===429);
const logout = await request('logout', { method: 'POST', cookie: login.cookie });
check('Logout succeeds', logout.status === 200);
const expired = await request('me', { cookie: login.cookie });
check('Logged-out session is invalid', expired.status === 401);
const stillSignedIn = await request('me',{cookie:recoveredLogin.cookie});
check('Logging out one device does not sign out another valid session',stillSignedIn.status===200&&stillSignedIn.data?.email==='smoke@example.com');
const secondLogout=await request('logout',{method:'POST',cookie:recoveredLogin.cookie});
check('Other device can sign out independently',secondLogout.status===200);
const secondExpired=await request('me',{cookie:recoveredLogin.cookie});
check('Other device session is revoked after its own logout',secondExpired.status===401);

const revokerLogin1=await request('login',{method:'POST',body:{email:'smoke@example.com',password:'correct horse battery'}});
const revokerLogin2=await request('login',{method:'POST',body:{email:'smoke@example.com',password:'correct horse battery'}});
check('Session revocation test has two active devices',revokerLogin1.status===200&&revokerLogin2.status===200);
const rejectedRevoke=await request('logout-all',{method:'POST',cookie:revokerLogin1.cookie,body:{password:'incorrect password'}});
const stillAuthorized=await request('me',{cookie:revokerLogin2.cookie});
check('Incorrect logout-all confirmation preserves existing devices',rejectedRevoke.status===401&&stillAuthorized.status===200);
const confirmedRevoke=await request('logout-all',{method:'POST',cookie:revokerLogin1.cookie,body:{password:'correct horse battery'}});
const deviceOneExpired=await request('me',{cookie:revokerLogin1.cookie});
const deviceTwoExpired=await request('me',{cookie:revokerLogin2.cookie});
const otherMemberUnaffected=await request('me',{cookie:secondLogin.cookie});
check('Confirmed logout-all revokes every active session and clears cookie',confirmedRevoke.status===200&&confirmedRevoke.response.headers.get('set-cookie')?.includes('Max-Age=0')&&deviceOneExpired.status===401&&deviceTwoExpired.status===401);
check('Account-wide session revocation does not affect another member',otherMemberUnaffected.status===200);
console.log('RESULT', passed, '/', total);
if (passed !== total) process.exitCode = 1;
