// Live Studio backend (Cloudflare Pages advanced mode).
// Bindings and variables to set in Pages > Settings:
//   Bindings:  TEAMDB (D1 database), AI (Workers AI)
//   Secrets:   AUTH_SECRET, RELAY_SECRET, PAYSTACK_SECRET
//   Variables: RELAY_URL (wss://...), CURRENCY (default NGN), PLANS (optional JSON), FROM_EMAIL
//   Optional secret: RESEND_API_KEY (email confirmation and password reset)
const enc = new TextEncoder();
const DEFAULT_PLANS = [{ id: 'day', name: 'Daily', days: 1, amount: 500 }, { id: 'week', name: 'Weekly', days: 7, amount: 2500 }, { id: 'month', name: 'Monthly', days: 30, amount: 8000 }];
const json = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...h } });
const safeEq = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const TERMS_VERSION = '2026-10';
const hex = (buf) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const hkey = (secret, hash = 'SHA-256') => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash }, false, ['sign', 'verify']);
async function sign(secret, obj) {
  const p = b64u(enc.encode(JSON.stringify(obj)));
  const sig = await crypto.subtle.sign('HMAC', await hkey(secret), enc.encode(p));
  return p + '.' + hex(sig);
}
async function check(secret, token) {
  const [p, sig] = String(token || '').split('.');
  if (!p || !sig || !/^[0-9a-f]{64}$/.test(sig)) return null;
  const sigBytes = Uint8Array.from(sig.match(/../g).map(h => parseInt(h, 16)));
  if (!(await crypto.subtle.verify('HMAC', await hkey(secret), sigBytes, enc.encode(p)))) return null;
  try { const o = JSON.parse(new TextDecoder().decode(unb64u(p))); return o.exp > Date.now() ? o : null; } catch { return null; }
}
// The browser already stretched the password (PBKDF2). The server only adds a salted keyed hash, which is cheap enough for the free plan's 10 ms limit.
async function pw(env, password, saltHex) { return hex(await crypto.subtle.sign('HMAC', await hkey(saltHex + '|' + (env.AUTH_SECRET || '')), enc.encode(String(password)))); }
const stretched = (s) => /^[0-9a-f]{64}$/.test(String(s || ''));
const plans = (env) => { try { return JSON.parse(env.PLANS || '') } catch { return DEFAULT_PLANS } };
const cur = (env) => env.CURRENCY || 'NGN';
const rowToUser = (r) => r && ({ salt: r.salt, hash: r.hash, paidUntil: r.paid, verified: !!r.verified, banned: !!r.banned, tv: r.tv, created: r.created, terms: r.terms, termsAt: r.termsAt, seen: r.seen, warned: r.warned, role: r.role || 'user' });
const getUser = async (env, email) => rowToUser(await env.TEAMDB.prepare('SELECT * FROM users WHERE email=?').bind(email).first());
const putUser = (env, email, u) => env.TEAMDB.prepare('INSERT INTO users(email,salt,hash,paid,verified,banned,tv,created,terms,termsAt,seen,warned,role) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET salt=excluded.salt,hash=excluded.hash,paid=excluded.paid,verified=excluded.verified,banned=excluded.banned,tv=excluded.tv,terms=excluded.terms,termsAt=excluded.termsAt,seen=excluded.seen,warned=excluded.warned,role=excluded.role').bind(email, u.salt, u.hash, u.paidUntil || 0, u.verified === false ? 0 : 1, u.banned ? 1 : 0, u.tv || 0, u.created || Date.now(), u.terms || null, u.termsAt || null, u.seen || Date.now(), u.warned || 0, u.role || 'user').run();
const listed = (value, email) => (value || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean).includes(email);
const accountRole = (env, email, u) => u?.role === 'owner' || listed(env.OWNER_EMAILS, email) ? 'owner' : u?.role === 'admin' || listed(env.ADMIN_EMAILS, email) ? 'admin' : 'user';
const isAdmin = (env, email, u) => accountRole(env, email, u) !== 'user';
const loginId = value => { const s = String(value || '').trim().toLowerCase(); return /^[a-z0-9][a-z0-9._-]{1,39}$/.test(s) ? s + '@studio.local' : s; };
const validEmail = value => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(value);
const reserved = (env, email) => ['owner@studio.local', 'admin@studio.local'].includes(email) || listed(env.ADMIN_EMAILS, email) || listed(env.OWNER_EMAILS, email);
async function who(request, env) {
  const t = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
  const o = await check(env.AUTH_SECRET, t);
  return o && o.e && !o.k ? o : null;
}
async function limit(env, key, max) { return rate(env, 'lim:' + key + ':' + new Date().toISOString().slice(0, 10), max, 172800); }
async function grant(env, d) {
  if (!d || d.status !== 'success') return null;
  const email = d.metadata && d.metadata.user, plan = plans(env).find(p => p.id === (d.metadata && d.metadata.plan));
  if (!email || !plan || d.amount !== Math.round(plan.amount * 100) || d.currency !== cur(env)) return null;
  const u = await getUser(env, email); if (!u) return null;
  const ins = await env.TEAMDB.prepare('INSERT OR IGNORE INTO payments(ref,email,plan,amount,cur,ts) VALUES(?,?,?,?,?,?)').bind(d.reference, email, plan.id, plan.amount, cur(env), Date.now()).run();
  if (!ins || !ins.meta || !ins.meta.changes) return u; // this payment was already counted
  await env.TEAMDB.prepare('UPDATE users SET paid=MAX(paid,?)+? WHERE email=?').bind(Date.now(), plan.days * 864e5, email).run();
  return await getUser(env, email);
}
const paystack = (env, path, init) => fetch('https://api.paystack.co' + path, { ...init, headers: { authorization: 'Bearer ' + env.PAYSTACK_SECRET, 'content-type': 'application/json' } }).then(r => r.json());

const aes = async (env) => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(env.TOKEN_KEY || env.AUTH_SECRET)), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function encr(env, t) { const iv = crypto.getRandomValues(new Uint8Array(12)); return b64u(iv) + '.' + b64u(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(env), enc.encode(t))); }
async function decr(env, s) { const [i, c] = s.split('.'); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(i) }, await aes(env), unb64u(c))); }
async function addConn(env, email, c) { await env.TEAMDB.prepare('INSERT OR REPLACE INTO conns(email,id,kind,name,sec,used) VALUES(?,?,?,?,?,?)').bind(email, c.id, c.kind, c.name, c.sec, Date.now()).run(); }
const conns = async (env, email) => (await env.TEAMDB.prepare('SELECT id,kind,name,sec FROM conns WHERE email=?').bind(email).all()).results;
const FBV = (env) => env.FB_VERSION || 'v25.0';
async function finishYT(env, url, email, code) {
  const t = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + '/api/oauth/youtube', grant_type: 'authorization_code' }) }).then(r => r.json());
  if (!t.access_token) throw new Error('Google did not allow the connection.');
  if (!t.refresh_token) throw new Error('Google did not return access. Remove this app from your Google account permissions and try again.');
  const ch = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { authorization: 'Bearer ' + t.access_token } }).then(r => r.json());
  const c = ch.items && ch.items[0]; if (!c) throw new Error('No YouTube channel was found on that account.');
  await addConn(env, email, { id: 'yt:' + c.id, kind: 'youtube', name: c.snippet.title, sec: await encr(env, t.refresh_token) });
}
async function finishFB(env, url, email, code) {
  const g = (p) => fetch('https://graph.facebook.com/' + FBV(env) + p).then(r => r.json());
  const a = await g('/oauth/access_token?' + new URLSearchParams({ client_id: env.FB_APP_ID, client_secret: env.FB_APP_SECRET, redirect_uri: url.origin + '/api/oauth/facebook', code }));
  if (!a.access_token) throw new Error('Facebook did not allow the connection.');
  const l = await g('/oauth/access_token?' + new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: env.FB_APP_ID, client_secret: env.FB_APP_SECRET, fb_exchange_token: a.access_token }));
  const p = await g('/me/accounts?' + new URLSearchParams({ fields: 'id,name,access_token', limit: '100', access_token: l.access_token || a.access_token }));
  if (!p.data || !p.data.length) throw new Error('No Facebook Pages found. You must be an admin of the Page.');
  for (const x of p.data) await addConn(env, email, { id: 'fb:' + x.id, kind: 'facebook', name: x.name, sec: await encr(env, x.access_token) });
}
async function ytToken(env, refresh) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' }) }).then(r => r.json());
  if (!r.access_token) throw new Error('Reconnect this channel.'); return r.access_token;
}
async function yt(path, tok, body) {
  const r = await fetch('https://www.googleapis.com/youtube/v3/' + path, { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'YouTube refused'); return j;
}
const mailOn = (env) => !!(env.RESEND_API_KEY && env.FROM_EMAIL);
async function mail(env, to, subject, html) {
  if (!mailOn(env)) return false;
  const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.FROM_EMAIL, to: [to], subject, html }) });
  return r.ok;
}
async function rate(env, key, max, ttl) {
  const now = Date.now(), exp = now + Math.max(60, ttl) * 1000;
  const r = await env.TEAMDB.prepare('INSERT INTO limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=CASE WHEN exp<? THEN 1 ELSE n+1 END, exp=CASE WHEN exp<? THEN ? ELSE exp END RETURNING n').bind(key, exp, now, now, exp).first();
  if (Math.random() < 0.02) await env.TEAMDB.prepare('DELETE FROM limits WHERE exp<?').bind(now).run();
  return !!r && r.n <= max;
}
async function sendVerify(env, url, email) {
  const t = await sign(env.AUTH_SECRET, { e: email, k: 'v', exp: Date.now() + 864e5 });
  return mail(env, email, 'Confirm your email', '<p>Welcome to Live Studio.</p><p><a href="' + url.origin + '/api/verify?t=' + t + '">Confirm my email</a></p><p>If you did not create an account, ignore this message.</p>');
}

