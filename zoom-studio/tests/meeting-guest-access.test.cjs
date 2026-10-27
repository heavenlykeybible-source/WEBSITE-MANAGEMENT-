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
    check: async (_secret,token) => token === 'valid' ? { e:'member@example.com', t:2, exp:now+60000 } : token === 'purpose' ? {e:'member@example.com',k:'verify',t:2,exp:now+60000} : null,
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
  const r=new Room({getWebSockets:()=>sockets}, {AUTH_SECRET:'secret',MEETINGSPACE_PRIVATE_PREVIEW:'0'});
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
