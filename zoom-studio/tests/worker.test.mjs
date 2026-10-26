// Backend self-test. Run: node tests/worker.test.mjs   (Node 22 or newer)
// Uses in-memory stand-ins for Cloudflare KV and D1, so it needs no account and no network.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import crypto from 'node:crypto'; import { DatabaseSync } from 'node:sqlite';
const here = new URL('.', import.meta.url).pathname;
fs.writeFileSync(here + '_worker_under_test.mjs', fs.readFileSync(here + '../site/_worker.js'));
const worker = (await import(here + '_worker_under_test.mjs')).default;

class KV { constructor() { this.m = new Map(); }
  async get(k) { return this.m.has(k) ? this.m.get(k).v : null; }
  async put(k, v, o) { this.m.set(k, { v, meta: o && o.metadata }); }
  async delete(k) { this.m.delete(k); }
  async list({ prefix = '', limit = 1000 } = {}) { const keys = [...this.m.keys()].filter(k => k.startsWith(prefix)).sort().slice(0, limit).map(name => ({ name, metadata: this.m.get(name).meta })); return { keys, list_complete: true }; } }
class D1 { constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { const db = this.db, mk = (args) => ({ bind: (...a) => mk(a), first: async () => { const r = db.prepare(sql).get(...args); return r ? { ...r } : null; }, all: async () => ({ results: db.prepare(sql).all(...args).map(r => ({ ...r })) }), run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; } }); return mk([]); }
  async batch(st) { this.db.exec('BEGIN'); try { for (const s of st) await s.run(); this.db.exec('COMMIT'); } catch (e) { this.db.exec('ROLLBACK'); throw e; } return []; } }
const schema = fs.readFileSync(here + '../server/schema.sql', 'utf8');
const teamdb = new D1(); teamdb.db.exec(schema);
const env = { MEETINGSPACE_PRIVATE_PREVIEW: '0', TEAMDB: teamdb, AUTH_SECRET: 'a'.repeat(40), RELAY_SECRET: 'r'.repeat(40), RELAY_URL: 'wss://relay.test', CURRENCY: 'NGN', ADMIN_EMAILS: '', PAYSTACK_SECRET: 'sk_test_x', ASSETS: { fetch: async () => new Response('asset') } };

