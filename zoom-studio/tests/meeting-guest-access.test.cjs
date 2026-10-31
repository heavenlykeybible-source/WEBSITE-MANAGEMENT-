const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto, randomUUID } = require('node:crypto');

function setup(userOverrides = {}) {
  let source = fs.readFileSync(require('node:path').join(__dirname,'../server/meeting-rooms.mjs'),'utf8');
  source = source.replace('export class MeetingRooms', 'class MeetingRooms');
  const now = Date.now();
  const users = { 'member@example.com': { tv:2, banned:false, role:'user', ...userOverrides } };
  const context = {
    Date, TextEncoder, Uint8Array, URL, Response,
    crypto: { subtle:webcrypto.subtle, getRandomValues:a=>webcrypto.getRandomValues(a), randomUUID },
    btoa:s=>Buffer.from(s,'binary').toString('base64'),
    hex: b=>Buffer.from(b).toString('hex'),
    check: async (_secret,token) => token === 'valid' ? { e:'member@example.com', t:2, exp:now+60000 } : token === 'other-valid' ? { e:'other@example.com', t:2, exp:now+60000 } : token === 'expired' ? {e:'member@example.com',t:2,exp:now-1000} : token === 'missing-exp' ? {e:'member@example.com',t:2} : token === 'purpose' ? {e:'member@example.com',k:'verify',t:2,exp:now+60000} : null,
    getUser: async (_env,email) => users[email] || null,
    accountRole: (_env,_email,u) => u.role
  };
  const Room = vm.runInNewContext(source+'; MeetingRooms',context);
  class Socket {
    constructor(d) { this.attachment=d; this.readyState=1; this.messages=[]; }
    deserializeAttachment() { return structuredClone(this.attachment); }
    serializeAttachment(d) { this.attachment=structuredClone(d); }
    send(s) { this.messages.push(JSON.parse(s)); }
    close() { this.readyState=3; }
  }
  const room='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const host=new Socket({role:'host',room,key:'invite',until:now+60000,admitted:[],locked:false,audChat:true,slow:0});
  const guest=new Socket({role:'',room,until:now+15000});
  const sockets=[host,guest];
  const r=new Room({getWebSockets:()=>sockets,storage:{setAlarm:async()=>{}}}, {AUTH_SECRET:'secret',MEETINGSPACE_PRIVATE_PREVIEW:'0'});
  const join = token => r.webSocketMessage(guest,JSON.stringify({t:'join',room,key:'invite',name:'Guest',pass:'pass',aud:false,accountToken:token}));
  return {r,host,guest,join,users,context,add(){const w=new Socket({role:'',room,until:Date.now()+15000});sockets.push(w);return w;}};
}
test('anonymous guest joins as audience and cannot be promoted on screen', async()=>{
  const h=setup(); await h.join('');
  assert.equal(h.guest.attachment.aud,true);
  assert.equal(h.guest.attachment.ok,true);
  assert.equal(h.guest.attachment.stage,false);
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'promote',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.invited,false);
  assert.match(h.host.messages.at(-1).text,/sign in/i);
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'chat',text:'Hello'}));
  assert.ok(h.host.messages.some(m=>m.t==='chat'&&m.text==='Hello'));
});
test('signed-in guest can wait and be admitted on screen', async()=>{
  const h=setup(); await h.join('valid');
  assert.equal(h.guest.attachment.aud,false);
  assert.equal(h.guest.attachment.stage,false);
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,true);
});
test('purpose tokens and suspended accounts cannot join the stage', async()=>{
  for(const h of [setup(),setup({banned:true})]) {
    await h.join(h.users['member@example.com'].banned?'valid':'purpose');
    assert.equal(h.guest.attachment.aud,true);
    assert.equal(h.guest.attachment.stage,false);
  }
});
test('revoked login cannot be admitted after entering the waiting room', async()=>{
  const h=setup(); await h.join('valid');
  h.users['member@example.com'].tv=3;
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,false);
  assert.match(h.host.messages.at(-1).text,/sign in/i);
});
test('signed-in audience member can be invited and accepts on-screen position', async()=>{
  const h=setup();
  const room=h.guest.attachment.room;
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'join',room,key:'invite',name:'Member',aud:true,accountToken:'valid'}));
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'promote',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.invited,true);
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'ready'}));
  assert.equal(h.guest.attachment.stage,true);
});
test('revoked login cannot accept an existing stage invitation', async()=>{
  const h=setup(),room=h.guest.attachment.room;
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'join',room,key:'invite',aud:true,accountToken:'valid'}));
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'promote',gid:h.guest.attachment.id}));
  h.users['member@example.com'].tv=3;
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'ready'}));
  assert.equal(h.guest.attachment.stage,false);
  assert.equal(h.guest.messages.at(-1).t,'invitation-expired');
});
test('anonymous audience can exchange only bounded viewing signals with host', async()=>{
  const h=setup(); await h.join('');
  assert.ok(h.host.messages.some(m=>m.t==='viewer-join'&&m.gid===h.guest.attachment.id));
  const offer={sdp:{type:'offer',sdp:'v=0'}}, answer={sdp:{type:'answer',sdp:'v=0'}};
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'view-sig',to:h.guest.attachment.id,data:offer}));
  assert.equal(h.guest.messages.at(-1).t,'view-sig');
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'view-sig',data:answer}));
  assert.equal(h.host.messages.at(-1).t,'view-sig');
  const before=h.host.messages.length;
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'sig',data:answer}));
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'view-sig',data:{sdp:{type:'offer',sdp:'x'.repeat(18001)}}}));
  assert.equal(h.host.messages.length,before);
});
test('promotion ends viewer peer and demotion starts a new viewer peer', async()=>{
  const h=setup(),room=h.guest.attachment.room;
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'join',room,key:'invite',aud:true,accountToken:'valid'}));
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'promote',gid:h.guest.attachment.id}));
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'ready'}));
  assert.ok(h.guest.messages.some(m=>m.t==='viewer-end'));
  assert.ok(h.host.messages.some(m=>m.t==='viewer-left'));
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'demote',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.aud,true);
  assert.equal(h.host.messages.at(-2).t,'viewer-join');
});
test('20-person stage is opt-in and never admits a 21st speaker', async()=>{
  const h=setup(); h.r.env.MEETING_STAGE_CAP='20';
  await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  for(let i=1;i<20;i++){
    const g=h.add();
    await h.r.webSocketMessage(g,JSON.stringify({t:'join',room:g.attachment.room,key:'invite',aud:false,accountToken:'valid',name:'Guest '+i}));
    await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:g.attachment.id}));
    assert.equal(g.attachment.stage,true);
  }
  assert.equal(h.r.stage().length,20);
  const extra=h.add();
  await h.r.webSocketMessage(extra,JSON.stringify({t:'join',room:extra.attachment.room,key:'invite',aud:false,accountToken:'valid'}));
  assert.equal(extra.readyState,3);
  assert.equal(h.r.stage().length,20);
});
test('invalid stage setting retains the default of six', async()=>{
  const h=setup();h.r.env.MEETING_STAGE_CAP='NaN';
  await h.join('valid');await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  for(let i=1;i<7;i++){
    const g=h.add();await h.r.webSocketMessage(g,JSON.stringify({t:'join',room:g.attachment.room,key:'invite',aud:false,accountToken:'valid'}));
    await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:g.attachment.id}));
    assert.equal(g.attachment.stage,i<6);
  }
  assert.equal(h.r.stage().length,6);
});
test('guest viewer answers a host offer and displays the received media', async()=>{
  const html=fs.readFileSync(require('node:path').join(__dirname,'../site/join.html'),'utf8');
  const start=html.indexOf('async function onViewSig(d)');
  const end=html.indexOf("$('inv').onclick=",start);
  assert.ok(start>=0&&end>start);
  const sent=[],added=[],video={srcObject:null,play:()=>Promise.resolve()},notes=[];
  class PC {
    constructor(){this.remoteDescription=null;}
    async setRemoteDescription(d){this.remoteDescription=d;}
    async createAnswer(){return {type:'answer',sdp:'v=0'};}
    async setLocalDescription(d){this.localDescription=d;}
    async addIceCandidate(c){added.push(c);}
    close(){}
  }
  const context={
    viewPc:null,viewPend:[],ice:[],RTCPeerConnection:PC,
    $:id=>{assert.equal(id,'audvideo');return video;},
    send:m=>sent.push(m),note:m=>notes.push(m),
    closeView(){context.viewPc=null;context.viewPend=[];video.srcObject=null;}
  };
  vm.runInNewContext(html.slice(start,end),context);
  const candidate={candidate:'candidate:1'};
  await context.onViewSig({c:candidate});
  await context.onViewSig({sdp:{type:'offer',sdp:'v=0'}});
  assert.equal(sent[0].t,'view-sig');
  assert.equal(sent[0].data.sdp.type,'answer');
  assert.equal(added[0],candidate);
  const stream={id:'remote'};
  context.viewPc.ontrack({streams:[stream]});
  assert.equal(video.srcObject,stream);
  assert.equal(notes.length,0);
});
test('locking a room while guest login is being checked prevents entry', async()=>{
  const h=setup();let resolve;
  h.context.getUser=()=>new Promise(r=>{resolve=r});
  const joining=h.join('valid');
  await new Promise(r=>setImmediate(r));
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'lock',on:true}));
  resolve(h.users['member@example.com']);
  await joining;
  assert.equal(h.guest.readyState,3);
  assert.match(h.guest.messages.at(-1).msg,/locked/i);
});
test('simultaneous admissions for one guest do not create duplicate stage entries', async()=>{
  const h=setup();await h.join('valid');const callbacks=[];
  h.context.getUser=()=>new Promise(r=>callbacks.push(r));
  const cmd=JSON.stringify({t:'admit',gid:h.guest.attachment.id});
  const a=h.r.webSocketMessage(h.host,cmd),b=h.r.webSocketMessage(h.host,cmd);
  await new Promise(r=>setImmediate(r));
  callbacks.forEach(r=>r(h.users['member@example.com']));
  await Promise.all([a,b]);
  assert.equal(h.r.stage().length,1);
  assert.equal(h.host.messages.filter(m=>m.t==='joined').length,1);
});
test('failed viewer connection is retried and stopping removes the peer', async()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../site/index.html'),'utf8');
 const start=html.indexOf('function viewRemove(id)'),end=html.indexOf('async function gAdd(',start);
 assert.ok(start>=0&&end>start);
 const peers=[],timers=[],signals=[],stream={getTracks:()=>[{kind:'video'}],addTrack(){}};
 class PC {
  constructor(){this.connectionState='new';this.signalingState='stable';peers.push(this);}
  addTrack(){}
  async createOffer(){return {type:'offer',sdp:'v=0'};}
  async setLocalDescription(d){this.localDescription=d;}
  close(){this.connectionState='closed';}
 }
 const context={
  viewers:new Map(),viewStream:null,gice:[],gws:{},RTCPeerConnection:PC,
  $:id=>({captureStream:()=>stream}),dest:{stream:{getAudioTracks:()=>[]}},
  gsend:m=>signals.push(m),gSt:()=>{},
  setTimeout:f=>{timers.push(f);return timers.length},clearTimeout:()=>{}
 };
 vm.runInNewContext(html.slice(start,end),context);
 await context.viewAdd('guest');
 assert.equal(peers.length,1);
 peers[0].connectionState='failed';peers[0].onconnectionstatechange();
 assert.equal(timers.length,1);timers.shift()();
 await new Promise(r=>setImmediate(r));
 assert.equal(peers.length,2);assert.equal(peers[0].connectionState,'closed');
 assert.equal(context.viewers.size,1);
 context.viewRemove('guest');
 assert.equal(context.viewers.size,0);
 assert.equal(peers[1].connectionState,'closed');
 assert.equal(signals.filter(m=>m.t==='view-sig').length,2);
});

