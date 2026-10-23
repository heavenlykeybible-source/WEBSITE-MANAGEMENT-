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
const logout = await request('logout', { method: 'POST', cookie: login.cookie });
check('Logout succeeds', logout.status === 200);
const expired = await request('me', { cookie: login.cookie });
check('Logged-out session is invalid', expired.status === 401);
console.log('RESULT', passed, '/', total);
if (passed !== total) process.exitCode = 1;
