// Live Studio relay v3: accounts mode (many subscribers) with automatic backup.
// Needs Node 18+, FFmpeg, and: npm i ws
// Accounts mode:  RELAY_SECRET=same-value-as-Pages PORT=8080 FALLBACK=./fallback/backup.mp4 node relay.js
// Single owner:   TOKEN=choose-a-password PORT=8080 node relay.js
// Each CPU core supports roughly one live subscriber. Set MAX_SESSIONS to match your server.
// Optional: ALLOWED_ORIGIN=https://your-site (only your site may connect), MAX_GUESTS (stage), MAX_AUDIENCE (viewers per room), MAX_ROOMS,
// ICE_JSON='[{"urls":"turn:host:3478","username":"u","credential":"p"}]' (a TURN server helps guests behind strict networks).
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const dns = require('dns').promises;
const { isIP } = require('net');

const SECRET = process.env.RELAY_SECRET || '', TOKEN = process.env.TOKEN || '';
if (!SECRET && !TOKEN) { console.error('Set RELAY_SECRET (accounts) or TOKEN (single password).'); process.exit(1); }
if ((SECRET && SECRET.length < 32) || (TOKEN && TOKEN.length < 12)) { console.error('RELAY_SECRET must be 32+ characters and TOKEN 12+ characters.'); process.exit(1); }
const tokOk = (t) => { const a = Buffer.from(String(t || '')), b = Buffer.from(TOKEN); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const FALLBACK = process.env.FALLBACK || '';
const STALL = (+process.env.STALL_SECONDS || 8) * 1000;
const FB_MAX = (+process.env.FALLBACK_MAX_MINUTES || 0) * 60000;
const MAX = +process.env.MAX_SESSIONS || 3;
const MAX_GUESTS = +process.env.MAX_GUESTS || 6, MAX_ROOMS = +process.env.MAX_ROOMS || 3; // MAX_GUESTS = people on stage
let EXTRA_ICE = []; try { EXTRA_ICE = JSON.parse(process.env.ICE_JSON || '[]'); } catch {}
const ICE = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }, ...EXTRA_ICE];
const wss = new WebSocketServer({ port: process.env.PORT || 8080, maxPayload: 8 * 1024 * 1024 });
const sessions = new Map();