test('room alarm removes a stage participant after account revocation', async()=>{
  const h=setup();await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,true);
  h.users['member@example.com'].tv=3;
  await h.r.alarm();
  assert.equal(h.guest.readyState,3);
  assert.match(h.guest.messages.at(-1).msg,/expired/i);
});

test('room alarm removes a stage participant after identity expiry', async()=>{
  const h=setup();await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,true);
  h.guest.attachment.identity.expires=Date.now()-1000;
  await h.r.alarm();
  assert.equal(h.guest.readyState,3);
  assert.match(h.guest.messages.at(-1).msg,/expired/i);
});

test('expired or malformed account tokens cannot enter the meeting stage', async()=>{
  for(const token of ['expired','missing-exp']){
    const h=setup();await h.join(token);
    assert.equal(h.guest.attachment.aud,true);
    assert.equal(h.guest.attachment.identity,null);
    await h.r.webSocketMessage(h.host,JSON.stringify({t:'promote',gid:h.guest.attachment.id}));
    assert.equal(h.guest.attachment.stage,false);
  }
});

test('room alarm removes banned and deleted accounts from stage', async()=>{
  for(const action of ['ban','delete']){
    const h=setup();await h.join('valid');
    await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
    assert.equal(h.guest.attachment.stage,true);
    if(action==='ban')h.users['member@example.com'].banned=true;
    else delete h.users['member@example.com'];
    await h.r.alarm();
    assert.equal(h.guest.readyState,3);
    assert.match(h.guest.messages.at(-1).msg,/expired/i);
  }
});