let pass = 0, fail = 0, ipn = 0;
// the browser stretches the password before sending it; the test uses a stand-in with the same shape (64 hex characters)
const st_ = (e, p) => crypto.createHash('sha256').update('t:' + e.toLowerCase() + p).digest('hex');
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL:', m); } };
async function call(path, { body, token, method, headers } = {}) {
  const r = await worker.fetch(new Request('https://studio.test' + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.' + (headers && headers.ip || ++ipn), ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), env);
  let j = null; try { j = await r.clone().json(); } catch {} return { s: r.status, j, r };
}
const signup = async (e) => { const r = await call('/api/signup', { body: { email: e, password: st_(e, 'password123'), agree: true } }); return r.j && r.j.token; };

// Restricted preview: public signup is closed, and unapproved accounts cannot log in.
env.MEETINGSPACE_PRIVATE_PREVIEW = '1';
ok((await call('/api/signup', { body: { email: 'blocked@test.com', password: st_('blocked@test.com', 'password123'), agree: true } })).s === 403, 'private preview blocks public signup');
env.MEETINGSPACE_PRIVATE_PREVIEW = '0';
// accounts
ok((await call('/api/plans')).j.plans.length === 3, 'plans listed');
ok((await call('/api/signup', { body: { email: 'x@test.com', password: st_('x@test.com', 'password123') } })).s === 400, 'sign-up needs consent');
const A = await signup('a@test.com'), B = await signup('b@test.com'), C = await signup('c@test.com'), O = await signup('owner@test.com');
ok(A && B && C && O, 'sign-ups work');
env.ADMIN_EMAILS = 'owner@test.com';
ok((await call('/api/signup', { body: { email: 'a@test.com', password: st_('a@test.com', 'password123'), agree: true } })).s === 409, 'duplicate email refused');
ok((await call('/api/login', { body: { email: 'a@test.com', password: st_('a@test.com', 'wrongpass1') } })).s === 401, 'wrong password refused');
ok((await call('/api/login', { body: { email: 'a@test.com', password: st_('a@test.com', 'password123') } })).j.token, 'login works');
ok((await call('/api/me', { token: A })).j.verified === true, 'auto-confirmed without email service');
ok((await call('/api/me')).s === 401, 'no token refused');
ok((await call('/api/relay-token', { token: A })).s === 402, 'no plan, no relay pass');
// a verification-style token must not work as a login
const forged = await (async () => { const enc = new TextEncoder(); const p = Buffer.from(JSON.stringify({ e: 'a@test.com', k: 'v', exp: Date.now() + 1e6 })).toString('base64url'); const k = await crypto.subtle.importKey('raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const sg = Buffer.from(await crypto.subtle.sign('HMAC', k, enc.encode(p))).toString('hex'); return p + '.' + sg; })();
ok((await call('/api/me', { token: forged })).s === 401, 'purpose tokens cannot be used to log in');
// admin and plan time
ok((await call('/api/admin/stats', { token: A })).s === 403, 'non-admin refused');
ok((await call('/api/admin/grant', { token: O, body: { email: 'a@test.com', days: 7 } })).j.ok, 'admin grants days');
const rt = await call('/api/relay-token', { token: A }); ok(rt.s === 200 && rt.j.token.includes('.') && rt.j.url === 'wss://relay.test', 'relay pass with plan');
const st = await call('/api/admin/stats', { token: O }); ok(st.j.users === 4 && st.j.active === 1, 'admin stats count users and active plans');
// payments webhook
const body = JSON.stringify({ event: 'charge.success', data: { status: 'success', amount: 50000, currency: 'NGN', reference: 'ref12345', metadata: { plan: 'day', user: 'b@test.com' } } });
const sig = crypto.createHmac('sha512', 'sk_test_x').update(body).digest('hex');
const hook = (s) => worker.fetch(new Request('https://studio.test/api/pay/webhook', { method: 'POST', headers: { 'x-paystack-signature': s }, body }), env);
ok((await hook('bad')).status === 401, 'bad webhook signature refused');
await hook(sig); await hook(sig);
const bm = (await call('/api/me', { token: B })).j; ok(bm.active && bm.paidUntil - Date.now() < 864e5 + 5000, 'webhook grants exactly one day, once');

ok((await call('/api/signup', { body: { email: 'raw@test.com', password: 'password123', agree: true } })).s === 400, 'unstretched passwords are refused');
const ul = await call('/api/admin/users?q=a', { token: O }); ok(ul.j.users.some(u => u.email === 'a@test.com' && u.pu > Date.now()), 'admin user list shows plan time');
ok((await call('/api/admin/stats', { token: O })).j.revenue.all === 500, 'admin revenue counts the webhook payment');
// groups
const tc = await call('/api/team/create', { token: A, body: { name: 'Prayer Team' } }); const T = tc.j.id; ok(T, 'leader creates a group');
ok((await call('/api/teams', { token: A })).j.teams[0].role === 'leader', 'leader sees the group');
const inv = await call('/api/team/invite', { token: A, body: { team: T } }); ok(inv.j.url.includes('?join='), 'invite link made');
ok((await call('/api/team/invite', { token: B, body: { team: T } })).s === 403, 'non-members cannot invite');
const code = inv.j.code;
ok((await call('/api/team/join?code='+code,{token:B})).s===405,'GET cannot mutate group membership');
ok((await call('/api/team/invite-preview?code='+code,{token:B,method:'POST'})).s===405,'POST cannot bypass read-only preview');
const groupInvitePreview = await call('/api/team/invite-preview?code=' + code, { token: B });
ok(groupInvitePreview.s === 200 && groupInvitePreview.j.group.id === T && groupInvitePreview.j.joined === false, 'invite preview reveals group without joining');
ok((await call('/api/team/members?team=' + T, { token: A })).j.members.length === 1, 'preview does not enroll participant');
ok((await call('/api/team/invite-preview?code=bad', { token: B })).s === 400, 'malformed invite preview refused');
ok((await call('/api/team/join', { token: B, body: { code: 'invalid-code' } })).s === 400, 'malformed join code refused');
ok((await call('/api/team/join', { token: B, body: { code } })).j.team.id === T, 'member joins by invite');
ok((await call('/api/team/invite-preview?code=' + code, { token: B })).j.joined === true, 'preview identifies existing member');
ok((await call('/api/team/join', { token: C, body: { code } })).j.team.id === T, 'second member joins');
ok((await call('/api/team/join', { token: C, body: { code: 'ffffffffffff' } })).s === 400, 'bad invite refused');
const ml = await call('/api/team/members?team=' + T, { token: A }); ok(ml.j.members.length === 3 && ml.j.members.every(m => m.email), 'leader sees member emails');
const mb = await call('/api/team/members?team=' + T, { token: B }); ok(mb.j.members.every(m => m.email === undefined), 'members do not see emails');
await call('/api/team/send', { token: B, body: { team: T, text: 'Hello team' } });
await call('/api/team/send', { token: B, body: { team: T, text: 'Fake announcement', kind: 'announce' } });
await call('/api/team/send', { token: A, body: { team: T, text: 'Real announcement', kind: 'announce' } });
const msgs = (await call('/api/team/messages?team=' + T + '&since=0', { token: B })).j;
ok(msgs.m.some(x => x.t === 'Hello team' && x.s === 'me'), 'chat messages arrive');
ok(msgs.m.find(x => x.t === 'Fake announcement').k === 'msg', 'members cannot post announcements');
ok(msgs.m.find(x => x.t === 'Real announcement').k === 'announce', 'leader announcements work');
ok(!JSON.stringify(msgs).includes('@test.com'), 'message list never exposes emails');
const inc = (await call('/api/team/messages?team=' + T + '&since=' + msgs.last, { token: B })).j; ok(inc.m.length === 0, 'polling returns nothing new');
let flood = 0; for (let i = 0; i < 8; i++) if ((await call('/api/team/send', { token: C, body: { team: T, text: 'spam ' + i } })).s === 429) flood++; ok(flood >= 1, 'message flood is slowed');
const D = await signup('d@test.com'); ok((await call('/api/team/messages?team=' + T, { token: D })).s === 403, 'outsiders cannot read a group');
ok((await call('/api/team/role', { token: B, body: { team: T, email: 'c@test.com', role: 'admin' } })).s === 403, 'members cannot change roles');
await call('/api/team/role', { token: A, body: { team: T, email: 'b@test.com', role: 'admin' } });
ok((await call('/api/team/remove', { token: B, body: { team: T, email: 'a@test.com' } })).s === 400, 'admin cannot remove the leader');

// meetings and follow-up
await call('/api/team/role', { token: A, body: { team: T, email: 'c@test.com', role: 'admin' } });
ok((await call('/api/team/meeting/start', { token: C, body: { team: T, title: 'x', link: 'https://studio.test/join.html?relay=wss%3A%2F%2Frelay.test&r=abc&k=def&a=1' } })).s === 402, 'hosting needs a plan');
await call('/api/team/role', { token: A, body: { team: T, email: 'c@test.com', role: 'member' } });
const m1 = await call('/api/team/meeting/start', { token: A, body: { team: T, title: 'Sunday meeting', link: 'https://studio.test/join.html?relay=wss%3A%2F%2Frelay.test&r=abc&k=def&a=1' } }); ok(m1.j.id, 'leader starts a meeting');
ok((await call('/api/team/meeting/join', { token: D, body: { meeting: m1.j.id } })).s === 403, 'outsiders cannot join a meeting');
const j1 = await call('/api/team/meeting/join', { token: B, body: { meeting: m1.j.id } }); ok(j1.j.link.includes('&a=1'), 'member gets the meeting link');
const r1 = await call('/api/team/meeting/report?meeting=' + m1.j.id, { token: A });
ok(r1.j.attended.length === 1 && r1.j.attended[0].first === 1, 'first-time attendee is marked new');
ok(r1.j.absent.length === 2, 'absent members are listed');
ok((await call('/api/team/meeting/report?meeting=' + m1.j.id, { token: C })).s === 403, 'members cannot see the report');
const followup = await call('/api/team/followup', { token: A, body: { meeting: m1.j.id, audience: 'absent', text: 'We missed you', email: true } });
ok(followup.j.people === 2, 'follow-up identifies absent members');
ok(followup.j.emailed === 0, 'outbound follow-up emails are disabled unless explicitly configured');
await call('/api/team/meeting/end', { token: A, body: { meeting: m1.j.id } });
ok((await call('/api/team/meeting/join', { token: C, body: { meeting: m1.j.id } })).s === 400, 'ended meetings cannot be joined');
const m2 = await call('/api/team/meeting/start', { token: A, body: { team: T, title: 'Midweek', link: 'https://studio.test/join.html?relay=wss%3A%2F%2Frelay.test&r=abc2&k=def2&a=1' } });
await call('/api/team/meeting/join', { token: B, body: { meeting: m2.j.id } }); await call('/api/team/meeting/join', { token: C, body: { meeting: m2.j.id } });
const r2 = (await call('/api/team/meeting/report?meeting=' + m2.j.id, { token: A })).j;
ok(r2.attended.find(x => x.name === 'b').first === 0 && r2.attended.find(x => x.name === 'c').first === 1, 'returning and new attendees told apart');

// programs and public pages
const pr = await call('/api/program/save', { token: A, body: { title: '</script><script>alert(1)</script>', descr: '<img src=x onerror=alert(1)>', start: Date.now() + 864e5, watch: 'javascript:alert(1)' } });
ok(pr.j.id && pr.j.url.includes('/p/'), 'program saved');
const pg = await (await worker.fetch(new Request('https://studio.test/p/' + pr.j.id), env)).text();
ok(!pg.includes('</script><script>alert') && !pg.includes('<img src=x') && !pg.includes('javascript:'), 'program page is safe from script injection');
ok(pg.includes('og:title'), 'program page has share preview tags');
ok((await call('/api/program/delete', { token: B, body: { id: pr.j.id } })).j.ok && (await call('/api/programs', { token: A })).j.programs.length === 1, 'others cannot delete a program');

// sessions and account rights
await call('/api/logout-all', { token: C, body: {} }); ok((await call('/api/me', { token: C })).s === 401, 'log out of all devices cancels old logins');
const ex = await call('/api/account/export', { token: B }); ok(ex.j.groups.length === 1 && ex.j.email === 'b@test.com', 'data export includes groups');
ok((await call('/api/account/delete', { token: B, body: { password: st_('b@test.com', 'nope') } })).s === 401, 'delete needs the password');
ok((await call('/api/account/delete', { token: B, body: { password: st_('b@test.com', 'password123') } })).j.ok, 'account deleted');
ok((await call('/api/login', { body: { email: 'b@test.com', password: st_('b@test.com', 'password123') } })).s === 401, 'deleted account cannot log in');
const after = (await call('/api/team/messages?team=' + T + '&since=0', { token: A })).j.m;
ok(after.some(x => x.n === 'Deleted user') && !after.some(x => x.n === 'b'), 'deleted users are anonymised in group history');
ok((await call('/api/team/members?team=' + T, { token: A })).j.members.length === 2, 'deleted users leave the group');
const dl = await call('/api/account/delete', { token: A, body: { password: st_('a@test.com', 'password123') } }); ok(dl.j.ok, 'leader deletes account');
ok(teamdb.db.prepare('SELECT COUNT(*) n FROM teams').get().n === 0, 'groups led by a deleted account are removed');

// retention: little is kept for long
const sql = (q, ...a) => teamdb.db.prepare(q).all(...a), count = (q, ...a) => Object.values(sql(q, ...a)[0])[0];
const DAY = 864e5, NOW = Date.now();
const E = await signup('e@test.com'), F = await signup('f@test.com');
await call('/api/admin/grant', { token: O, body: { email: 'e@test.com', days: 7 } });
const kt = (await call('/api/team/create', { token: E, body: { name: 'Keep Short' } })).j.id;
await call('/api/team/join', { token: F, body: { code: (await call('/api/team/invite', { token: E, body: { team: kt } })).j.code } });
ok((await call('/api/team/ttl', { token: F, body: { team: kt, days: 1 } })).s === 403, 'only the leader sets message lifetime');
ok((await call('/api/team/ttl', { token: E, body: { team: kt, days: 1 } })).j.ttl === 1, 'leader sets 24-hour messages');
ok((await call('/api/teams', { token: E })).j.teams.find(x => x.id === kt).ttl === 1, 'group list shows the message lifetime');
await call('/api/team/send', { token: E, body: { team: kt, text: 'old one' } });
await call('/api/team/send', { token: E, body: { team: kt, text: 'new one' } });
sql(`UPDATE messages SET ts=ts-2*${DAY} WHERE team=? AND text='old one'`, kt);
// meeting links are erased when a meeting ends, and stale live links are cleaned
const mA = await call('/api/team/meeting/start', { token: E, body: { team: kt, title: 'Ended', link: 'https://studio.test/join.html?relay=wss%3A%2F%2Fr.test&r=aa&k=bb&a=1' } });
await call('/api/team/meeting/end', { token: E, body: { meeting: mA.j.id } });
ok(sql('SELECT link FROM meetings WHERE id=?', mA.j.id)[0].link === null, 'meeting link erased when the meeting ends');
const mB = await call('/api/team/meeting/start', { token: E, body: { team: kt, title: 'Forgotten', link: 'https://studio.test/join.html?relay=wss%3A%2F%2Fr.test&r=cc&k=dd&a=1' } });
sql('UPDATE meetings SET started=? WHERE id=?', NOW - 2 * DAY, mB.j.id);
// old rows that should expire
sql(`INSERT INTO invites(code,team,by,expires,uses,max) VALUES('dead00000000',?,?,?,0,5)`, kt, 'e@test.com', NOW - 3 * DAY);
sql(`INSERT INTO meetings(id,team,title,started,ended,link) VALUES('0ld0000000',?,?,?,?,NULL)`, kt, 'Ancient', NOW - 100 * DAY, NOW - 100 * DAY);
sql(`INSERT INTO attendance(meeting,email,name,first,joined) VALUES('0ld0000000','f@test.com','f',1,?)`, NOW - 100 * DAY);
sql(`INSERT INTO programs(id,owner,title,descr,start,watch,created) VALUES('aaaaaaaaaa','e@test.com','Past',NULL,?, '', ?)`, NOW - 10 * DAY, NOW - 20 * DAY);
sql(`INSERT INTO programs(id,owner,title,descr,start,watch,created) VALUES('bbbbbbbbbb','e@test.com','Future',NULL,?, '', ?)`, NOW + 5 * DAY, NOW);
sql(`INSERT INTO programs(id,owner,title,descr,start,watch,created) VALUES('cccccccccc','e@test.com','Undated old',NULL,NULL, '', ?)`, NOW - 100 * DAY);
sql(`INSERT INTO conns(email,id,kind,name,sec,used) VALUES('e@test.com','yt:old','youtube','Old',?,?)`, 'x', NOW - 100 * DAY);
sql(`INSERT INTO conns(email,id,kind,name,sec,used) VALUES('e@test.com','yt:new','youtube','New',?,?)`, 'x', NOW);
sql(`INSERT INTO users(email,salt,hash,paid,verified,created,seen) VALUES('stale@test.com','a','b',0,0,?,?)`, NOW - 20 * DAY, NOW - 20 * DAY);
sql(`INSERT INTO users(email,salt,hash,paid,verified,created,seen) VALUES('fresh@test.com','a','b',0,0,?,?)`, NOW - 2 * DAY, NOW - 2 * DAY);
sql(`INSERT INTO users(email,salt,hash,paid,verified,created,seen) VALUES('idle@test.com','a','b',0,1,?,?)`, NOW - 500 * DAY, NOW - 400 * DAY);
sql(`INSERT INTO users(email,salt,hash,paid,verified,created,seen) VALUES('idlepaid@test.com','a','b',?,1,?,?)`, NOW + 5 * DAY, NOW - 500 * DAY, NOW - 400 * DAY);
sql(`INSERT INTO users(email,salt,hash,paid,verified,created,seen) VALUES('active@test.com','a','b',0,1,?,?)`, NOW - 500 * DAY, NOW - 10 * DAY);
ok(!(await call('/api/team/messages?team=' + kt + '&since=0', { token: E })).j.m.some(x => x.t === 'old one'), 'expired messages are hidden even before cleanup runs');
ok((await call('/api/admin/sweep', { token: E, body: {} })).s === 403, 'only the owner can run the cleanup');
sql(`INSERT INTO users(email,salt,hash,paid,verified,created,seen) VALUES('connectedidle@test.com','a','b',0,1,?,?)`, NOW - 500 * DAY, NOW - 400 * DAY);
sql(`INSERT INTO conns(email,id,kind,name,sec,used) VALUES('connectedidle@test.com','yt:permanent','youtube','Saved',?,?)`, 'x', NOW - 400 * DAY);
const sw = await call('/api/admin/sweep', { token: O, body: {} }); ok(sw.j.ok, 'cleanup runs');
ok(count("SELECT COUNT(*) FROM messages WHERE team=? AND text='old one'", kt) === 0 && count("SELECT COUNT(*) FROM messages WHERE team=? AND text='new one'", kt) === 1, 'old group messages disappear, recent ones stay');
ok(count("SELECT COUNT(*) FROM invites WHERE code='dead00000000'") === 0, 'expired invites are deleted');
const mb2 = sql('SELECT link,ended FROM meetings WHERE id=?', mB.j.id)[0]; ok(mb2.link === null && mb2.ended, 'forgotten live meeting links are closed');
ok(count("SELECT COUNT(*) FROM meetings WHERE id='0ld0000000'") === 0 && count("SELECT COUNT(*) FROM attendance WHERE meeting='0ld0000000'") === 0, 'attendance older than 90 days is deleted');
ok(count("SELECT COUNT(*) FROM programs WHERE id IN ('aaaaaaaaaa','cccccccccc')") === 0 && count("SELECT COUNT(*) FROM programs WHERE id='bbbbbbbbbb'") === 1, 'past programs expire, future ones stay');
ok(count("SELECT COUNT(*) FROM conns WHERE id='yt:old'") === 1 && count("SELECT COUNT(*) FROM conns WHERE id='yt:new'") === 1, 'saved channel connections survive cleanup regardless of last use');
ok(count("SELECT COUNT(*) FROM users WHERE email='stale@test.com'") === 0 && count("SELECT COUNT(*) FROM users WHERE email='fresh@test.com'") === 1, 'unconfirmed accounts expire after 14 days');
ok(count("SELECT COUNT(*) FROM users WHERE email='connectedidle@test.com'") === 1 && count("SELECT COUNT(*) FROM conns WHERE id='yt:permanent'") === 1, 'inactive accounts with saved connections are retained');
ok(count("SELECT COUNT(*) FROM users WHERE email='idle@test.com'") === 0, 'accounts idle for a year with no plan are deleted');
ok(count("SELECT COUNT(*) FROM users WHERE email IN ('idlepaid@test.com','active@test.com')") === 2, 'accounts with a plan or recent use are kept');
// message cap per group
env.MSG_CAP = '4';
for (let i = 0; i < 10; i++) sql(`INSERT INTO messages(team,sender,name,text,kind,meta,ts) VALUES(?,?,?,?,?,NULL,?)`, kt, 'filler', 'f', 'filler ' + i, 'msg', NOW + i);
await call('/api/team/send', { token: E, body: { team: kt, text: 'cap check' } }); delete env.MSG_CAP;
ok(count('SELECT COUNT(*) FROM messages WHERE team=?', kt) === 4, 'each group keeps only its newest messages');
// signing in refreshes the idle clock
sql("UPDATE users SET seen=? WHERE email='active@test.com'", NOW - 400 * DAY);
// limits
let blocked = 0; for (let i = 0; i < 7; i++) if ((await call('/api/signup', { headers: { ip: 999 }, body: { email: 'z' + i + '@test.com', password: st_('z' + i + '@test.com', 'password123'), agree: true } })).s === 429) blocked++;
ok(blocked >= 1, 'sign-up flood from one address is limited');
ok((await worker.fetch(new Request('https://studio.test/'), env)).headers.get('x-frame-options') === 'DENY', 'pages carry security headers');

// Owner/admin initial setup, roles, password lifecycle and privilege boundaries.
const seeded = spawnSync(process.execPath, [here + '../server/setup-accounts.mjs'], { env: { ...process.env, AUTH_SECRET: env.AUTH_SECRET, STUDIO_INITIAL_PASSWORD: 'TestFixture123!' }, encoding: 'utf8' });
ok(seeded.status === 0, 'private setup produces account SQL');
teamdb.db.exec(seeded.stdout);
const actualStretch = (id, password) => crypto.pbkdf2Sync(password, 'livestudio:' + (id.includes('@') ? id : id + '@studio.local'), 210000, 32, 'sha256').toString('hex');
const initialPassword = 'TestFixture123!';
const ownerLogin = await call('/api/login', { body: { email: 'OWNER', password: actualStretch('owner', initialPassword) } });
const ownerToken = ownerLogin.j.token;
const adminLogin = await call('/api/login', { body: { email: 'admin', password: actualStretch('admin', initialPassword) } });
const adminToken = adminLogin.j.token;
ok(ownerToken && adminToken, 'initial owner and admin can log in with supplied password');
ok((await call('/api/me', { token: ownerToken })).j.role === 'owner', 'owner role is returned');
ok((await call('/api/me', { token: adminToken })).j.role === 'admin', 'admin role is returned');
ok((await call('/api/relay-token', { token: ownerToken })).s === 200, 'owner does not need a subscription or relay password');
ok((await call('/api/relay-token', { token: adminToken })).s === 200, 'admin does not need a subscription or relay password');
ok((await call('/api/signup', { body: { email: 'owner', password: st_('owner', 'x'), agree: true } })).s === 403, 'public cannot register reserved owner username');
env.ADMIN_EMAILS += ',reserved@test.com';
ok((await call('/api/signup', { body: { email: 'reserved@test.com', password: st_('reserved@test.com', 'x'), agree: true } })).s === 403, 'public cannot claim configured admin email');
ok((await call('/api/admin/create', { token: adminToken, body: { email: 'helper', password: actualStretch('helper', 'Welcome123'), role: 'user' } })).s === 201, 'admin creates username account without email service');
const helperLogin = await call('/api/login', { body: { email: 'helper', password: actualStretch('helper', 'Welcome123') } });
const helperToken = helperLogin.j.token;
ok(!!helperToken, 'created user signs in with assigned password');
ok((await call('/api/me', { token: helperToken })).j.verified, 'admin-created account needs no email confirmation');
ok((await call('/api/admin/create', { token: helperToken, body: { email: 'intruder', password: st_('x', 'x') } })).s === 403, 'ordinary user cannot create accounts');
ok((await call('/api/admin/create', { token: adminToken, body: { email: 'badadmin', password: st_('x', 'x'), role: 'admin' } })).s === 403, 'admin cannot create another admin');
ok((await call('/api/admin/create', { token: ownerToken, body: { email: 'secondadmin', password: actualStretch('secondadmin', 'Welcome123'), role: 'admin' } })).s === 201, 'owner creates admins');
ok((await call('/api/admin/create', { token: ownerToken, body: { email: 'secondowner', password: st_('x', 'x'), role: 'owner' } })).s === 400, 'owner role cannot be assigned via user creation');
ok((await call('/api/admin/create', { token: adminToken, body: { email: 'helper', password: st_('x', 'x') } })).s === 409, 'duplicate creation cannot replace password');
ok((await call('/api/admin/password', { token: adminToken, body: { email: 'owner', password: st_('x', 'x') } })).s === 403, 'admin cannot reset owner password');
ok((await call('/api/admin/ban', { token: ownerToken, body: { email: 'owner', banned: true } })).s === 403, 'owner is protected from suspension');
ok((await call('/api/account/delete', { token: ownerToken, body: { password: actualStretch('owner', initialPassword) } })).s === 403, 'owner is protected from deletion');
ok((await call('/api/admin/role', { token: adminToken, body: { email: 'helper', role: 'admin' } })).s === 403, 'admin cannot promote users');
ok((await call('/api/admin/password', { token: adminToken, body: { email: 'helper', password: actualStretch('helper', 'Changed123') } })).s === 200, 'admin resets user password');
ok((await call('/api/me', { token: helperToken })).s === 401, 'password reset revokes old sessions');
ok((await call('/api/login', { body: { email: 'helper', password: actualStretch('helper', 'Welcome123') } })).s === 401, 'old password stops working');
const helperNew = (await call('/api/login', { body: { email: 'helper', password: actualStretch('helper', 'Changed123') } })).j.token;
ok(!!helperNew, 'new password works');
ok((await call('/api/admin/role', { token: ownerToken, body: { email: 'helper', role: 'admin' } })).s === 200, 'owner promotes a user');
ok((await call('/api/me', { token: helperNew })).s === 401, 'promotion invalidates existing sessions');
const promoted = (await call('/api/login', { body: { email: 'helper', password: actualStretch('helper', 'Changed123') } })).j.token;
ok((await call('/api/me', { token: promoted })).j.role === 'admin', 'promoted user receives admin role');
ok((await call('/api/admin/password', { token: adminToken, body: { email: 'helper', password: st_('x', 'x') } })).s === 403, 'admin cannot reset a peer admin');
const changed = await call('/api/account/password', { token: ownerToken, body: { current: actualStretch('owner', initialPassword), password: actualStretch('owner', 'MyNewPassword123') } });
ok(!!changed.j.token, 'owner changes own password in account settings');
ok((await call('/api/me', { token: ownerToken })).s === 401, 'own password change invalidates previous session');
ok((await call('/api/me', { token: changed.j.token })).j.role === 'owner', 'own password change preserves owner access');
const safeList = await call('/api/admin/users', { token: changed.j.token });
ok(!JSON.stringify(safeList.j).includes('"hash"') && !JSON.stringify(safeList.j).includes('"salt"'), 'user list never exposes password hashes');
teamdb.db.exec("UPDATE users SET seen=1,paid=0 WHERE role IN ('owner','admin')");
await call('/api/admin/sweep', { token: changed.j.token, body: {} });
ok(!!teamdb.db.prepare("SELECT email FROM users WHERE email='owner@studio.local'").get(), 'cleanup preserves inactive owner');
ok(!!teamdb.db.prepare("SELECT email FROM users WHERE email='admin@studio.local'").get(), 'cleanup preserves inactive admin');
teamdb.db.exec(seeded.stdout);
ok((await call('/api/login', { body: { email: 'owner', password: actualStretch('owner', initialPassword) } })).s === 401, 'rerunning setup never restores the initial password');
const oldDb = new DatabaseSync(':memory:');
oldDb.exec(schema.replace(", role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('owner','admin','user'))", ''));
oldDb.exec(fs.readFileSync(here + '../server/migrations/2026-10-roles.sql', 'utf8'));
ok(oldDb.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'role'), 'upgrade migration adds role to original schema');
// Private access is enforced on both new login and already-issued session tokens.
const privateUser='private-preview-user@test.com';
const privateToken=await signup(privateUser);
ok(!!privateToken,'legacy account setup fixture created');
env.MEETINGSPACE_PRIVATE_PREVIEW='1';
ok((await call('/api/signup',{body:{email:'blocked-private@test.com',password:st_('blocked-private@test.com','password123'),agree:true}})).s===403,'private preview refuses new public registrations');
ok((await call('/api/me',{token:privateToken})).s===403,'existing unapproved session is refused');
ok((await call('/api/login',{body:{email:privateUser,password:st_(privateUser,'password123')}})).s===403,'unapproved account cannot log in');
const allowed=await call('/api/admin/approve',{token:changed.j.token,body:{email:privateUser,approved:true}});
ok(allowed.s===200,'owner can approve a pre-existing account');
const approvedLogin=await call('/api/login',{body:{email:privateUser,password:st_(privateUser,'password123')}});
ok(approvedLogin.s===200&&!!approvedLogin.j.token,'approved account can sign in');
const previewMeeting=await call('/api/meeting-token',{token:approvedLogin.j.token});
ok(previewMeeting.s===200&&/^wss:\/\//.test(previewMeeting.j.url||''),'approved private-preview user can create meeting without payment');
ok((await call('/api/admin/approve',{token:approvedLogin.j.token,body:{email:privateUser,approved:true}})).s===403,'regular user cannot approve any account');
const revoked=await call('/api/admin/approve',{token:changed.j.token,body:{email:privateUser,approved:false}});
ok(revoked.s===200,'owner can revoke approved account');
ok((await call('/api/me',{token:approvedLogin.j.token})).s===401,'revocation invalidates existing session');
env.MEETINGSPACE_PRIVATE_PREVIEW='0';
fs.unlinkSync(here + '_worker_under_test.mjs');

// AI uses a currently supported model and never treats empty output as success.
env.AI={async run(model,input){ok(model==='@cf/meta/llama-3.1-8b-instruct-fp8','writer uses active FP8 model');return {response:' Sunday worship titles '}}};
let writer=await call('/api/ai',{token:O,body:{task:'title',topic:'Sunday worship'}});ok(writer.s===200&&writer.j.text==='Sunday worship titles','AI writer returns generated text');
env.AI={async run(){return {response:''}}};ok((await call('/api/ai',{token:O,body:{task:'title',topic:'Sunday'}})).s===502,'empty AI output is a recoverable error');
env.AI={async run(){throw Error('daily neuron quota exceeded')}};writer=await call('/api/ai',{token:O,body:{task:'title',topic:'Sunday'}});ok(writer.s===429&&writer.j.error.includes('meetings are still available'),'AI quota failures do not disable meetings');delete env.AI;
console.log(fail ? `\n${fail} FAILED, ${pass} passed` : `\nAll ${pass} checks passed`);
process.exit(fail ? 1 : 0);
