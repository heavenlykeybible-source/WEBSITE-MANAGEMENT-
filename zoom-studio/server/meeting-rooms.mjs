// One hibernating Durable Object per meeting. Media stays browser-to-browser;
// this service carries admission, chat and WebRTC signalling only.
const roomClean=(s,n)=>String(s||'').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,n);
const roomICE=[{urls:'stun:stun.cloudflare.com:3478'}];
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
  if(request.headers.get('origin')!==url.origin)return new Response('Forbidden',{status:403});
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
    Object.assign(d,{role:'host',id:'host',owner:a.u,key:hex(crypto.getRandomValues(new Uint8Array(16))),until:Math.min(a.pe,now+86400000),locked:false,watch:'',audChat:true,slow:0,admitted:[]});
    this.save(ws,d);return this.send(ws,{t:'created',room:d.room,key:d.key,ice:roomICE});
   }
   if(m.t==='join'){
    const host=this.host(),h=host&&this.data(host);
    if(!h||h.until<=now||m.room!==h.room||m.key!==h.key)return this.close(ws,{t:'error',msg:'This invite is not valid or the room has ended.'});
    const aud=m.aud===true,guests=this.guests();
    if(!aud&&h.locked)return this.close(ws,{t:'error',msg:'The host has locked this room.'});
    if(guests.filter(w=>this.data(w).aud===aud).length>=(aud?100:18))return this.close(ws,{t:'error',msg:'This room is full.'});
    Object.assign(d,{role:'guest',id:crypto.randomUUID(),name:roomClean(m.name,30)||(aud?'Viewer':'Guest'),pass:roomClean(m.pass,40),ok:aud,aud,stage:false,invited:false,ao:!!m.ao,last:0});
    if(!aud&&d.pass&&h.admitted.includes(d.pass)&&this.stage().length<6){d.ok=true;d.stage=true;}
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
   if(m.t==='lock'){h.locked=!!m.on;this.save(host,h);}
   else if(m.t==='watch'){const u=String(m.url||'').trim();h.watch=/^https:\/\/[^\s<>"']{4,200}$/.test(u)?u:'';this.save(host,h);this.broadcast({t:'watch',url:h.watch});}
   else if(m.t==='audchat'){h.audChat=!!m.on;this.save(host,h);this.broadcast({t:'audchat',on:h.audChat});}
   else if(m.t==='slow'){const seconds=Number(m.sec);h.slow=Number.isFinite(seconds)?Math.max(0,Math.min(60,Math.floor(seconds))):0;this.save(host,h);this.broadcast({t:'slow',sec:h.slow});}
   else if(m.t==='chat')chat();
   else{
    const g=this.guests().find(w=>this.data(w).id===(m.gid||m.to));if(!g)return;const gd=this.data(g);
    if(m.t==='admit'&&!gd.ok&&!gd.aud){
     if(this.stage().length>=6)return this.send(host,{t:'note',text:'The stage is full (6).'});
     gd.ok=true;gd.stage=true;if(gd.pass&&!h.admitted.includes(gd.pass))h.admitted=h.admitted.concat(gd.pass).slice(-20);
     this.save(host,h);this.save(g,gd);this.send(g,{t:'admitted'});this.send(host,{t:'joined',gid:gd.id,name:gd.name,ao:gd.ao});
    }else if(m.t==='deny')this.close(g,{t:'denied'});
    else if(m.t==='kick'){h.admitted=h.admitted.filter(p=>p!==gd.pass);this.save(host,h);this.close(g,{t:'kick'});}
    else if(m.t==='mute')this.send(g,{t:'mute',on:!!m.on});
    else if(m.t==='sig'&&gd.stage)this.send(g,{t:'sig',data:m.data});
    else if(m.t==='promote'&&gd.aud&&gd.ok){if(this.stage().length>=6)return this.send(host,{t:'note',text:'The stage is full (6).'});gd.invited=true;this.save(g,gd);this.send(g,{t:'promoted'});}
    else if(m.t==='demote'&&gd.stage){gd.stage=false;gd.aud=true;gd.invited=false;this.save(g,gd);this.send(g,{t:'demoted'});this.send(host,{t:'left',gid:gd.id});this.count();}
   }
  }else if(d.ok){
   if(m.t==='sig'&&d.stage)this.send(host,{t:'sig',from:d.id,data:m.data});
   else if(m.t==='ready'&&d.invited&&this.stage().length<6){d.invited=false;d.aud=false;d.stage=true;d.ao=!!m.ao;this.save(ws,d);this.send(host,{t:'joined',gid:d.id,name:d.name,ao:d.ao});this.count();}
   else if(m.t==='chat'){
    if(d.aud&&!h.audChat)return this.send(ws,{t:'note',text:'The host turned audience chat off.'});
    if(d.aud&&now-d.last<h.slow*1000)return this.send(ws,{t:'note',text:'Slow mode is on. Please wait a moment.'});chat();
   }else if(m.t==='hand')this.send(host,{t:'hand',from:d.id,name:d.name,on:!!m.on,aud:d.aud});
   else if(m.t==='react'&&now-(d.reacted||0)>800){d.reacted=now;this.save(ws,d);this.send(host,{t:'react',from:d.id,emoji:roomClean(m.emoji,4)});}
  }
 }
 webSocketClose(ws){const d=this.data(ws);if(d.role==='host')this.end('The host left.');else if(d.role==='guest'){this.send(this.host(),{t:'left',gid:d.id});this.count();}}
 webSocketError(ws){try{ws.close(1011,'Connection lost');}catch{}this.webSocketClose(ws);}
}