test('room alarm rejects malformed stage identity expiry', async()=>{
  const h=setup();await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,true);
  delete h.guest.attachment.identity.expires;
  await h.r.alarm();
  assert.equal(h.guest.readyState,3);
});

test('expired meeting closes sockets without rearming the room alarm', async()=>{
  const h=setup();
  h.host.attachment.until=Date.now()-1000;
  let alarms=0;
  h.r.state.storage.setAlarm=async()=>{alarms++;};
  await h.r.alarm();
  assert.equal(h.host.readyState,3);
  assert.equal(h.guest.readyState,3);
  assert.equal(alarms,0);
});

test('host rejects malformed or oversized tokens before authentication', async()=>{
  for(const token of [null,42,'','x'.repeat(4097)]){
    const h=setup();
    const incoming=h.add();let checks=0;
    h.context.check=async()=>{checks++;return null;};
    await h.r.webSocketMessage(incoming,JSON.stringify({t:'host',token}));
    assert.equal(incoming.readyState,3);
    assert.equal(checks,0);
    assert.match(incoming.messages.at(-1).msg,/invalid meeting token/i);
  }
});

test('expired stage cannot send signaling or chat before alarm fires', async()=>{
  const h=setup();await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,true);
  h.guest.attachment.identity.expires=Date.now()-1000;
  const before=h.host.messages.length;
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'sig',data:{sdp:{type:'offer',sdp:'v=0'}}}));
  assert.equal(h.guest.readyState,3);
  assert.equal(h.host.messages.length,before);
  assert.match(h.guest.messages.at(-1).msg,/expired/i);
});