function auth(t) {
  if (SECRET) {
    const [p, sig] = String(t || '').split('.');
    if (p && sig) {
      const good = crypto.createHmac('sha256', SECRET).update(p).digest('hex');
      if (sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) {
        try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); if (o.u && o.exp > Date.now()) return { id: o.u, pe: o.pe || 0 }; } catch {}
      }
    }
  }
  return TOKEN && tokOk(t) ? { id: 'owner', pe: 0 } : null;
}
// FFmpeg diagnostics can contain complete destination URLs and private stream keys.
// Drain stderr without logging it; report process failure without exposing credentials.
const ff = (a) => { const p = spawn('ffmpeg', ['-loglevel', 'warning', ...a]); p.stdin.on('error', () => {}); p.stderr.on('data', () => {}); p.on('error', () => console.error('Broadcast media process failed to start.')); return p; };
const dims = (size) => size === 'portrait' ? [720, 1280] : size === 'square' ? [720, 720] : [1280, 720];
const vf = (w, h) => `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;
const TS = ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-b:v', '3000k', '-maxrate', '3000k', '-bufsize', '3000k', '-g', '30',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-f', 'mpegts', 'pipe:1'];
const kill = (p) => { if (p) { try { p.stdin.end(); p.kill('SIGKILL'); } catch {} } };

function startEnc(dests) {
  const tee = dests.map(d => `[f=flv:onfail=ignore]${d}`).join('|');
  return ff(['-fflags', '+genpts', '-use_wallclock_as_timestamps', '1', '-f', 'mpegts', '-i', 'pipe:0',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '3000k', '-maxrate', '3000k', '-bufsize', '6000k', '-g', '60', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-map', '0:v', '-map', '0:a', '-f', 'tee', tee]);
}
const startIngest = (s) => ff(['-i', 'pipe:0', '-vf', vf(s.w, s.h), ...TS]);
function startBackup(s) {
  const card = ['-re', '-f', 'lavfi', '-i', `color=c=0x14202e:s=${s.w}x${s.h}:r=30`];
  if (!FALLBACK || !fs.existsSync(FALLBACK)) return ff([...card, '-re', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', vf(s.w, s.h), ...TS]);
  if (/\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i.test(FALLBACK))
    return ff([...card, '-re', '-stream_loop', '-1', '-i', FALLBACK, '-map', '0:v', '-map', '1:a', '-vf', vf(s.w, s.h), ...TS]);
  return ff(['-re', '-stream_loop', '-1', '-i', FALLBACK, '-vf', vf(s.w, s.h), ...TS]);
}
function pipeOut(s, p) { p.stdout.on('data', d => { if (s.src === p && s.enc.stdin.writable) s.enc.stdin.write(d); }); }
function useBackup(s) {
  kill(s.ing); s.ing = null;
  if (!s.fb) { const b = s.fb = startBackup(s); pipeOut(s, b); b.on('exit', () => { if (s.fb === b) s.fb = null; }); }
  s.src = s.fb; s.fbSince = s.fbSince || Date.now();
  console.log(s.id, 'backup is playing');
}
function newSession(id, dests, size, pe) {
  const [w, h] = dims(size);
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify([dests,size])).digest('hex');
  const s = { id, fingerprint, enc: startEnc(dests), w, h, pe, src: null, fb: null, ing: null, ws: null, last: Date.now(), fbSince: 0 };
  s.enc.stdin.on('error', () => {});
  s.enc.on('exit', () => { if (sessions.get(id) === s) endSession(s); });
  useBackup(s);
  s.timer = setInterval(() => {
    if (s.ing && Date.now() - s.last > STALL) useBackup(s);
    if (FB_MAX && s.fbSince && Date.now() - s.fbSince > FB_MAX) { console.log(id, 'backup limit reached'); endSession(s); }
    if (s.pe && Date.now() > s.pe) { console.log(id, 'plan ended'); if (s.ws && s.ws.readyState === 1) s.ws.send('Your plan has ended.'); endSession(s); }
  }, 1000);
  return s;
}
function endSession(s) {
  if (sessions.get(s.id) !== s) return; sessions.delete(s.id); clearInterval(s.timer);
  kill(s.ing); kill(s.fb); try { s.enc.stdin.end(); setTimeout(() => s.enc.kill('SIGINT'), 1500); } catch {}
  if (s.ws && s.ws.readyState === 1) s.ws.close();
}

const MAX_AUD = +process.env.MAX_AUDIENCE || 1000;
const rooms = new Map();
const rid = () => crypto.randomBytes(8).toString('hex');
const sendj = (ws, o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const members = (r) => [...r.guests.values()];
const audN = (r) => members(r).filter(g => g.aud).length;
const stageN = (r) => members(r).filter(g => g.stage).length;
const waitN = (r) => members(r).filter(g => !g.aud && !g.stage).length;
function broadcast(room, o) { sendj(room.host, o); for (const g of room.guests.values()) if (g.ok) sendj(g.ws, o); }
function closeRoom(room, why) {
  if (!rooms.delete(room.id)) return; clearInterval(room.timer); clearInterval(room.t2);
  for (const g of room.guests.values()) { sendj(g.ws, { t: 'closed', why }); try { g.ws.close(); } catch {} }
  sendj(room.host, { t: 'closed', why }); try { room.host.close(); } catch {}
}
// Rooms: the studio (host) talks to two kinds of people through here.
//  - Stage guests (limited, MAX_GUESTS): video and audio go directly browser to browser.
//  - Audience (large, MAX_AUDIENCE): chat, raise hand and reactions only. No video upload, so they cost almost nothing.
// The host can invite an audience member to the stage and move a guest back to the audience.
function roomConn(ws) {
  let role = '', room = null, me = null, stamps = [];
  const idle = setTimeout(() => { if (!role) ws.close(); }, 10000);
  const flood = () => { const n = Date.now(); stamps = stamps.filter(t => n - t < 3000); stamps.push(n); return stamps.length > 8; };
  ws.on('message', (data, isBinary) => {
    if (isBinary || data.length > 20000) return;
    let m; try { m = JSON.parse(data.toString()); } catch { return; }
    if (!role) {
      if (m.t === 'host') {
        const a = auth(m.token); if (!a) { sendj(ws, { t: 'error', msg: 'Not allowed. Sign in again.' }); return ws.close(); }
        for (const x of [...rooms.values()]) if (x.owner === a.id) closeRoom(x, 'replaced');
        if (rooms.size >= MAX_ROOMS) { sendj(ws, { t: 'error', msg: 'The server is full right now.' }); return ws.close(); }
        room = { id: rid(), key: crypto.randomBytes(8).toString('hex'), owner: a.id, pe: a.pe, host: ws, guests: new Map(), locked: false, admitted: new Set(), watch: '', audChat: true, slow: 0, dirty: false };
        room.timer = setInterval(() => { if (room.pe && Date.now() > room.pe) closeRoom(room, 'Your plan has ended.'); }, 5000);
        room.t2 = setInterval(() => { if (room.dirty) { room.dirty = false; sendj(room.host, { t: 'count', n: audN(room) }); } }, 2000);
        rooms.set(room.id, room); role = 'host'; clearTimeout(idle);
        return sendj(ws, { t: 'created', room: room.id, key: room.key, ice: ICE });
      }
      if (m.t === 'join') {
        const r = rooms.get(String(m.room));
        if (!r || r.key !== m.key) { sendj(ws, { t: 'error', msg: 'This invite is not valid or the room has ended.' }); return ws.close(); }
        const aud = m.aud === true;
        if (!aud && r.locked) { sendj(ws, { t: 'error', msg: 'The host has locked this room.' }); return ws.close(); }
        if (!aud && waitN(r) + stageN(r) >= MAX_GUESTS * 3) { sendj(ws, { t: 'error', msg: 'This room is full.' }); return ws.close(); }
        if (aud && audN(r) >= MAX_AUD) { sendj(ws, { t: 'error', msg: 'The audience is full right now.' }); return ws.close(); }
        role = 'guest'; room = r; clearTimeout(idle);
        me = { id: rid(), name: clean(m.name, 30) || (aud ? 'Viewer' : 'Guest'), ws, pass: clean(m.pass, 40), ok: false, aud, stage: false, invited: false, ao: !!m.ao, last: 0 };
        r.guests.set(me.id, me); sendj(ws, { t: 'welcome', ice: ICE, watch: r.watch, chat: r.audChat, slow: r.slow });
        if (aud) { me.ok = true; r.dirty = true; sendj(ws, { t: 'admitted' }); }
        else if (me.pass && r.admitted.has(me.pass) && stageN(r) < MAX_GUESTS) { me.ok = true; me.stage = true; sendj(ws, { t: 'admitted' }); sendj(r.host, { t: 'joined', gid: me.id, name: me.name, ao: me.ao }); }
        else sendj(r.host, { t: 'waiting', gid: me.id, name: me.name, ao: me.ao });
      }
      return;
    }
    if (role === 'host') {
      const g = room.guests.get(m.gid || m.to);
      if (m.t === 'lock') room.locked = !!m.on;
      else if (m.t === 'watch') { const u = String(m.url || '').trim(); room.watch = /^https?:\/\/[^\s<>"']{4,200}$/.test(u) ? u : ''; broadcast(room, { t: 'watch', url: room.watch }); }
      else if (m.t === 'audchat') { room.audChat = !!m.on; broadcast(room, { t: 'audchat', on: room.audChat }); }
      else if (m.t === 'slow') { room.slow = Math.max(0, Math.min(60, +m.sec || 0)); broadcast(room, { t: 'slow', sec: room.slow }); }
      else if (m.t === 'chat') { if (!flood()) broadcast(room, { t: 'chat', from: 'host', name: 'Host', text: clean(m.text, 300) }); }
      else if (g) {
        if (m.t === 'admit' && !g.ok && !g.aud) {
          if (stageN(room) >= MAX_GUESTS) return sendj(room.host, { t: 'note', text: 'The stage is full (' + MAX_GUESTS + ').' });
          g.ok = true; g.stage = true; if (g.pass) room.admitted.add(g.pass); sendj(g.ws, { t: 'admitted' }); sendj(room.host, { t: 'joined', gid: g.id, name: g.name, ao: g.ao });
        }
        else if (m.t === 'deny') { sendj(g.ws, { t: 'denied' }); g.ws.close(); }
        else if (m.t === 'kick') { room.admitted.delete(g.pass); sendj(g.ws, { t: 'kick' }); g.ws.close(); }
        else if (m.t === 'mute') sendj(g.ws, { t: 'mute', on: !!m.on });
        else if (m.t === 'sig' && g.stage) sendj(g.ws, { t: 'sig', data: m.data });
        else if (m.t === 'promote' && g.aud && g.ok) {
          if (stageN(room) >= MAX_GUESTS) return sendj(room.host, { t: 'note', text: 'The stage is full (' + MAX_GUESTS + ').' });
          g.invited = true; sendj(g.ws, { t: 'promoted' });
        }
        else if (m.t === 'demote' && g.stage) { g.stage = false; g.aud = true; g.invited = false; room.dirty = true; sendj(g.ws, { t: 'demoted' }); sendj(room.host, { t: 'left', gid: g.id }); }
      }
    } else if (me.ok) {
      if (m.t === 'sig' && me.stage) sendj(room.host, { t: 'sig', from: me.id, data: m.data });
      else if (m.t === 'ready' && me.invited && stageN(room) < MAX_GUESTS) { me.invited = false; me.aud = false; me.stage = true; me.ao = !!m.ao; if (me.pass) room.admitted.add(me.pass); room.dirty = true; sendj(room.host, { t: 'joined', gid: me.id, name: me.name, ao: me.ao }); }
      else if (m.t === 'chat') {
        const n = Date.now();
        if (me.aud && !room.audChat) return sendj(ws, { t: 'note', text: 'The host turned audience chat off.' });
        if (me.aud && room.slow && n - me.last < room.slow * 1000) return sendj(ws, { t: 'note', text: 'Slow mode is on. Please wait a moment.' });
        if (n - me.last < 800 || flood()) return;
        me.last = n; broadcast(room, { t: 'chat', from: me.id, name: me.name, text: clean(m.text, 300) });
      }
      else if (m.t === 'hand') sendj(room.host, { t: 'hand', from: me.id, name: me.name, on: !!m.on, aud: me.aud });
      else if (m.t === 'react') sendj(room.host, { t: 'react', from: me.id, emoji: clean(m.emoji, 4) });
    }
  });
  ws.on('close', () => {
    clearTimeout(idle);
    if (role === 'host' && room) closeRoom(room, 'The host left.');
    else if (role === 'guest' && room) { room.guests.delete(me.id); room.dirty = true; sendj(room.host, { t: 'left', gid: me.id }); }
  });
}
function isPrivate(ip) {
  const family=isIP(ip);
  // Only global unicast IPv6 is eligible; this also excludes IPv4-mapped and link-local forms.
  if(family===6){const parts=ip.split(':'),first=parseInt(parts[0]||'0',16),second=parseInt(parts[1]||'0',16);return first<0x2000||first>0x3fff||(first===0x2001&&second===0xdb8);}
  if(family!==4)return true;
  const [a,b,c]=ip.split('.').map(Number);
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0&&c===0||b===0&&c===2||b===88&&c===99))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113);
}
async function safeDests(list) {
  // DNS validation is not a substitute for network egress controls: FFmpeg resolves
  // the hostname again when connecting. Deny private/reserved egress at the relay host.
  const out = [];
  for (const d of list.slice(0, 10)) {
    const m = String(d).match(/^rtmps?:\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?(?:\/[A-Za-z0-9._~\/?&=%+-]*)?$/); if (!m||m[1].length>253||m[1].split('.').some(x=>!x||x.length>63||! /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(x))||(m[2]&&(Number(m[2])<1||Number(m[2])>65535))) continue;
    try { const addrs = await dns.lookup(m[1], { all: true }); if (addrs.length && !addrs.some(a => isPrivate(a.address))) out.push(d); } catch {}
  }
  // Never silently start a partial broadcast when a destination was rejected.
  return out.length === list.length ? out : [];
}
wss.on('connection', (ws, req) => {
  const allowed = process.env.ALLOWED_ORIGIN;
  if (allowed && req.headers.origin !== allowed) return ws.close();
  if ((req.url || '').split('?')[0] === '/room') return roomConn(ws);
  const idle = setTimeout(() => { if (!ws.sid) ws.close(); }, 10000);
  ws.buf = []; ws.bufBytes = 0;
  const reject = message => { ws.send(JSON.stringify({type:'error', message})); ws.close(); };
  ws.on('message', async (data, isBinary) => {
    if (ws.starting) {
      if (isBinary) { ws.bufBytes += data.length; if (ws.bufBytes > 8 * 1024 * 1024) { ws.buf = []; return ws.close(1009, 'Startup buffer exceeded'); } ws.buf.push(data); }
      else { try { const m=JSON.parse(data.toString());if(m.type==='stop'){const a=auth(m.token),s=a&&sessions.get(a.id);if(s&&!s.ws)endSession(s);ws.cancelled=true;ws.buf=[];ws.close();} } catch {} }
      return;
    }
    if (!isBinary) {
      let m; try { m = JSON.parse(data.toString()); } catch { return; }
      if (m.type === 'stop') {
        const a=ws.sid?null:auth(m.token), s=sessions.get(ws.sid||(a&&a.id));
        // A reconnecting owner may end an abandoned session, never another active socket.
        if(s&&(s.ws===ws||(!ws.sid&&a&&!s.ws)))endSession(s);
        if(!ws.sid)ws.close();return;
      }
      if (m.type !== 'start') return;
      const a = auth(m.token); if (!a) return reject('Not allowed. Sign in again.');
      ws.starting = true;
      const dests = await safeDests(Array.isArray(m.dests) ? m.dests : []);
      if (ws.cancelled || ws.readyState !== 1) return;
      if (!dests.length) return reject('A destination is invalid or unavailable. Check all destination URLs and try again.');
      let s = sessions.get(a.id);
      const fingerprint=crypto.createHash('sha256').update(JSON.stringify([dests,m.size])).digest('hex');
      if(s&&s.fingerprint!==fingerprint)return reject('A previous broadcast is still running with different destinations. Stop it before starting another.');
      if (!s) {
        if (sessions.size >= MAX) return reject('The server is full right now. Try again soon.');
        s = newSession(a.id, dests, m.size, a.pe); sessions.set(a.id, s);
      }
      ws.sid = a.id; s.ws = ws; s.pe = a.pe; s.last = Date.now();
      kill(s.ing);
      const ing = s.ing = startIngest(s);
      ing.stdout.once('data', () => { if (s.ing === ing && sessions.get(s.id) === s) { s.src = ing; s.fbSince = 0; kill(s.fb); s.fb = null; if (s.ws === ws && ws.readyState === 1) ws.send(JSON.stringify({type:'feed-active'})); console.log(s.id, 'live feed is on'); } });
      pipeOut(s, ing);
      ws.send('Connected. Backup is ready.');
      ws.starting = false; clearTimeout(idle);
      for (const b of ws.buf) if (s.ing && s.ing.stdin.writable) s.ing.stdin.write(b);
      ws.buf = []; ws.bufBytes = 0;
    } else {
      const s = sessions.get(ws.sid);
      if (s && s.ws === ws && s.ing && s.ing.stdin.writable) { s.last = Date.now(); s.ing.stdin.write(data); }
    }
  });
  ws.on('close', () => { clearTimeout(idle); const s = sessions.get(ws.sid); if (s && s.ws === ws) { s.ws = null; useBackup(s); } });
});
console.log('Relay listening on port', process.env.PORT || 8080);

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { for (const s of [...sessions.values()]) endSession(s); setTimeout(() => process.exit(0), 2000); });
