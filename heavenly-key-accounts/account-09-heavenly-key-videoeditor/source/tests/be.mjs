import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { onRequest } from '../functions/api/[[path]].js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
const auditIndex=db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_user_action_at'").get();
if(!auditIndex)throw Error('Missing audit event query index');
db.exec(readFileSync(new URL('../migrations/0003_audit_event_index.sql',import.meta.url),'utf8'));

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

const invalid = await request('register', { method: 'POST', body: { email: 'invalid', password: 'long enough password' } });
check('Invalid registration rejected', invalid.status === 400);
const malformedRegistration=await request('register',{method:'POST',body:{email:'malformed@example.com',password:{value:'not-a-password'}}});
check('Registration rejects non-string passwords',malformedRegistration.status===400);

const signupKey='ip:'+createHash('sha256').update('203.0.113.9').digest('hex');
for(let i=0;i<10;i++) db.prepare('INSERT INTO audit(user_id,action,at) VALUES(?,?,?)').run(signupKey,'register_ip',Date.now());
const rateLimitedSignup=await request('register',{method:'POST',headers:{'cf-connecting-ip':'203.0.113.9'},body:{email:'blocked@example.com',password:'correct horse battery'}});
check('Registration velocity limit blocks excess signups from one IP',rateLimitedSignup.status===429);
check('Rate-limited registration does not create a member',!db.prepare('SELECT 1 FROM users WHERE email=?').get('blocked@example.com'));
const created = await request('register', { method: 'POST', body: { email: 'smoke@example.com', password: 'correct horse battery' } });
check('Account registration succeeds', created.status === 200);
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

const me = await request('me', { cookie: login.cookie });
check('Authenticated identity returned', me.status === 200 && me.data?.email === 'smoke@example.com');
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
const noVoice = await request('voice-config', { cookie: login.cookie });
check('Voice configuration reports unavailable without secrets', noVoice.status === 200 && noVoice.data?.available === false);
const noVoiceRequest = await request('voice-synthesize', { method: 'POST', cookie: login.cookie, body: { text: 'Hello world', consentConfirmed: true } });
check('Unconfigured voice service returns 503', noVoiceRequest.status === 503);
const anonymousVoice = await request('voice-config');
check('Anonymous voice configuration forbidden', anonymousVoice.status === 401);

const noLengthUpload = await onRequest({
  request: new Request('https://studio.example/api/media?name=sample.png',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'image/png','x-requested-with':'hk'},
    body:Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X9uSAAAAAElFTkSuQmCC','base64'))
  }),env,params:{path:['media']}
});
check('Media supports absent content length',noLengthUpload.status===200);
const spoofedImage = await onRequest({
  request: new Request('https://studio.example/api/media?name=disguised.png',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'image/png','x-requested-with':'hk'},
    body:new Uint8Array([82,73,70,70,0,0,0,0,87,65,86,69])
  }),env,params:{path:['media']}
});
check('Rejects WAV data disguised as an image before storage',spoofedImage.status===415);
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
const brokenWav=await onRequest({
  request:new Request('https://studio.example/api/transcribe',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},body:new Uint8Array([1,2,3,4,5])
  }),env,params:{path:['transcribe']}
});
check('Malformed audio is rejected before AI usage',brokenWav.status===415);

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

console.log('RESULT', passed, '/', total);
if (passed !== total) process.exitCode = 1;