test('host cannot deliver a WebRTC offer to an expired stage connection', async()=>{
  const h=setup();await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  assert.equal(h.guest.attachment.stage,true);
  h.guest.attachment.identity.expires=Date.now()-1000;
  const count=h.guest.messages.filter(m=>m.t==='sig').length;
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'sig',gid:h.guest.attachment.id,data:{sdp:{type:'offer',sdp:'v=0'}}}));
  assert.equal(h.guest.readyState,3);
  assert.equal(h.guest.messages.filter(m=>m.t==='sig').length,count);
  assert.match(h.guest.messages.at(-1).msg,/expired/i);
});

test('host live reactions have a counter, bounded animation and reduced-motion support',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../site/index.html'),'utf8');
 assert.match(html,/id="greactions"/);
 assert.match(html,/id="greaction-layer"/);
 assert.match(html,/function showLiveReaction\(emoji\)/);
 assert.match(html,/while\(layer.children.length>12\)/);
 assert.match(html,/prefers-reduced-motion:reduce/);
 assert.match(html,/showLiveReaction\(m.emoji\)/);
});

test('reactions reach admitted viewers and host, not pending connections', async()=>{
 const h=setup();await h.join('');const pending=h.add();
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'react',emoji:'❤️'}));
 assert.ok(h.host.messages.some(m=>m.t==='react'&&m.emoji==='❤️'));
 assert.ok(h.guest.messages.some(m=>m.t==='react'&&m.emoji==='❤️'));
 assert.equal(pending.messages.some(m=>m.t==='react'),false);
});
test('audience live reaction display bounds animation and sanitizes emoji',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../site/join.html'),'utf8');
 assert.match(html,/function showMeetingReaction\(emoji\)/);
 assert.match(html,/while\(layer.children.length>10\)/);
 assert.match(html,/case 'react':showMeetingReaction\(m.emoji\)/);
 assert.match(html,/prefers-reduced-motion:reduce/);
});

