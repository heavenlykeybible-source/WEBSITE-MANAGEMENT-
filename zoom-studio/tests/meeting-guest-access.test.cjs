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
  return {r,host,guest,join,users};
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