// ---------- Groups (team chat), meetings, follow-up and public program pages (D1) ----------
const eh = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nid = () => hex(crypto.getRandomValues(new Uint8Array(5)));
const dname = (email) => email.split('@')[0].slice(0, 30);
const roleOf = async (env, team, email) => { const r = await env.TEAMDB.prepare('SELECT role FROM members WHERE team=? AND email=?').bind(team, email).first(); return r ? r.role : null; };
const sysMsg = (env, team, text, kind = 'sys', meta = null) => env.TEAMDB.prepare('INSERT INTO messages(team,sender,name,text,kind,meta,ts) VALUES(?,?,?,?,?,?,?)').bind(team, 'system', 'System', text, kind, meta, Date.now()).run();

async function teamRoutes(request, env, url, path, email, active) {
  if (!env.TEAMDB) return json({ error: 'Groups are not set up yet.' }, 501);
  const DB = env.TEAMDB, now = Date.now(), post = request.method === 'POST';
  const readRoutes = new Set(['/api/teams','/api/team/invite-preview','/api/team/members','/api/team/messages','/api/team/meetings','/api/team/meeting/report','/api/programs']);
  if (readRoutes.has(path) ? request.method !== 'GET' : !post) return json({ error: 'Method not allowed.' }, 405);
  let b = {}; if (post) { try { b = await request.json(); } catch {} }
  const T = String(b.team || url.searchParams.get('team') || '').replace(/[^0-9a-f]/g, '');
  const need = async (roles) => { const r = await roleOf(env, T, email); return r && (!roles || roles.includes(r)) ? r : null; };
  const meetingTeam = async (id) => DB.prepare('SELECT * FROM meetings WHERE id=?').bind(String(id || '').replace(/[^0-9a-f]/g, '')).first();
  switch (path) {
    case '/api/teams': {
      const r = await DB.prepare("SELECT t.id,t.name,m.role,(SELECT COUNT(*) FROM members x WHERE x.team=t.id) n, t.ttl FROM teams t JOIN members m ON m.team=t.id AND m.email=? ORDER BY t.created DESC LIMIT 50").bind(email).all();
      return json({ teams: r.results });
    }
    case '/api/team/create': {
      const name = String(b.name || '').trim().slice(0, 60); if (!name) return json({ error: 'Give the group a name.' }, 400);
      const c = await DB.prepare('SELECT COUNT(*) n FROM teams WHERE owner=?').bind(email).first(); if (c.n >= 5) return json({ error: 'You can lead up to 5 groups.' }, 400);
      const id = nid();
      await DB.batch([DB.prepare('INSERT INTO teams(id,name,owner,created) VALUES(?,?,?,?)').bind(id, name, email, now), DB.prepare('INSERT INTO members(team,email,name,role,joined) VALUES(?,?,?,?,?)').bind(id, email, dname(email), 'leader', now)]);
      await sysMsg(env, id, 'The group "' + name + '" was created.');
      return json({ id });
    }
    case '/api/team/invite': {
      if (!(await need(['leader', 'admin']))) return json({ error: 'Only leaders and admins can invite people.' }, 403);
      const code = hex(crypto.getRandomValues(new Uint8Array(6)));
      await DB.prepare('INSERT INTO invites(code,team,by,expires,uses,max) VALUES(?,?,?,?,0,100)').bind(code, T, email, now + 7 * 864e5).run();
      return json({ code, url: url.origin + '/?join=' + code });
    }
    case '/api/team/invite-preview': {
      // Read-only preview: accepting an invitation remains a separate explicit action.
      const code = String(url.searchParams.get('code') || '').toLowerCase();
      if (!/^[0-9a-f]{12}$/.test(code)) return json({ error: 'Invalid invitation.' }, 400);
      if (!(await rate(env, 'preview:' + email, 30, 900))) return json({ error: 'Too many requests.' }, 429);
      const row = await DB.prepare('SELECT t.id,t.name,i.expires,i.uses,i.max FROM invites i JOIN teams t ON t.id=i.team WHERE i.code=?').bind(code).first();
      if (!row || row.expires <= now || row.uses >= row.max) return json({ error: 'Invitation expired or unavailable.' }, 404);
      return json({ group: { id: row.id, name: row.name }, expires: row.expires, joined: !!(await roleOf(env, row.id, email)) });
    }
    case '/api/team/join': {
      const code = String(b.code || '').toLowerCase();
      if (!/^[0-9a-f]{12}$/.test(code)) return json({ error: 'Invalid invitation code.' }, 400);
      if (!(await rate(env, 'jn:' + email, 10, 900))) return json({ error: 'Too many attempts. Try again later.' }, 429);
      const iv = await DB.prepare('SELECT * FROM invites WHERE code=?').bind(code).first();
      if (!iv || iv.expires < now || iv.uses >= iv.max) return json({ error: 'This invite link has expired. Ask the leader for a new one.' }, 400);
      if (!(await roleOf(env, iv.team, email))) {
        const c = await DB.prepare('SELECT COUNT(*) n FROM members WHERE team=?').bind(iv.team).first();
        if (c.n >= (+env.TEAM_MAX || 500)) return json({ error: 'This group is full.' }, 400);
        await DB.batch([DB.prepare('INSERT INTO members(team,email,name,role,joined) VALUES(?,?,?,?,?)').bind(iv.team, email, dname(email), 'member', now), DB.prepare('UPDATE invites SET uses=uses+1 WHERE code=?').bind(code)]);
        await sysMsg(env, iv.team, dname(email) + ' joined the group. Welcome!');
      }
      return json({ team: await DB.prepare('SELECT id,name FROM teams WHERE id=?').bind(iv.team).first() });
    }
    case '/api/team/members': {
      const r = await need(); if (!r) return json({ error: 'You are not in this group.' }, 403);
      const rows = await DB.prepare("SELECT email,name,role,joined FROM members WHERE team=? ORDER BY CASE role WHEN 'leader' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, joined LIMIT 500").bind(T).all();
      const staff = r !== 'member';
      return json({ me: r, members: rows.results.map(m => ({ name: m.name, role: m.role, joined: m.joined, email: staff ? m.email : undefined })) });
    }
    case '/api/team/name': {
      if (!(await need())) return json({ error: 'You are not in this group.' }, 403);
      await DB.prepare('UPDATE members SET name=? WHERE team=? AND email=?').bind(String(b.name || '').trim().slice(0, 30) || dname(email), T, email).run(); return json({ ok: true });
    }
    case '/api/team/ttl': {
      if ((await need()) !== 'leader') return json({ error: 'Only the leader can change this.' }, 403);
      const d = [1, 7, 30].includes(+b.days) ? +b.days : 30;
      await DB.prepare('UPDATE teams SET ttl=? WHERE id=?').bind(d, T).run();
      await sysMsg(env, T, 'Messages in this group now disappear after ' + (d === 1 ? '24 hours' : d + ' days') + '.'); return json({ ok: true, ttl: d });
    }
    case '/api/team/role': {
      if ((await need()) !== 'leader') return json({ error: 'Only the leader can change roles.' }, 403);
      const e = String(b.email || '').toLowerCase(); if (e === email) return json({ error: 'You are the leader.' }, 400);
      await DB.prepare("UPDATE members SET role=? WHERE team=? AND email=? AND role!='leader'").bind(b.role === 'admin' ? 'admin' : 'member', T, e).run(); return json({ ok: true });
    }
    case '/api/team/remove': {
      const r = await need(['leader', 'admin']); if (!r) return json({ error: 'Not allowed.' }, 403);
      const e = String(b.email || '').toLowerCase(), tr = await roleOf(env, T, e);
      if (!tr || tr === 'leader' || e === email || (r === 'admin' && tr === 'admin')) return json({ error: 'You cannot remove that person.' }, 400);
      await DB.prepare('DELETE FROM members WHERE team=? AND email=?').bind(T, e).run(); await sysMsg(env, T, dname(e) + ' was removed from the group.'); return json({ ok: true });
    }
    case '/api/team/leave': {
      const r = await need(); if (!r) return json({ error: 'You are not in this group.' }, 403);
      if (r === 'leader') return json({ error: 'The leader cannot leave. Delete the group instead.' }, 400);
      await DB.prepare('DELETE FROM members WHERE team=? AND email=?').bind(T, email).run(); await sysMsg(env, T, dname(email) + ' left the group.'); return json({ ok: true });
    }
    case '/api/team/delete': {
      if ((await need()) !== 'leader') return json({ error: 'Only the leader can delete the group.' }, 403);
      await dropTeam(env, T);
      return json({ ok: true });
    }
    case '/api/team/messages': {
      if (!(await need())) return json({ error: 'You are not in this group.' }, 403);
      const since = +url.searchParams.get('since') || 0;
      const tl = await DB.prepare('SELECT ttl FROM teams WHERE id=?').bind(T).first(), cut = now - ((tl && tl.ttl) || 30) * 864e5; // expired messages are never shown, even before the cleanup removes them
      const rows = since
        ? await DB.prepare('SELECT id,sender,name,text,kind,meta,ts FROM messages WHERE team=? AND id>? AND ts>? ORDER BY id LIMIT 100').bind(T, since, cut).all()
        : await DB.prepare('SELECT * FROM (SELECT id,sender,name,text,kind,meta,ts FROM messages WHERE team=? AND ts>? ORDER BY id DESC LIMIT 50) ORDER BY id').bind(T, cut).all();
      const m = rows.results.map(x => ({ id: x.id, s: x.sender === email ? 'me' : x.sender === 'system' ? 'system' : 'other', n: x.name, t: x.text, k: x.kind, m: x.meta, ts: x.ts }));
      return json({ m, last: m.length ? m[m.length - 1].id : since });
    }
    case '/api/team/send': {
      const r = await need(); if (!r) return json({ error: 'You are not in this group.' }, 403);
      const text = String(b.text || '').trim().slice(0, 600); if (!text) return json({ error: 'Type a message.' }, 400);
      const c = await DB.prepare('SELECT COUNT(*) n FROM messages WHERE sender=? AND ts>?').bind(email, now - 10000).first();
      if (c.n >= 6) return json({ error: 'You are sending messages too fast.' }, 429);
      const me = await DB.prepare('SELECT name FROM members WHERE team=? AND email=?').bind(T, email).first();
      await DB.prepare('INSERT INTO messages(team,sender,name,text,kind,meta,ts) VALUES(?,?,?,?,?,NULL,?)').bind(T, email, me.name, text, b.kind === 'announce' && r !== 'member' ? 'announce' : 'msg', now).run();
      await DB.prepare('DELETE FROM messages WHERE team=? AND id <= (SELECT id FROM messages WHERE team=? ORDER BY id DESC LIMIT 1 OFFSET ?)').bind(T, T, +env.MSG_CAP || 500).run();
      return json({ ok: true });
    }
    case '/api/team/meeting/start': {
      if (!(await need(['leader', 'admin']))) return json({ error: 'Only leaders and admins can start meetings.' }, 403);
      if (!active) return json({ error: 'Choose a plan to host live meetings.' }, 402);
      const link = String(b.link || ''); if (!/^https:\/\/[^\s<>"']{10,700}$/.test(link)) return json({ error: 'Start the guest room first.' }, 400);
      const id = nid(), title = String(b.title || '').trim().slice(0, 80) || 'Team meeting';
      await DB.prepare('INSERT INTO meetings(id,team,title,started,link) VALUES(?,?,?,?,?)').bind(id, T, title, now, link).run();
      await sysMsg(env, T, title, 'meeting', id); return json({ id });
    }
    case '/api/team/meeting/end': {
      const mt = await meetingTeam(b.meeting); if (!mt) return json({ error: 'Meeting not found.' }, 404);
      if (!(await roleOf(env, mt.team, email)) || (await roleOf(env, mt.team, email)) === 'member') return json({ error: 'Not allowed.' }, 403);
      await DB.prepare('UPDATE meetings SET ended=?, link=NULL WHERE id=?').bind(now, mt.id).run(); await sysMsg(env, mt.team, 'The meeting "' + mt.title + '" has ended.'); return json({ ok: true });
    }
    case '/api/team/meeting/join': {
      const mt = await meetingTeam(b.meeting); if (!mt || mt.ended) return json({ error: 'This meeting has ended.' }, 400);
      if (!(await roleOf(env, mt.team, email))) return json({ error: 'You are not in this group.' }, 403);
      const had = await DB.prepare('SELECT 1 x FROM attendance a JOIN meetings m ON m.id=a.meeting WHERE m.team=? AND a.email=? LIMIT 1').bind(mt.team, email).first();
      const me = await DB.prepare('SELECT name FROM members WHERE team=? AND email=?').bind(mt.team, email).first();
      await DB.prepare('INSERT OR IGNORE INTO attendance(meeting,email,name,first,joined) VALUES(?,?,?,?,?)').bind(mt.id, email, me.name, had ? 0 : 1, now).run();
      return json({ link: mt.link });
    }
    case '/api/team/meetings': {
      if (!(await need(['leader', 'admin']))) return json({ error: 'Not allowed.' }, 403);
      const r = await DB.prepare('SELECT id,title,started,ended,(SELECT COUNT(*) FROM attendance a WHERE a.meeting=m.id) n FROM meetings m WHERE team=? ORDER BY started DESC LIMIT 10').bind(T).all();
      return json({ meetings: r.results });
    }
    case '/api/team/meeting/report': {
      const mt = await meetingTeam(url.searchParams.get('meeting')); if (!mt) return json({ error: 'Meeting not found.' }, 404);
      const r = await roleOf(env, mt.team, email); if (!r || r === 'member') return json({ error: 'Not allowed.' }, 403);
      const at = await DB.prepare('SELECT email,name,first FROM attendance WHERE meeting=? ORDER BY joined').bind(mt.id).all();
      const ab = await DB.prepare('SELECT email,name FROM members WHERE team=? AND email NOT IN (SELECT email FROM attendance WHERE meeting=?)').bind(mt.team, mt.id).all();
      return json({ title: mt.title, attended: at.results, absent: ab.results });
    }
    case '/api/team/followup': {
      const mt = await meetingTeam(b.meeting); if (!mt) return json({ error: 'Meeting not found.' }, 404);
      const r = await roleOf(env, mt.team, email); if (!r || r === 'member') return json({ error: 'Not allowed.' }, 403);
      const text = String(b.text || '').trim().slice(0, 500); if (!text) return json({ error: 'Write your message first.' }, 400);
      const at = (await DB.prepare('SELECT email,first FROM attendance WHERE meeting=?').bind(mt.id).all()).results;
      const all = (await DB.prepare('SELECT email FROM members WHERE team=?').bind(mt.team).all()).results.map(x => x.email);
      const got = new Set(at.map(x => x.email));
      const labels = { new: 'new attendees', returning: 'returning attendees', absent: 'members who missed it', all: 'everyone' };
      const aud = labels[b.audience] ? b.audience : 'all';
      const list = aud === 'new' ? at.filter(x => x.first).map(x => x.email) : aud === 'returning' ? at.filter(x => !x.first).map(x => x.email) : aud === 'absent' ? all.filter(e => !got.has(e)) : all;
      const team = await DB.prepare('SELECT name FROM teams WHERE id=?').bind(mt.team).first();
      await DB.prepare('INSERT INTO messages(team,sender,name,text,kind,meta,ts) VALUES(?,?,?,?,?,NULL,?)').bind(mt.team, email, dname(email), 'To ' + labels[aud] + ' (' + mt.title + '): ' + text, 'announce', now).run();
      let sent = 0;
      if (b.email === true && env.MEETINGSPACE_FOLLOWUP_EMAIL_ENABLED === '1' && mailOn(env) && (await rate(env, 'fu:' + email, 3, 3600))) {
        const cap = Math.max(1, Math.min(20, Number(env.MEETINGSPACE_FOLLOWUP_EMAIL_CAP) || 10));
        for (const e of list.slice(0, cap)) if (await mail(env, e, 'Follow-up: ' + team.name, '<p>' + eh(text) + '</p><p style="color:#666;font-size:12px">You received this because you are a member of "' + eh(team.name) + '" on Live Studio.</p>')) sent++;
      }
      return json({ ok: true, people: list.length, emailed: sent });
    }
    case '/api/programs': {
      const r = await DB.prepare('SELECT id,title,descr,start,watch FROM programs WHERE owner=? ORDER BY created DESC LIMIT 30').bind(email).all();
      return json({ programs: r.results });
    }
    case '/api/program/save': {
      const title = String(b.title || '').trim().slice(0, 100); if (!title) return json({ error: 'Give the program a title.' }, 400);
      const watch = /^https?:\/\/[^\s<>"']{4,200}$/.test(String(b.watch || '').trim()) ? String(b.watch).trim() : '';
      const start = Number.isFinite(+b.start) && +b.start > 0 ? Math.floor(+b.start) : null, descr = String(b.descr || '').trim().slice(0, 500);
      let id = String(b.id || '').replace(/[^0-9a-f]/g, '');
      if (id) { const ex = await DB.prepare('SELECT owner FROM programs WHERE id=?').bind(id).first(); if (!ex || ex.owner !== email) return json({ error: 'Not allowed.' }, 403); await DB.prepare('UPDATE programs SET title=?,descr=?,start=?,watch=? WHERE id=?').bind(title, descr, start, watch, id).run(); }
      else {
        const c = await DB.prepare('SELECT COUNT(*) n FROM programs WHERE owner=?').bind(email).first(); if (c.n >= 30) return json({ error: 'You can keep up to 30 programs.' }, 400);
        id = nid(); await DB.prepare('INSERT INTO programs(id,owner,title,descr,start,watch,created) VALUES(?,?,?,?,?,?,?)').bind(id, email, title, descr, start, watch, now).run();
      }
      return json({ id, url: url.origin + '/p/' + id });
    }
    case '/api/program/delete': {
      await DB.prepare('DELETE FROM programs WHERE id=? AND owner=?').bind(String(b.id || '').replace(/[^0-9a-f]/g, ''), email).run(); return json({ ok: true });
    }
  }
  return null;
}

const dropTeam = (env, id) => env.TEAMDB.batch(['DELETE FROM attendance WHERE meeting IN (SELECT id FROM meetings WHERE team=?)', 'DELETE FROM meetings WHERE team=?', 'DELETE FROM messages WHERE team=?', 'DELETE FROM invites WHERE team=?', 'DELETE FROM members WHERE team=?', 'DELETE FROM teams WHERE id=?'].map(q => env.TEAMDB.prepare(q).bind(id)));
async function purgeUser(env, email) {
  if (!env.TEAMDB) return; const DB = env.TEAMDB;
  for (const t of (await DB.prepare('SELECT id FROM teams WHERE owner=?').bind(email).all()).results) await dropTeam(env, t.id);
  await DB.batch([DB.prepare("UPDATE messages SET sender='deleted', name='Deleted user' WHERE sender=?").bind(email), DB.prepare('DELETE FROM attendance WHERE email=?').bind(email), DB.prepare('DELETE FROM members WHERE email=?').bind(email), DB.prepare('DELETE FROM programs WHERE owner=?').bind(email), DB.prepare('DELETE FROM invites WHERE by=?').bind(email)]);
}
async function exportGroups(env, email) {
  const DB = env.TEAMDB;
  return {
    groups: (await DB.prepare('SELECT t.name,m.role,m.joined FROM members m JOIN teams t ON t.id=m.team WHERE m.email=?').bind(email).all()).results,
    programs: (await DB.prepare('SELECT title,start,watch FROM programs WHERE owner=?').bind(email).all()).results,
    meetingsAttended: (await DB.prepare('SELECT COUNT(*) n FROM attendance WHERE email=?').bind(email).first()).n,
    note2: 'Messages you sent in groups are visible to those groups. Deleting your account replaces your name on them with "Deleted user".'
  };
}
// Automatic cleanup so little is kept for long. Runs about once an hour from normal traffic, or on demand from the Admin tab.
async function sweep(env) {
  const DB = env.TEAMDB, now = Date.now(), D = 864e5, out = {};
  const run = async (k, sql, ...a) => { const r = await DB.prepare(sql).bind(...a).run(); out[k] = (r && r.meta && r.meta.changes) || 0; };
  await run('messages', 'DELETE FROM messages WHERE ts < ? - COALESCE((SELECT ttl FROM teams t WHERE t.id=messages.team),30)*86400000', now);
  await run('invites', 'DELETE FROM invites WHERE expires < ?', now - D);
  await run('staleMeetingLinks', 'UPDATE meetings SET link=NULL, ended=COALESCE(ended,?) WHERE link IS NOT NULL AND started < ?', now, now - D);
  await run('attendance', 'DELETE FROM attendance WHERE joined < ?', now - 90 * D);
  await run('meetings', 'DELETE FROM meetings WHERE started < ?', now - 90 * D);
  await run('programs', 'DELETE FROM programs WHERE (start IS NOT NULL AND start < ?) OR (start IS NULL AND created < ?)', now - 7 * D, now - 90 * D);
  // Saved channel connections do not expire through housekeeping. Disconnect explicitly.
  out.unusedConnections = 0;
  await run('limits', 'DELETE FROM limits WHERE exp < ?', now);
  await run('unconfirmedAccounts', "DELETE FROM users WHERE verified=0 AND role='user' AND created < ?", now - 14 * D);
  if (mailOn(env)) {
    const soon = (await DB.prepare('SELECT email FROM users WHERE seen < ? AND paid < ? AND warned=0 LIMIT 20').bind(now - 335 * D, now).all()).results;
    for (const u of soon) {
      await mail(env, u.email, 'Your Live Studio account will be deleted', '<p>You have not signed in for almost a year, so we will delete your account and its data in about 30 days to keep your information from sitting around.</p><p>To keep it, just sign in once.</p>');
      await DB.prepare('UPDATE users SET warned=? WHERE email=?').bind(now, u.email).run();
    }
    out.warned = soon.length;
  }
  const dead = (await DB.prepare('SELECT email FROM users WHERE NOT EXISTS (SELECT 1 FROM conns WHERE conns.email=users.email) AND seen < ? AND paid < ? AND (warned > 0 OR ?) LIMIT 20').bind(now - 365 * D, now, mailOn(env) ? 0 : 1).all()).results;
  for (const u of dead) { const staff = await getUser(env, u.email); if (isAdmin(env, u.email, staff)) continue; await purgeUser(env, u.email); await DB.prepare('DELETE FROM conns WHERE email=?').bind(u.email).run(); await DB.prepare('DELETE FROM users WHERE email=?').bind(u.email).run(); }
  out.inactiveAccounts = dead.length;
  return out;
}
async function programPage(env, url, id) {
  const p = env.TEAMDB && await env.TEAMDB.prepare('SELECT title,descr,start,watch FROM programs WHERE id=?').bind(id).first();
  if (!p) return new Response('Program not found', { status: 404 });
  const desc = p.descr || 'Join us live.', img = url.origin + '/bg/nations-stage.jpg', t = eh(p.title), d = eh(desc);
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>
<meta property="og:type" content="website"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:image" content="${img}"><meta property="og:url" content="${url.href}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${img}">
<style>body{margin:0;background:#14202e;color:#e8eef5;font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px}main{max-width:560px;width:100%;background:#1d2c3d;border:1px solid #2f4258;border-radius:12px;overflow:hidden}img{width:100%;display:block}div{padding:18px}h1{margin:0 0 8px;font-size:24px}a.b{display:inline-block;margin:6px 8px 0 0;padding:10px 14px;border-radius:6px;background:#3fa7d6;color:#06121c;font-weight:600;text-decoration:none}a.g{background:none;border:1px solid #3fa7d6;color:#3fa7d6}.m{color:#93a6ba}</style></head><body><main><img src="/bg/th-nations-stage.jpg" alt=""><div>
<h1>${t}</h1><p class="m" id="when"></p><p>${d}</p>
${/^https?:\/\//.test(p.watch || '') ? `<a class="b" href="${eh(p.watch)}" rel="noopener noreferrer" target="_blank">Watch live</a>` : ''}<a class="b g" id="ics" hidden>Add to calendar</a><a class="b g" href="/">Open Live Studio</a>
</div></main><script>const s=${Number(p.start) || 0},T=${JSON.stringify(p.title).replace(/</g, '\\u003c')};if(s){const d=new Date(s);document.getElementById('when').textContent=d.toLocaleString([],{dateStyle:'full',timeStyle:'short'});
const f=x=>new Date(x).toISOString().replace(/[-:]|\\.\\d{3}/g,''),a=document.getElementById('ics');a.hidden=false;a.href='data:text/calendar;charset=utf-8,'+encodeURIComponent('BEGIN:VCALENDAR\\nVERSION:2.0\\nBEGIN:VEVENT\\nSUMMARY:'+T.replace(/[\\r\\n]/g,' ')+'\\nDTSTART:'+f(s)+'\\nDTEND:'+f(s+36e5)+'\\nEND:VEVENT\\nEND:VCALENDAR');a.download='program.ics'}</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=60', 'content-security-policy': "frame-ancestors 'none'; base-uri 'none'; object-src 'none'" } });
}
const PROMPTS = {
  title: 'Write 5 short, engaging live stream titles (max 70 characters each), one per line, about: ',
  description: 'Write a friendly live stream description of about 60 words, then one line of 8 relevant hashtags, about: ',
  announcement: 'Write a warm spoken announcement of about 40 words for viewers of a live stream about: ',
  ticker: 'Write 3 short one-line messages (max 90 characters each), one per line, for a scrolling ticker about: '
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname;
    const pm = path.match(/^\/p\/([0-9a-f]{10})$/);
    if (pm) return programPage(env, url, pm[1]);
    if (!path.startsWith('/api/')) {
      const r = await env.ASSETS.fetch(request), h = new Headers(r.headers);
      h.set('x-content-type-options', 'nosniff'); h.set('referrer-policy', 'no-referrer'); h.set('x-frame-options', 'DENY');
      h.set('permissions-policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=()');
      h.set('content-security-policy', "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'");
      return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
    }
    if (env.TEAMDB && ctx && ctx.waitUntil && Math.random() < 0.02) ctx.waitUntil((async () => { try { if (await rate(env, 'sweep', 1, 3600)) await sweep(env); } catch {} })());
    const accounts = !!(env.TEAMDB && env.AUTH_SECRET && env.AUTH_SECRET.length >= 32);
    const origin = request.headers.get('origin');
    if (request.method === 'POST' && origin && origin !== url.origin && path !== '/api/pay/webhook') return json({ error: 'Forbidden' }, 403);

    if (path === '/api/health') return json({ ok: true, releaseId: typeof MEETING_RELEASE_ID === 'string' ? MEETING_RELEASE_ID : null, accountsConfigured: accounts, relayConfigured: !!(env.RELAY_URL && env.RELAY_SECRET), meetingConfigured: !!(env.MEETING_ROOMS && typeof env.MEETING_ROOMS.idFromName==='function' && typeof env.MEETING_ROOMS.get==='function'), turnConfigured: String(env.TURN_SHARED_SECRET||'').length>=32 && String(env.TURN_URLS||'').split(',').some(u=>{u=u.trim();const m=u.match(/^turns?:[a-z0-9.-]+(?::([0-9]{1,5}))?(?:\?transport=(?:udp|tcp))?$/i);return !!m&&!u.includes('..')&&(!m[1]||Number(m[1])<=65535)}), youtubeConfigured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), facebookConfigured: !!(env.FB_APP_ID && env.FB_APP_SECRET), aiConfigured: !!env.AI, radio: 'on-hold' });
    if (path === '/api/plans') return accounts ? json({ plans: plans(env), currency: cur(env), registrationOpen: env.MEETINGSPACE_PRIVATE_PREVIEW === '0' }) : json({ error: 'Accounts are not set up' }, 501);
    if (path === '/api/pay/webhook' && request.method === 'POST') {
      if (!accounts || !env.PAYSTACK_SECRET) return json({ error: 'Not set up' }, 501);
      const raw = await request.text();
      const sig = hex(await crypto.subtle.sign('HMAC', await hkey(env.PAYSTACK_SECRET, 'SHA-512'), enc.encode(raw)));
      if (!safeEq(sig, request.headers.get('x-paystack-signature') || '')) return json({ error: 'Bad signature' }, 401);
      try { const ev = JSON.parse(raw); if (ev.event === 'charge.success') await grant(env, ev.data); } catch {}
      return json({ ok: true });
    }

    if (path === '/api/oauth/youtube' || path === '/api/oauth/facebook') {
      const kind = path.endsWith('youtube') ? 'youtube' : 'facebook';
      const back = (q) => Response.redirect(url.origin + '/?' + q, 302), err = (m) => back('connect_error=' + encodeURIComponent(m));
      const st = accounts && await check(env.AUTH_SECRET, url.searchParams.get('state'));
      if (!st || st.k !== kind) return err('That sign-in expired. Please try again.');
      const ck = (request.headers.get('cookie') || '').match(/(?:^|;\s*)oauth_n=([0-9a-f]+)/);
      if (!ck || !st.n || ck[1] !== st.n) return err('That sign-in did not start in this browser. Please try again.');
      const linkedUser = await getUser(env, st.e);
      if (!linkedUser || linkedUser.banned || (linkedUser.tv || 0) !== (st.tv || 0)) return err('Please sign in and connect again.');
      const code = url.searchParams.get('code'); if (!code) return err('The connection was cancelled.');
      try { await (kind === 'youtube' ? finishYT : finishFB)(env, url, st.e, code); return back('connected=' + kind); }
      catch (e) { return err(String(e.message || 'Could not connect.').slice(0, 140)); }
    }
    if (path === '/api/signup' || path === '/api/login') {
      if (!accounts) return json({ error: 'Accounts are not set up' }, 501);
      let b = {}; try { b = await request.json(); } catch {}
      const email = loginId(b.email), password = String(b.password || '');
      if (!validEmail(email)) return json({ error: 'Enter your username or email.' }, 400);
      const ipa = request.headers.get('cf-connecting-ip') || 'x';
      if (path === '/api/signup' ? !(await rate(env, 'su:' + ipa, 5, 3600)) : !((await rate(env, 'li:' + ipa, 30, 900)) && (await rate(env, 'le:' + email, 8, 900)))) return json({ error: 'Too many attempts. Please wait a few minutes and try again.' }, 429);
      let u = await getUser(env, email);
      if (path === '/api/signup') {
        if (env.MEETINGSPACE_PRIVATE_PREVIEW !== '0') return json({ error: 'Private preview: registration is closed. Contact the Heavenly Key administrator for an approved account.' }, 403);
        if (reserved(env, email) || email.endsWith('@studio.local')) return json({ error: 'Ask the owner or an admin to create this account.' }, 403);
        if (b.agree !== true) return json({ error: 'Please confirm you are 18 or older and agree to the Terms and Privacy Policy.' }, 400);
        if (!stretched(password)) return json({ error: 'Please refresh the page and try again.' }, 400);
        if (u) return json({ error: 'That email already has an account. Log in instead.' }, 409);
        const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
        u = { salt, hash: await pw(env, password, salt), paidUntil: 0, created: Date.now(), verified: !mailOn(env), terms: TERMS_VERSION, termsAt: Date.now() };
        const created = await env.TEAMDB.prepare('INSERT OR IGNORE INTO users(email,salt,hash,paid,verified,banned,tv,created,terms,termsAt,seen,role) VALUES(?,?,?,0,?,0,0,?,?,?,?,?)').bind(email, u.salt, u.hash, u.verified ? 1 : 0, u.created, u.terms, u.termsAt, u.created, 'user').run();
        if (!created.meta.changes) return json({ error: 'That email already has an account. Log in instead.' }, 409);
        if (mailOn(env)) await sendVerify(env, url, email);
      } else if (!u || (await pw(env, password, u.salt)) !== u.hash) return json({ error: 'Wrong email or password.' }, 401);
      if (u.banned) return json({ error: 'This account is suspended.' }, 403);
      if (path === '/api/login' && env.MEETINGSPACE_PRIVATE_PREVIEW !== '0' && accountRole(env,email,u)==='user' && u.terms!=='private-approved') return json({ error: 'This private preview requires administrator approval.' }, 403);
      if (path === '/api/login') { u.seen = Date.now(); u.warned = 0; await putUser(env, email, u); }
      return json({ token: await sign(env.AUTH_SECRET, { e: email, t: u.tv || 0, exp: Date.now() + 30 * 864e5 }) });
    }

    if (path === '/api/verify') {
      const o = accounts && await check(env.AUTH_SECRET, url.searchParams.get('t'));
      const to = (m) => Response.redirect(url.origin + '/?notice=' + encodeURIComponent(m), 302);
      if (!o || o.k !== 'v') return to('That confirmation link has expired. Log in and request a new one.');
      const u = await getUser(env, o.e); if (!u) return to('Account not found.');
      u.verified = true; await putUser(env, o.e, u); return to('Email confirmed. Thank you.');
    }
    if (path === '/api/forgot' && request.method === 'POST') {
      if (!accounts) return json({ error: 'Accounts are not set up' }, 501);
      if (!mailOn(env)) return json({ error: 'Password reset by email is not set up yet. Please contact support.' }, 501);
      let b = {}; try { b = await request.json(); } catch {}
      const email = String(b.email || '').trim().toLowerCase();
      if (!(await rate(env, 'fi:' + (request.headers.get('cf-connecting-ip') || 'x'), 5, 3600)) || !(await rate(env, 'fe:' + email, 3, 3600))) return json({ error: 'Too many requests. Please try again later.' }, 429);
      const u = await getUser(env, email);
      if (u) await mail(env, email, 'Reset your password', '<p>Tap the link to choose a new password. It works for one hour.</p><p><a href="' + url.origin + '/?reset=' + (await sign(env.AUTH_SECRET, { e: email, k: 'r', ph: u.hash.slice(0, 12), exp: Date.now() + 3600000 })) + '">Reset my password</a></p><p>If you did not ask for this, ignore this message.</p>');
      return json({ ok: true });
    }
    if (path === '/api/reset' && request.method === 'POST') {
      if (!accounts) return json({ error: 'Accounts are not set up' }, 501);
      let b = {}; try { b = await request.json(); } catch {}
      const o = await check(env.AUTH_SECRET, b.token), password = String(b.password || '');
      if (!o || o.k !== 'r') return json({ error: 'That reset link has expired. Ask for a new one.' }, 400);
      if (!stretched(password)) return json({ error: 'Please refresh the page and try again.' }, 400);
      const u = await getUser(env, o.e);
      if (!u || u.hash.slice(0, 12) !== o.ph) return json({ error: 'That reset link was already used. Ask for a new one.' }, 400);
      u.salt = hex(crypto.getRandomValues(new Uint8Array(16))); u.hash = await pw(env, password, u.salt); u.verified = true; u.tv = (u.tv || 0) + 1;
      await putUser(env, o.e, u); return json({ ok: true });
    }
    if (!accounts) {
      // Single-owner mode: no accounts, open helper endpoints (keep your site private).
      if ((path === '/api/tts' || path === '/api/ai') && env.ALLOW_OPEN_AI === '1') return helper(request, env, path, null);
      return json({ error: 'Not found' }, 404);
    }
    const tk = await who(request, env), email = tk && tk.e;
    if (!email) return json({ error: 'Please sign in.' }, 401);
    const u = await getUser(env, email); if (!u || (u.tv || 0) !== (tk.t || 0)) return json({ error: 'Please sign in.' }, 401);
    if (u.banned) return json({ error: 'This account is suspended.' }, 403);
    if (env.MEETINGSPACE_PRIVATE_PREVIEW !== '0' && accountRole(env,email,u)==='user' && u.terms!=='private-approved') return json({ error: 'Account awaiting administrator approval.' }, 403);
    const role = accountRole(env, email, u);
    const active = role !== 'user' || (env.MEETINGSPACE_PRIVATE_PREVIEW !== '0' && u.terms === 'private-approved') || (u.paidUntil || 0) > Date.now();
    const verified = u.verified !== false;
    if (!verified && (path === '/api/meeting-token' || path === '/api/relay-token' || path === '/api/pay/start' || path === '/api/golive/start' || path.startsWith('/api/connect/') || path === '/api/tts' || path.startsWith('/api/team') || path.startsWith('/api/program'))) return json({ error: 'Please confirm your email first. Check your inbox.' }, 403);
    if (path === '/api/resend' && request.method === 'POST') {
      if (verified) return json({ ok: true });
      if (!(await rate(env, 'rv:' + email, 3, 3600))) return json({ error: 'Too many requests. Try again later.' }, 429);
      return (await sendVerify(env, url, email)) ? json({ ok: true }) : json({ error: 'Could not send the email.' }, 502);
    }

    if (path === '/api/connect/youtube' || path === '/api/connect/facebook') {
      const kind = path.endsWith('youtube') ? 'youtube' : 'facebook';
      const nonce = hex(crypto.getRandomValues(new Uint8Array(16))), hdr = { 'set-cookie': 'oauth_n=' + nonce + '; Path=/api/oauth; Max-Age=600; HttpOnly; Secure; SameSite=Lax' };
      const state = await sign(env.AUTH_SECRET, { e: email, k: kind, n: nonce, tv: u.tv || 0, exp: Date.now() + 600000 });
      if (kind === 'youtube') {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return json({ error: 'YouTube connection is not set up yet.' }, 501);
        return json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: url.origin + '/api/oauth/youtube', response_type: 'code', scope: 'https://www.googleapis.com/auth/youtube', access_type: 'offline', prompt: 'consent select_account', state }) }, 200, hdr);
      }
      if (!env.FB_APP_ID || !env.FB_APP_SECRET) return json({ error: 'Facebook connection is not set up yet.' }, 501);
      return json({ url: 'https://www.facebook.com/' + FBV(env) + '/dialog/oauth?' + new URLSearchParams({ client_id: env.FB_APP_ID, redirect_uri: url.origin + '/api/oauth/facebook', state, scope: 'pages_show_list,pages_read_engagement,pages_manage_posts' }) }, 200, hdr);
    }
    if (path === '/api/connections') return json({ list: (await conns(env, email)).map(({ id, kind, name }) => ({ id, kind, name })) });
    if (path === '/api/connections/remove' && request.method === 'POST') {
      let b = {}; try { b = await request.json(); } catch {}
      await env.TEAMDB.prepare('DELETE FROM conns WHERE email=? AND id=?').bind(email, String(b.id || '')).run(); return json({ ok: true });
    }
    if (path === '/api/golive/start' && request.method === 'POST') {
      if (!active) return json({ error: 'Choose a plan to go live.' }, 402);
      let b = {}; try { b = await request.json(); } catch {}
      const title = String(b.title || 'Live broadcast').slice(0, 100), privacy = ['public', 'unlisted', 'private'].includes(b.privacy) ? b.privacy : 'public';
      const pick = (await conns(env, email)).filter(c => (b.ids || []).includes(c.id)).slice(0, 10), dests = [], errors = [];
      for (const c of pick) await env.TEAMDB.prepare('UPDATE conns SET used=? WHERE email=? AND id=?').bind(Date.now(), email, c.id).run();
      await Promise.all(pick.map(async (c) => {
        try {
          const sec = await decr(env, c.sec);
          if (c.kind === 'youtube') {
            const tok = await ytToken(env, sec);
            const st = await yt('liveStreams?part=snippet,cdn', tok, { snippet: { title: title + ' (stream)' }, cdn: { ingestionType: 'rtmp', resolution: 'variable', frameRate: 'variable' } });
            const br = await yt('liveBroadcasts?part=snippet,status,contentDetails', tok, { snippet: { title, scheduledStartTime: new Date().toISOString() }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true } });
            await yt('liveBroadcasts/bind?id=' + br.id + '&part=id,contentDetails&streamId=' + st.id, tok);
            const ii = st.cdn.ingestionInfo;
            dests.push({ id: c.id, name: c.name, url: ii.ingestionAddress + '/' + ii.streamName, end: { k: 'y', c: c.id, v: br.id } });
          } else {
            const r = await fetch('https://graph.facebook.com/' + FBV(env) + '/' + c.id.slice(3) + '/live_videos', { method: 'POST', body: new URLSearchParams({ status: 'LIVE_NOW', title, access_token: sec }) }).then(r => r.json());
            if (!r.secure_stream_url) throw new Error((r.error && r.error.message) || 'Facebook refused');
            dests.push({ id: c.id, name: c.name, url: r.secure_stream_url, end: { k: 'f', c: c.id, v: r.id } });
          }
        } catch (e) { errors.push(c.name + ': ' + String(e.message || 'failed').slice(0, 110)); }
      }));
      return json({ dests, errors });
    }
    if (path === '/api/golive/end' && request.method === 'POST') {
      let b = {}; try { b = await request.json(); } catch {}
      const all = await conns(env, email);
      await Promise.all((b.ends || []).slice(0, 10).map(async (e) => {
        const c = all.find(x => x.id === e.c); if (!c) return;
        try {
          const sec = await decr(env, c.sec);
          if (e.k === 'y') await yt('liveBroadcasts/transition?broadcastStatus=complete&id=' + encodeURIComponent(e.v) + '&part=status', await ytToken(env, sec));
          else if (e.k === 'f') await fetch('https://graph.facebook.com/' + FBV(env) + '/' + encodeURIComponent(e.v), { method: 'POST', body: new URLSearchParams({ end_live_video: 'true', access_token: sec }) });
        } catch {}
      }));
      return json({ ok: true });
    }
    if (path.startsWith('/api/admin/')) {
      if (!isAdmin(env, email, u)) return json({ error: 'Not allowed.' }, 403);
      const now = Date.now();
      if (path === '/api/admin/sweep' && request.method === 'POST') return json({ ok: true, removed: await sweep(env) });
      if (path === '/api/admin/stats') {
        const DB = env.TEAMDB;
        const u = await DB.prepare('SELECT COUNT(*) users, COALESCE(SUM(paid>?),0) active, COALESCE(SUM(verified=0),0) unv, COALESCE(SUM(created>?),0) nw FROM users').bind(now, now - 7 * 864e5).first();
        const p = await DB.prepare('SELECT COALESCE(SUM(amount),0) a, COALESCE(SUM(CASE WHEN ts>? THEN amount END),0) d30, COALESCE(SUM(CASE WHEN ts>? THEN amount END),0) d7 FROM payments').bind(now - 30 * 864e5, now - 7 * 864e5).first();
        const recent = (await DB.prepare('SELECT plan, amount, ts FROM payments ORDER BY ts DESC LIMIT 10').all()).results;
        return json({ users: u.users, active: u.active, unverified: u.unv, newWeek: u.nw, revenue: { all: p.a, d30: p.d30, d7: p.d7 }, currency: cur(env), recent });
      }
      if (path === '/api/admin/users') {
        const q = (url.searchParams.get('q') || '').toLowerCase().replace(/[^a-z0-9@._+-]/g, '');
        const off = Math.max(0, parseInt(url.searchParams.get('cursor')) || 0);
        const r = await env.TEAMDB.prepare('SELECT email,paid pu,verified v,created c,banned b,role FROM users WHERE email LIKE ? ORDER BY email LIMIT 26 OFFSET ?').bind(q + '%', off).all();
        return json({ users: r.results.slice(0, 25).map(x => ({ ...x, role: accountRole(env, x.email, x) })), cursor: r.results.length > 25 ? String(off + 25) : '' });
      }
      if (request.method === 'POST') {
        let b = {}; try { b = await request.json(); } catch {}
        const t = loginId(b.email), tu = await getUser(env, t);
        if (!(await rate(env, 'manage:' + email, 60, 3600))) return json({ error: 'Too many changes. Please try later.' }, 429);
        if (path === '/api/admin/create') {
          const nextRole = b.role || 'user';
          if (!validEmail(t) || !stretched(b.password) || !['user', 'admin'].includes(nextRole)) return json({ error: 'Enter a valid username, password and role.' }, 400);
          if (tu) return json({ error: 'That account already exists.' }, 409);
          if (role !== 'owner' && (nextRole !== 'user' || reserved(env, t))) return json({ error: 'Only the owner can create admins.' }, 403);
          if (reserved(env, t) && !(role === 'owner' && t === 'admin@studio.local' && nextRole === 'admin')) return json({ error: 'This login is reserved. Choose another username.' }, 403);
          const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
          // INSERT (not upsert): concurrent creates must never replace an existing password.
          const result = await env.TEAMDB.prepare('INSERT OR IGNORE INTO users(email,salt,hash,paid,verified,banned,tv,created,seen,role,terms) VALUES(?,?,?,0,1,0,0,?,?,?,?)').bind(t, salt, await pw(env, b.password, salt), now, now, nextRole, 'private-approved').run();
          return result.meta.changes ? json({ ok: true, email: t, role: nextRole }, 201) : json({ error: 'That account already exists.' }, 409);
        }
        if (!tu) return json({ error: 'User not found.' }, 404);
        const targetRole = accountRole(env, t, tu);
        if (targetRole === 'owner' || (role !== 'owner' && targetRole !== 'user') || t === email) return json({ error: 'This account is protected. Use My password for your own account.' }, 403);
        if (path === '/api/admin/password') {
          if (!stretched(b.password)) return json({ error: 'Enter a new password.' }, 400);
          tu.salt = hex(crypto.getRandomValues(new Uint8Array(16))); tu.hash = await pw(env, b.password, tu.salt); tu.tv = (tu.tv || 0) + 1; tu.verified = true;
        }
        else if (path === '/api/admin/role') {
          if (role !== 'owner' || !['user', 'admin'].includes(b.role) || reserved(env, t)) return json({ error: 'Only the owner can change admin roles.' }, 403);
          tu.role = b.role; tu.tv = (tu.tv || 0) + 1;
        }
        else if (path === '/api/admin/approve') { tu.terms = b.approved === true ? 'private-approved' : 'private-revoked'; tu.tv = (tu.tv || 0) + 1; }
        else if (path === '/api/admin/grant') { const d = Math.max(-30, Math.min(365, +b.days || 0)); tu.paidUntil = Math.max(now, tu.paidUntil || 0) + d * 864e5; if (d < 0 && tu.paidUntil < now) tu.paidUntil = 0; }
        else if (path === '/api/admin/ban') { tu.banned = !!b.banned; tu.tv = (tu.tv || 0) + 1; }
        else return json({ error: 'Not found' }, 404);
        await putUser(env, t, tu); return json({ ok: true });
      }
    }
    if (path === '/api/account/password' && request.method === 'POST') {
      let b = {}; try { b = await request.json(); } catch {}
      if (!(await rate(env, 'change:' + email, 5, 900))) return json({ error: 'Too many attempts. Try again later.' }, 429);
      if (!stretched(b.current) || !safeEq(await pw(env, b.current, u.salt), u.hash)) return json({ error: 'Current password is incorrect.' }, 401);
      if (!stretched(b.password)) return json({ error: 'Enter a new password.' }, 400);
      u.salt = hex(crypto.getRandomValues(new Uint8Array(16))); u.hash = await pw(env, b.password, u.salt); u.tv = (u.tv || 0) + 1;
      await putUser(env, email, u);
      return json({ ok: true, token: await sign(env.AUTH_SECRET, { e: email, t: u.tv, exp: Date.now() + 30 * 864e5 }) });
    }
    if (path === '/api/logout-all' && request.method === 'POST') { u.tv = (u.tv || 0) + 1; await putUser(env, email, u); return json({ ok: true }); }
    if (path === '/api/account/export') {
      const extra = env.TEAMDB ? await exportGroups(env, email) : {};
      return json({ ...extra, email, created: u.created || null, paidUntil: u.paidUntil || 0, emailConfirmed: verified, termsVersion: u.terms || null, termsAcceptedAt: u.termsAt || null, connectedChannels: (await conns(env, email)).map(({ id, kind, name }) => ({ id, kind, name })), note: 'Payment records are kept by us and by Paystack for accounting. Contact support to request them.' });
    }
    if (path === '/api/account/delete' && request.method === 'POST') {
      if (role === 'owner') return json({ error: 'The owner account is protected from deletion.' }, 403);
      let b = {}; try { b = await request.json(); } catch {}
      if (!(await rate(env, 'dl:' + email, 5, 900))) return json({ error: 'Too many attempts. Try again later.' }, 429);
      if ((await pw(env, String(b.password || ''), u.salt)) !== u.hash) return json({ error: 'Wrong password.' }, 401);
      for (const c of await conns(env, email)) {
        if (c.kind === 'youtube') { try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: await decr(env, c.sec) }) }); } catch {} }
      }
      await purgeUser(env, email);
      await env.TEAMDB.prepare('DELETE FROM conns WHERE email=?').bind(email).run(); await env.TEAMDB.prepare('DELETE FROM users WHERE email=?').bind(email).run();
      return json({ ok: true });
    }
    if (path.startsWith('/api/team') || path.startsWith('/api/program')) {
      const tr = await teamRoutes(request, env, url, path, email, active); if (tr) return tr;
    }
    if (path === '/api/me') await env.TEAMDB.prepare('UPDATE users SET seen=?, warned=0 WHERE email=? AND seen<?').bind(Date.now(), email, Date.now() - 864e5).run();
    if (path === '/api/me') return json({ email, paidUntil: u.paidUntil || 0, active, verified, role, admin: isAdmin(env, email, u) });
    if (path === '/api/meeting-token' && env.MEETING_ROOMS) {
      if (!active) return json({ error: 'Choose a plan to start a guest room.' }, 402);
      if (!(await rate(env, 'meeting:' + email, 20, 3600))) return json({ error: 'Too many rooms started. Try again later.' }, 429);
      const room = crypto.randomUUID();
      return json({ url: 'wss://' + url.host + '/meeting/' + room, token: await sign(env.AUTH_SECRET, { k: 'meeting', r: room, u: email, exp: Date.now() + 10 * 60000, pe: (role !== 'user' || (env.MEETINGSPACE_PRIVATE_PREVIEW !== '0' && u.terms === 'private-approved')) ? Date.now() + 86400000 : u.paidUntil }) });
    }
    if (path === '/api/relay-token' || path === '/api/meeting-token') {
      if (!env.RELAY_SECRET || !env.RELAY_URL) return json({ error: 'Streaming server is not set up.' }, 501);
      if (!active) return json({ error: 'Choose a plan to go live.' }, 402);
      return json({ url: env.RELAY_URL, token: await sign(env.RELAY_SECRET, { u: email, exp: Date.now() + 10 * 60000, pe: role !== 'user' ? Date.now() + 24 * 36e5 : u.paidUntil }) });
    }
    if (path === '/api/pay/start' && request.method === 'POST') {
      if (!env.PAYSTACK_SECRET) return json({ error: 'Payments are not set up.' }, 501);
      let b = {}; try { b = await request.json(); } catch {}
      const plan = plans(env).find(p => p.id === b.plan); if (!plan) return json({ error: 'Unknown plan.' }, 400);
      const r = await paystack(env, '/transaction/initialize', { method: 'POST', body: JSON.stringify({ email, amount: Math.round(plan.amount * 100), currency: cur(env), callback_url: url.origin + '/', metadata: { plan: plan.id, user: email } }) });
      return r.status && r.data ? json({ url: r.data.authorization_url }) : json({ error: 'Could not start the payment.' }, 502);
    }
    if (path === '/api/pay/verify') {
      if (!env.PAYSTACK_SECRET) return json({ error: 'Payments are not set up.' }, 501);
      const ref = url.searchParams.get('reference') || '';
      if (!/^[\w.-]{4,100}$/.test(ref)) return json({ error: 'Bad reference.' }, 400);
      const r = await paystack(env, '/transaction/verify/' + encodeURIComponent(ref));
      if (!r.status || !r.data || !r.data.metadata || r.data.metadata.user !== email) return json({ error: 'Payment not found.' }, 404);
      const g = await grant(env, r.data);
      return g ? json({ ok: true, paidUntil: g.paidUntil }) : json({ error: 'Payment is not complete yet.' }, 402);
    }
    if (path === '/api/tts' || path === '/api/ai') {
      if (path === '/api/tts' && !active) return json({ error: 'The announcer voice is part of a paid plan.' }, 402);
      if (!(await limit(env, (path === '/api/tts' ? 't:' : 'a:') + email, path === '/api/tts' ? 20 : active ? 20 : 5))) return json({ error: 'Daily limit reached. Try again tomorrow.' }, 429);
      if (!(await limit(env, 'ai-all', +env.AI_DAILY_CAP || 150))) return json({ error: "Today's free AI allowance has been used up. Try again tomorrow." }, 429);
      return helper(request, env, path, email);
    }
    return json({ error: 'Not found' }, 404);
  }
};