test('revoked stage account cannot send WebRTC signaling before scheduled alarm',async()=>{
 const h=setup();await h.join('valid');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
 h.users['member@example.com'].tv=3;
 const count=h.host.messages.filter(m=>m.t==='sig').length;
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'sig',data:{sdp:{type:'offer',sdp:'v=0'}}}));
 assert.equal(h.guest.readyState,3);
 assert.equal(h.host.messages.filter(m=>m.t==='sig').length,count);
});
test('host cannot signal to a banned stage participant before scheduled alarm',async()=>{
 const h=setup();await h.join('valid');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
 h.users['member@example.com'].banned=true;
 const count=h.guest.messages.filter(m=>m.t==='sig').length;
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'sig',gid:h.guest.attachment.id,data:{sdp:{type:'offer',sdp:'v=0'}}}));
 assert.equal(h.guest.readyState,3);
 assert.equal(h.guest.messages.filter(m=>m.t==='sig').length,count);
});

test('unsupported live reaction values are not broadcast',async()=>{
 const h=setup();await h.join('');
 const before=h.host.messages.filter(m=>m.t==='react').length;
 for(const emoji of ['<script>','🔥','',42,'❤️❤️']){
  await h.r.webSocketMessage(h.guest,JSON.stringify({t:'react',emoji}));
 }
 assert.equal(h.host.messages.filter(m=>m.t==='react').length,before);
});

test('same-account reconnect can reclaim stage only with matching reconnect secret',async()=>{
 const h=setup();await h.join('valid');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
 const next=h.add();await h.r.webSocketMessage(next,JSON.stringify({t:'join',room:h.host.attachment.room,key:'invite',name:'Returning guest',pass:'pass',aud:false,accountToken:'valid'}));
 assert.equal(next.attachment.stage,false,'a concurrent duplicate must not auto-admit');
 h.guest.close();
 const returning=h.add();await h.r.webSocketMessage(returning,JSON.stringify({t:'join',room:h.host.attachment.room,key:'invite',name:'Returning guest',pass:'pass',aud:false,accountToken:'valid'}));
 assert.equal(returning.attachment.stage,true,'same identity and secret can reconnect');
});
test('stage reconnect secret does not authorize a different signed-in account',async()=>{
 const h=setup();await h.join('valid');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
 h.guest.close();
 h.users['other@example.com']={tv:2,banned:false,role:'user'};
 const other=h.add();
 await h.r.webSocketMessage(other,JSON.stringify({t:'join',room:h.host.attachment.room,key:'invite',name:'Other user',pass:'pass',aud:false,accountToken:'other-valid'}));
 assert.equal(other.attachment.stage,false,'another signed-in user cannot inherit stage');
 assert.equal(other.attachment.aud,false,'different signed-in account remains in waiting room');
 const admitted=h.host.attachment.admitted;
 assert.ok(admitted.every(a=>a&&a.email==='member@example.com'&&a.pass==='pass'));
});

test('stage permissions are checked again before interactive messages',async()=>{
 for(const message of [{t:'chat',text:'blocked'},{t:'hand',on:true},{t:'react',emoji:'❤️'}]){
  const h=setup();await h.join('valid');
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'admit',gid:h.guest.attachment.id}));
  h.users['member@example.com'].tv=3;
  const before=h.host.messages.length;
  await h.r.webSocketMessage(h.guest,JSON.stringify(message));
  assert.equal(h.guest.readyState,3);
  assert.equal(h.host.messages.length,before);
 }
});

test('invalid reactions do not consume the valid reaction cooldown',async()=>{
 const h=setup();await h.join('');
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'react',emoji:'invalid'}));
 assert.equal(h.guest.attachment.reacted||0,0);
 const before=h.host.messages.filter(m=>m.t==='react').length;
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'react',emoji:'👏'}));
 assert.equal(h.host.messages.filter(m=>m.t==='react').length,before+1);
});

test('participant display names strip invisible direction controls',async()=>{
 const h=setup();await h.join('');
 const another=h.add();
 await h.r.webSocketMessage(another,JSON.stringify({t:'join',room:h.host.attachment.room,key:'invite',name:'Safe\u202eName\u200b',pass:'other',aud:true}));
 assert.equal(another.attachment.name,'SafeName');
});

