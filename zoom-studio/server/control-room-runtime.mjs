// Appended to the audited backend by bundle-control-room.mjs.
// MEETING_ASSETS and MEETING_SCHEMA are generated from public files and additive SQL.
const meetingDatabases = new WeakMap();
async function initializeMeetingDatabase(env) {
  if (!env.TEAMDB) throw Error('Meeting database binding is missing.');
  let ready=meetingDatabases.get(env.TEAMDB);
  if (!ready) {
    ready=env.TEAMDB.exec(MEETING_SCHEMA);
    meetingDatabases.set(env.TEAMDB,ready);
    ready.catch(()=>meetingDatabases.delete(env.TEAMDB));
  }
  await ready;
}
async function meetingAsset(request) {
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers:{allow:'GET, HEAD'}});
  let path=new URL(request.url).pathname;
  if(path==='/')path='/index.html';
  const file=MEETING_ASSETS[path];
  if(!file)return new Response('Not found',{status:404});
  const headers={'content-type':file.type,'etag':'"'+file.hash+'"','cache-control':path.startsWith('/bg/')||path.startsWith('/icons/')?'public,max-age=3600':'no-cache'};
  if(request.headers.get('if-none-match')===headers.etag)return new Response(null,{status:304,headers});
  const compressed=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(request.method==='HEAD'?null:stream,{headers});
}
async function controlRoomOwnerLogin(request,env) {
  if(request.method!=='POST')return json({error:'POST only'},405);
  if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Request too large'},413);
  const text=await request.text();if(text.length>4096)return json({error:'Request too large'},413);
  const ticket=new URLSearchParams(text).get('ticket'),claims=await check(env.AUTH_SECRET,ticket);
  if(!claims||claims.k!=='control-owner'||claims.e!=='owner@studio.local'||!/^[a-f0-9-]{36}$/.test(claims.n||''))return json({error:'Open the meeting app from your Control Room again.'},403);
  const used=await env.TEAMDB.prepare('INSERT OR IGNORE INTO limits(k,n,exp) VALUES(?,1,?)').bind('owner-launch:'+claims.n,Math.ceil(claims.exp/1000)).run();
  if(!used.meta.changes)return json({error:'This launch was already used. Open the app from the Control Room again.'},403);
  let owner=await getUser(env,claims.e);
  if(!owner){
    // Creates the initial reserved owner only; no existing identity is overwritten.
    const now=Date.now(),salt=hex(crypto.getRandomValues(new Uint8Array(16))),hash=hex(crypto.getRandomValues(new Uint8Array(32)));
    await env.TEAMDB.prepare("INSERT OR IGNORE INTO users(email,salt,hash,verified,created,seen,role) VALUES(?,?,?,1,?,?,'owner')").bind(claims.e,salt,hash,now,now).run();
    owner=await getUser(env,claims.e);
  }
  if(!owner||owner.role!=='owner'||owner.banned)return json({error:'Owner identity needs private review.'},409);
  const token=await sign(env.AUTH_SECRET,{e:claims.e,t:owner.tv||0,exp:Date.now()+30*864e5});
  const setup=await sign(env.AUTH_SECRET,{k:'owner-password-setup',e:claims.e,t:owner.tv||0,n:crypto.randomUUID(),exp:Date.now()+600000});
  const html='<!doctype html><meta name="referrer" content="no-referrer"><title>Opening meeting app</title><p>Opening your meeting app…</p><script>try{localStorage.setItem("ls_tok",'+JSON.stringify(token)+');localStorage.setItem("ls_owner_setup",'+JSON.stringify(setup)+');location.replace("/");}catch(e){document.body.textContent="Allow browser storage, then open the app from the Control Room again.";}</script>';
  return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'"}});
}
// A fresh Control Room launch can recover this reserved owner's password.
// It cannot reset another user, and the recovery ticket is short-lived and single-use.
async function controlRoomOwnerPassword(request,env){
 if(request.method!=='POST')return json({error:'POST only'},405);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Forbidden'},403);
 const user=await who(request,env);if(!user||user.e!=='owner@studio.local')return json({error:'Open the app as owner from the Control Room.'},403);
 if(Number(request.headers.get('content-length')||0)>4096)return json({error:'Request too large'},413);
 const raw=await request.text();if(raw.length>4096)return json({error:'Request too large'},413);
 let b;try{b=JSON.parse(raw)}catch{return json({error:'Invalid request'},400)}
 const c=await check(env.AUTH_SECRET,b.ticket),owner=await getUser(env,user.e);
 if(!c||c.k!=='owner-password-setup'||c.e!==user.e||!owner||owner.banned||owner.role!=='owner'||c.t!==(owner.tv||0)||(user.t||0)!==(owner.tv||0)||!/^[a-f0-9-]{36}$/.test(c.n||''))return json({error:'Open the app as owner from the Control Room again to set your password.'},403);
 if(!stretched(b.password))return json({error:'Enter your new password.'},400);
 const salt=hex(crypto.getRandomValues(new Uint8Array(16))),hash=await pw(env,b.password,salt),tv=(owner.tv||0)+1;
 // Both statements execute in one transaction; failure cannot consume a ticket alone.
 const result=await env.TEAMDB.batch([
  env.TEAMDB.prepare('UPDATE users SET salt=?,hash=?,tv=? WHERE email=? AND tv=? AND NOT EXISTS (SELECT 1 FROM limits WHERE k=?)').bind(salt,hash,tv,user.e,owner.tv||0,'owner-password:'+c.n),
  env.TEAMDB.prepare('INSERT OR IGNORE INTO limits(k,n,exp) VALUES(?,1,?)').bind('owner-password:'+c.n,c.exp)
 ]);
 if(!result[0]?.meta?.changes)return json({error:'This password setup was already used. Open the app from the Control Room again.'},409);
 return json({ok:true,token:await sign(env.AUTH_SECRET,{e:user.e,t:tv,exp:Date.now()+30*864e5})});
}
export default {
  async fetch(request,env,ctx) {
    const path=new URL(request.url).pathname;
    try {
      if(/^\/meeting\/[a-f0-9-]{36}\/room$/.test(path)){
        if(!env.MEETING_ROOMS)return new Response('Meeting connection is not configured',{status:503});
        return env.MEETING_ROOMS.get(env.MEETING_ROOMS.idFromName(path.split('/')[2])).fetch(request);
      }
      if(path.startsWith('/api/')||path.startsWith('/p/'))await initializeMeetingDatabase(env);
      if(path==='/api/control-login')return await controlRoomOwnerLogin(request,env);
      if(path==='/api/control-password')return await controlRoomOwnerPassword(request,env);
      return await studioApplication.fetch(request,{...env,ASSETS:{fetch:meetingAsset}},ctx);
    }catch(e){return json({error:'Meeting app setup could not complete. Check the dedicated D1 binding and deployment settings.'},503);}
  }
};