async function helper(request, env, path, email) {
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!env.AI) return json({ error: 'AI binding missing' }, 501);
  let b = {}; try { b = await request.json(); } catch {}
  try {
    if (path === '/api/tts') {
      const text = String(b.text || '').trim().slice(0, 400); if (!text) return json({ error: 'No text' }, 400);
      const r = await env.AI.run('@cf/myshell-ai/melotts', { prompt: text, lang: 'en' });
      return r && r.audio ? json({ audio: r.audio }) : json({ error: 'No audio' }, 502);
    }
    const topic = String(b.topic || '').trim().slice(0, 200), p = PROMPTS[b.task];
    if (!topic || !p) return json({ error: 'Tell me what your broadcast is about.' }, 400);
    const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', { max_tokens: 300, messages: [
      { role: 'system', content: 'You help live streamers write clear, honest, welcoming text in plain English. No false claims or guarantees.' },
      { role: 'user', content: p + topic }] });
    const text = typeof r?.response === 'string' ? r.response.trim() : '';
    return text ? json({ text }) : json({ error: 'The AI writer returned no text. Please try again.' }, 502);
  } catch (e) {
    if (/quota|neuron|daily.*limit|allowance|capacity.*exceeded/i.test(String(e?.message || ''))) return json({ error: 'Cloudflare AI allowance is used up for now. Please try again later; meetings are still available.' }, 429);
    return json({ error: 'The AI service is temporarily unavailable. Please try again later.' }, 502);
  }
}