test('meeting watch links reject URL credentials',async()=>{
 const h=setup();await h.join('');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'watch',url:'https://user:pass@example.com/video'}));
 assert.equal(h.host.attachment.watch,'');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'watch',url:'https://example.com/video'}));
 assert.equal(h.host.attachment.watch,'https://example.com/video');
});

test('host chat preserves meeting controls in the socket attachment',async()=>{
 const h=setup();await h.join('');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'lock',on:true}));
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'audchat',on:false}));
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'chat',text:'Welcome everyone'}));
 assert.equal(h.host.attachment.locked,true);
 assert.equal(h.host.attachment.audChat,false);
 assert.ok(h.guest.messages.some(m=>m.t==='chat'&&m.text==='Welcome everyone'));
});

test('malformed meeting identifiers are rejected before WebSocket upgrade',async()=>{
 const h=setup();
 for(const path of ['/meeting/------------------------------------','/meeting/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','/meeting/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa-']){
  const response=await h.r.fetch(new Request('https://example.com'+path,{headers:{upgrade:'websocket',origin:'https://example.com'}}));
  assert.equal(response.status,404,path);
 }
});

test('rapid hand-raise updates are throttled without closing the guest',async()=>{
 const h=setup();await h.join('');
 const before=h.host.messages.filter(m=>m.t==='hand').length;
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'hand',on:true}));
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'hand',on:false}));
 assert.equal(h.host.messages.filter(m=>m.t==='hand').length,before+1);
 assert.equal(h.guest.readyState,1);
});

test('host chat cooldown persists without resetting meeting controls',async()=>{
 const h=setup();await h.join('');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'lock',on:true}));
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'chat',text:'First'}));
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'chat',text:'Second'}));
 assert.equal(h.host.messages.filter(m=>m.t==='chat'&&['First','Second'].includes(m.text)).length,1);
 assert.equal(h.host.attachment.locked,true);
 assert.ok(h.host.attachment.last>0);
});

test('chat strips additional invisible Unicode formatting controls',async()=>{
 const h=setup();await h.join('');
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'chat',text:'A\u061cB\u206aC\u034fD'}));
 assert.ok(h.host.messages.some(m=>m.t==='chat'&&m.text==='ABCD'));
});

test('slow mode accepts only finite integer seconds',async()=>{
 const h=setup();await h.join('');
 for(const [sec,expected] of [[1.8,1],[-4,0],[999,60],['Infinity',0],['not-a-number',0],['5',0],[[5],0],[true,0]]){
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'slow',sec}));
  assert.equal(h.host.attachment.slow,expected);
 }
});

test('watch links reject malformed and non-HTTPS destinations',async()=>{
 const h=setup();await h.join('');
 for(const url of ['https://not-a-valid-host','https://user:pass@example.com/video','https://example.com:0/video','javascript:alert(1)','https://example.com/space here']){
  await h.r.webSocketMessage(h.host,JSON.stringify({t:'watch',url}));
  assert.equal(h.host.attachment.watch,'',url);
 }
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'watch',url:'https://example.com/video'}));
 assert.equal(h.host.attachment.watch,'https://example.com/video');
});

test('malformed WebSocket frames count toward per-connection rate limit',async()=>{
 const h=setup();await h.join('');
 for(let i=0;i<101&&h.guest.readyState===1;i++)await h.r.webSocketMessage(h.guest,'{not-json');
 assert.notEqual(h.guest.readyState,1);
});

test('host moderation rejects invalid switch values',async()=>{
 const h=setup();await h.join('');
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'lock',on:true}));
 await h.r.webSocketMessage(h.host,JSON.stringify({t:'lock',on:'false'}));
 assert.equal(h.host.attachment.locked,true);
});

test('hand raise rejects nonboolean state without consuming cooldown',async()=>{
 const h=setup();await h.join('');
 const before=h.host.messages.filter(m=>m.t==='hand').length;
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'hand',on:'false'}));
 await h.r.webSocketMessage(h.guest,JSON.stringify({t:'hand',on:true}));
 const hands=h.host.messages.filter(m=>m.t==='hand').slice(before);
 assert.equal(hands.length,1);
 assert.equal(hands[0].on,true);
});
