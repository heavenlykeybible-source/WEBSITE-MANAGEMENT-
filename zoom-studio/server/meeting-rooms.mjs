// One hibernating Durable Object per meeting. Media stays browser-to-browser;
// this service carries admission, chat and WebRTC signalling only.
const roomClean=(s,n)=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f\u200b\u200e-\u200f\u202a-\u202e\u2066-\u2069<>]/g,'').trim().slice(0,n):'';
const roomICE=[{urls:'stun:stun.cloudflare.com:3478'}];
const safeSignal=data=>{
 if(!data||typeof data!=='object'||Array.isArray(data))return null;
 if(data.sdp&&typeof data.sdp==='object'&&!Array.isArray(data.sdp)&&['offer','answer'].includes(data.sdp.type)&&typeof data.sdp.sdp==='string'&&data.sdp.sdp.length<=16000)
  return {sdp:{type:data.sdp.type,sdp:data.sdp.sdp}};
 if(data.c&&typeof data.c==='object'&&!Array.isArray(data.c)&&typeof data.c.candidate==='string'&&data.c.candidate.length<=4000){
  const c={candidate:data.c.candidate};
  if(typeof data.c.sdpMid==='string'&&data.c.sdpMid.length<=64)c.sdpMid=data.c.sdpMid;
  if(Number.isInteger(data.c.sdpMLineIndex)&&data.c.sdpMLineIndex>=0&&data.c.sdpMLineIndex<1024)c.sdpMLineIndex=data.c.sdpMLineIndex;
  if(typeof data.c.usernameFragment==='string'&&data.c.usernameFragment.length<=256)c.usernameFragment=data.c.usernameFragment;
  return {c};
 }
 return null;
};
export class MeetingRooms {
 constructor(state,env){this.state=state;this.env=env;}
 sockets(){return this.state.getWebSockets().filter(w=>w.readyState===1);}
 data(w){return w.deserializeAttachment()||{};}
 save(w,d){w.serializeAttachment(d);}
 send(w,m){if(w?.readyState===1)try{w.send(JSON.stringify(m));}catch{}}
 host(){return this.sockets().find(w=>this.data(w).role==='host');}
 guests(){return this.sockets().filter(w=>this.data(w).role==='guest');}
 stage(){return this.guests().filter(w=>this.data(w).stage);}
 broadcast(m){for(const w of this.sockets()){const d=this.data(w);if(d.role==='host'||d.ok)this.send(w,m);}}
 count(){this.send(this.host(),{t:'count',n:this.guests().filter(w=>this.data(w).aud).length});}
 close(w,m){this.send(w,m);try{w.close(1000,'Meeting closed');}catch{}}
 end(why){for(const w of this.sockets())this.close(w,{t:'closed',why});}
 async fetch(request){
  const url=new URL(request.url);
  if(request.method!=='GET'||request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  if(url.protocol!=='https:'||request.headers.get('origin')!==url.origin)return new Response('Forbidden',{status:403});
  // Direct browser-to-browser mesh grows quadratically; protect phones and free-tier signalling.
  const configuredCapacity=Number(this.env.MEETING_ROOM_CAP);
  const capacity=Number.isFinite(configuredCapacity)&&configuredCapacity>0?Math.max(2,Math.min(12,Math.floor(configuredCapacity))):8;
  if(this.sockets().length>=capacity)return new Response('Room is full',{status:429});
  const pair=new WebSocketPair(),client=pair[0],server=pair[1];
  this.state.acceptWebSocket(server);
  this.save(server,{role:'',room:url.pathname.split('/')[2],until:Date.now()+15000});
  await this.state.storage.setAlarm(Date.now()+16000);
  return new Response(null,{status:101,webSocket:client});
 }
 async alarm(){
  const host=this.host(),h=host&&this.data(host),now=Date.now();
  if(h&&h.until<=now)this.end('The meeting time has ended.');
  else if(!host&&this.guests().length)this.end('The host is no longer connected.');
  for(const w of this.sockets()){const d=this.data(w);if(!d.role&&d.until<=now)this.close(w,{t:'error',msg:'Please reconnect.'});}
  if(this.sockets().length)await this.state.storage.setAlarm(now+60000);
 }
 async webSocketMessage(ws,raw){
  if(typeof raw!=='string'||raw.length>20000)return this.close(ws,{t:'error',msg:'Invalid message.'});
  let m;try{m=JSON.parse(raw);}catch{return;}
  if(!m||typeof m!=='object'||Array.isArray(m))return;
  const d=this.data(ws),now=Date.now();
  if(now-(d.stampAt||0)>=3000){d.stampAt=now;d.stampN=0;}
  // ICE candidates may arrive in bursts; chat has its own tighter limit below.
  if((d.stampN||0)>=100)return this.close(ws,{t:'error',msg:'Too many messages. Please reconnect.'});
  d.stampN=(d.stampN||0)+1;this.save(ws,d);
  if(!d.role){
   if(now>d.until)return this.close(ws,{t:'error',msg:'Please reconnect.'});
   if(m.t==='host'){
    const a=await check(this.env.AUTH_SECRET,m.token);
    if(!a||a.k!=='meeting'||a.r!==d.room||!a.u||!Number.isFinite(a.pe)||a.pe<=now)return this.close(ws,{t:'error',msg:'Not allowed. Open the room again from your account.'});
    if(this.host())return this.close(ws,{t:'error',msg:'This room already has a host.'});
    Object.assign(d,{role:'host',id:'host',owner:a.u,key:hex(crypto.getRandomValues(new Uint8Array(16))),until:Math.min(a.pe,now+86400000),locked:false,watch:'',audChat:true,slow:0});
    this.save(ws,d);return this.send(ws,{t:'created',room:d.room,key:d.key,ice:roomICE});
   }
   if(m.t==='join'){
    const host=this.host(),h=host&&this.data(host);
    if(!h||h.until<=now||m.room!==h.room||m.key!==h.key)return this.close(ws,{t:'error',msg:'This invite is not valid or the room has ended.'});
    const aud=m.aud===true,guests=this.guests();
    if(h.locked)return this.close(ws,{t:'error',msg:'The host has locked this room.'});
    if(guests.filter(w=>this.data(w).aud===aud).length>=(aud?100:18))return this.close(ws,{t:'error',msg:'This room is full.'});
    Object.assign(d,{role:'guest',id:crypto.randomUUID(),name:roomClean(m.name,30)||(aud?'Viewer':'Guest'),ok:aud,aud,stage:false,invited:false,ao:m.ao===true,last:0});
    // Host authorization is required for each join; client-supplied pass values cannot grant admission.
    this.save(ws,d);this.send(ws,{t:'welcome',ice:roomICE,watch:h.watch,chat:h.audChat,slow:h.slow});
    if(d.ok)this.send(ws,{t:'admitted'});
    if(d.stage)this.send(host,{t:'joined',gid:d.id,name:d.name,ao:d.ao});
    else if(!aud)this.send(host,{t:'waiting',gid:d.id,name:d.name,ao:d.ao});
    this.count();return;
   }
   return;
  }
  const host=this.host(),h=host&&this.data(host);
  if(!h||h.until<=now){this.end('The meeting has ended.');return;}
  const chat=()=>{if(now-(d.last||0)<800)return;d.last=now;this.save(ws,d);this.broadcast({t:'chat',from:d.id,name:d.role==='host'?'Host':d.name,text:roomClean(m.text,300)});};
  if(d.role==='host'){
   // h and d are separate attachment snapshots. Save room controls through h.
   if(m.t==='lock'&&typeof m.on==='boolean'){h.locked=m.on;this.save(host,h);}
   else if(m.t==='watch'){const u=typeof m.url==='string'?m.url.trim():'';let allowed='';if(u.length<=200&&!/[\u0000-\u0020<>"']/.test(u)){try{const parsed=new URL(u);if(parsed.protocol==='https:'&&parsed.hostname&&!parsed.username&&!parsed.password)allowed=parsed.href;}catch{}}h.watch=allowed;this.save(host,h);this.broadcast({t:'watch',url:h.watch});}
   else if(m.t==='audchat'&&typeof m.on==='boolean'){h.audChat=m.on;this.save(host,h);this.broadcast({t:'audchat',on:h.audChat});}
   else if(m.t==='slow'){const seconds=typeof m.sec==='number'?m.sec:NaN;h.slow=Number.isFinite(seconds)?Math.max(0,Math.min(60,Math.floor(seconds))):0;this.save(host,h);this.broadcast({t:'slow',sec:h.slow});}
   else if(m.t==='chat')chat();
   else{
    const g=this.guests().find(w=>this.data(w).id===(m.gid||m.to));if(!g)return;const gd=this.data(g);
    if(m.t==='admit'&&!gd.ok&&!gd.aud){
     if(this.stage().length>=6)return this.send(host,{t:'note',text:'The stage is full (6).'});
     gd.ok=true;gd.stage=true;
     this.save(host,h);this.save(g,gd);this.send(g,{t:'admitted'});this.send(host,{t:'joined',gid:gd.id,name:gd.name,ao:gd.ao});
    }else if(m.t==='deny')this.close(g,{t:'denied'});
    else if(m.t==='kick')this.close(g,{t:'kick'});
    else if(m.t==='mute'&&typeof m.on==='boolean')this.send(g,{t:'mute',on:m.on});
    else if(m.t==='sig'&&gd.stage){const data=safeSignal(m.data);if(data)this.send(g,{t:'sig',data});}
    else if(m.t==='promote'&&gd.aud&&gd.ok){if(this.stage().length>=6)return this.send(host,{t:'note',text:'The stage is full (6).'});gd.invited=true;this.save(g,gd);this.send(g,{t:'promoted'});}
    else if(m.t==='demote'&&gd.stage){gd.stage=false;gd.aud=true;gd.invited=false;this.save(g,gd);this.send(g,{t:'demoted'});this.send(host,{t:'left',gid:gd.id});this.count();}
   }
  }else if(d.ok){
   if(m.t==='sig'&&d.stage){const data=safeSignal(m.data);if(data)this.send(host,{t:'sig',from:d.id,data});}
   else if(m.t==='ready'&&d.invited&&d.aud&&this.stage().length<6){d.invited=false;d.aud=false;d.stage=true;d.ao=m.ao===true;this.save(ws,d);this.send(host,{t:'joined',gid:d.id,name:d.name,ao:d.ao});this.count();}
   else if(m.t==='chat'){
    if(d.aud&&!h.audChat)return this.send(ws,{t:'note',text:'The host turned audience chat off.'});
    if(d.aud&&now-d.last<h.slow*1000)return this.send(ws,{t:'note',text:'Slow mode is on. Please wait a moment.'});chat();
   }else if(m.t==='hand'&&typeof m.on==='boolean')this.send(host,{t:'hand',from:d.id,name:d.name,on:m.on,aud:d.aud});
   else if(m.t==='react'&&now-(d.reacted||0)>800){d.reacted=now;this.save(ws,d);this.send(host,{t:'react',from:d.id,emoji:roomClean(m.emoji,4)});}
  }
 }
 webSocketClose(ws){const d=this.data(ws);if(d.role==='host')this.end('The host left.');else if(d.role==='guest'){this.send(this.host(),{t:'left',gid:d.id});this.count();}}
 webSocketError(ws){try{ws.close(1011,'Connection lost');}catch{}this.webSocketClose(ws);}
}
