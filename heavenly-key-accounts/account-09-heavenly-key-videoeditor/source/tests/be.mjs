import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../functions/api/[[path]].js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
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
const invalid = await request('register', { method: 'POST', body: { email: 'invalid', password: 'long enough password' } });
check('Invalid registration rejected', invalid.status === 400);
const created = await request('register', { method: 'POST', body: { email: 'smoke@example.com', password: 'correct horse battery' } });
check('Account registration succeeds', created.status === 200);
const login = await request('login', { method: 'POST', body: { email: 'smoke@example.com', password: 'correct horse battery' } });
check('Login creates session cookie', login.status === 200 && login.cookie.length > 5);
const me = await request('me', { cookie: login.cookie });
check('Authenticated identity returned', me.status === 200 && me.data?.email === 'smoke@example.com');
const unauthorized = await request('me');
check('Anonymous identity request rejected', unauthorized.status === 401);
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
    body:new Uint8Array([1,2,3,4,5])
  }),env,params:{path:['media']}
});
check('Media supports absent content length',noLengthUpload.status===200);
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

const noLengthWav = await onRequest({
  request: new Request('https://studio.example/api/transcribe',{
    method:'POST',headers:{cookie:login.cookie,'content-type':'audio/wav','x-requested-with':'hk'},
    body:new Uint8Array([1,2,3,4,5])
  }),env,params:{path:['transcribe']}
});
check('Transcription supports absent content length',noLengthWav.status===200);
const logout = await request('logout', { method: 'POST', cookie: login.cookie });
check('Logout succeeds', logout.status === 200);
const expired = await request('me', { cookie: login.cookie });
check('Logged-out session is invalid', expired.status === 401);
console.log('RESULT', passed, '/', total);
if (passed !== total) process.exitCode = 1;
