import test from 'node:test';
import assert from 'node:assert/strict';
import {issueMeetingTicket} from '../src/session-tokens.js';
globalThis.DurableObject=class {constructor(ctx,env){this.ctx=ctx;this.env=env}};
const {MeetingRoom}=await import('../src/room-server.js');
const secret='meeting-room-test-signing-secret-at-least-32-characters';
const url='https://example.test/api/rooms/room123/socket';
const socketRequest=ticket=>new Request(url,{headers:{Upgrade:'websocket',Authorization:'Bearer '+ticket}});
const storage=()=>{const data=new Map();return {get:async key=>data.get(key),put:async(key,value)=>{data.set(key,value)},getAlarm:async()=>data.get('__alarm')??null,setAlarm:async value=>{data.set('__alarm',value)},deleteAlarm:async()=>{data.delete('__alarm')}}};
const makeRoom=env=>new MeetingRoom({storage:storage()},env);
test('meeting server rejects unauthenticated upgrade',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 assert.equal((await room.fetch(new Request(url,{headers:{Upgrade:'websocket'}}))).status,401);
});
test('ticketed guests may wait for their host without becoming admitted',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'guest',role:'participant',secret});
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 const originalPair=globalThis.WebSocketPair,originalResponse=globalThis.Response;
 const messages=[];
 try{
  globalThis.WebSocketPair=class {constructor(){return {0:{},1:{accept(){},send(data){messages.push(JSON.parse(data))},addEventListener(){}}}}};
  globalThis.Response=class extends originalResponse {constructor(body,opts){super(body,opts?.status===101?{status:200}:opts)}};
  assert.equal((await room.fetch(socketRequest(ticket))).status,200);
  assert.equal(room.clients.size,1);
  assert.equal([...room.clients.values()][0].admitted,false);
  assert.equal(messages[0].type,'waiting');
 }finally{globalThis.WebSocketPair=originalPair;globalThis.Response=originalResponse}
});
test('room rejects tokens signed for a different meeting',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room456',userId:'owner',role:'owner',secret});
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,401);
});
test('anonymous demo is disabled outside development',async()=>{
 const room=makeRoom({ALLOW_UNAUTHENTICATED_DEMO:'true',ENVIRONMENT:'production'});
 assert.equal((await room.fetch(new Request(url,{headers:{Upgrade:'websocket'}}))).status,401);
});

test('owner identity persists and rejects a different signed owner',async()=>{
 const store=storage();
 const first=makeRoom({MEETING_TICKET_SECRET:secret});
 first.ctx.storage=store;
 const ticketA=await issueMeetingTicket({roomId:'room123',userId:'ownerA',role:'owner',secret});
 const ticketB=await issueMeetingTicket({roomId:'room123',userId:'ownerB',role:'owner',secret});
 globalThis.WebSocketPair=class {constructor(){return {0:{},1:{accept(){},send(){},addEventListener(){}}}}};
 const oldResponse=globalThis.Response;
 try{
  globalThis.Response=class extends oldResponse {constructor(body,opts){if(opts?.status===101){super(body,{status:200});this.statusCode=101}else super(body,opts)}};
  await first.fetch(socketRequest(ticketA));
  const next=makeRoom({MEETING_TICKET_SECRET:secret});next.ctx.storage=store;
  assert.equal((await next.fetch(socketRequest(ticketB))).status,403);
 }finally{globalThis.Response=oldResponse;delete globalThis.WebSocketPair}
});

test('expired persisted alarm blocks connection before socket allocation',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 await room.ctx.storage.setAlarm(Date.now()-1000);
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,403);
});

test('expired meeting alarm permanently closes room to replayed tickets',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',secret});
 await room.ctx.storage.setAlarm(Date.now()-1000);
 await room.alarm();
 assert.ok(await room.ctx.storage.get('meetingClosedAt'));
 assert.equal((await room.fetch(socketRequest(ticket))).status,410);
});

test('restored room capacity takes effect before accepting a new socket',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 await room.ctx.storage.put('roomCapacity',2);
 room.clients.set('first',{});
 room.clients.set('second',{});
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',planId:'pro',secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,429);
 assert.equal(room.capacity,2);
});

test('a persisted host lock refuses a new participant after object recreation',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 await room.ctx.storage.put('roomLocked',true);
 room.ownerId='owner';
 const guestTicket=await issueMeetingTicket({roomId:'room123',userId:'guest',role:'participant',secret});
 assert.equal((await room.fetch(socketRequest(guestTicket))).status,403);
});

test('new pro room uses signed plan capacity at initialization',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',planId:'pro',secret});
 const previousPair=globalThis.WebSocketPair;
 const previousResponse=globalThis.Response;
 try{
  globalThis.WebSocketPair=class {constructor(){return {0:{},1:{accept(){},send(){},addEventListener(){}}}}};
  globalThis.Response=class extends previousResponse {constructor(body,options){super(body,options?.status===101?{status:200}:options)}};
  await room.fetch(socketRequest(ticket));
  assert.equal(room.capacity,12);
  assert.equal(await room.ctx.storage.get('roomCapacity'),12);
 }finally{globalThis.Response=previousResponse;globalThis.WebSocketPair=previousPair}
});

test('room reserves capacity for the host when guests connect first',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 room.clients.set('guest-1',{admitted:false});
 room.clients.set('guest-2',{admitted:false});
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'guest-3',role:'participant',secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,429);
});

test('host-ended meeting persists terminal room state',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 await room.ctx.storage.setAlarm(Date.now()+60000);
 await room.endMeeting('host-ended');
 assert.ok(await room.ctx.storage.get('meetingClosedAt'));
 assert.equal(await room.ctx.storage.getAlarm(),null);
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,410);
});

test('terminal state is persisted before sockets close',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 let closedAfterPersistence=false;
 room.clients.set('guest',{socket:{send(){},close(){closedAfterPersistence=room.ctx.storage.get('meetingClosedAt').then(Boolean)}}});
 await room.endMeeting('host-ended');
 assert.equal(await closedAfterPersistence,true);
 assert.equal(await room.ctx.storage.getAlarm(),null);
});

test('persisted room lock is sent to reconnecting verified owner',async()=>{
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 await room.ctx.storage.put('roomLocked',true);
 const messages=[];
 const oldPair=globalThis.WebSocketPair,oldResponse=globalThis.Response;
 try{
  globalThis.WebSocketPair=class {constructor(){return {0:{},1:{accept(){},send(raw){messages.push(JSON.parse(raw))},addEventListener(){}}}}};
  globalThis.Response=class extends oldResponse {constructor(body,opts){super(body,opts?.status===101?{status:200}:opts)}};
  const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',secret});
  await room.fetch(socketRequest(ticket));
  assert.ok(messages.some(message=>message.type==='room-lock'&&message.locked===true));
 }finally{globalThis.WebSocketPair=oldPair;globalThis.Response=oldResponse}
});

test('host arrival and end call trusted database meeting lifecycle',async()=>{
 const calls=[];
 const db={prepare(sql){return {bind(...args){calls.push({sql,args});return {
  run:async()=>({meta:{changes:1}}),
  first:async()=>({joinedAt:1000,endedAt:null,minutes:0})
 }}}}};
 const room=makeRoom({MEETING_TICKET_SECRET:secret,DB:db});
 const oldPair=globalThis.WebSocketPair,oldResponse=globalThis.Response;
 try{
  globalThis.WebSocketPair=class {constructor(){return {0:{},1:{accept(){},send(){},addEventListener(){},close(){}}}}};
  globalThis.Response=class extends oldResponse {constructor(body,options){super(body,options?.status===101?{status:200}:options)}};
  const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',secret});
  await room.fetch(socketRequest(ticket));
  assert.ok(calls.some(x=>x.sql.includes('host_joined_at')));
  assert.equal(await room.ctx.storage.get('ledgerOwnerId'),'owner');
  await room.endMeeting('host-ended');
  assert.ok(calls.some(x=>x.sql.includes('SET ended_at=')));
 }finally{globalThis.WebSocketPair=oldPair;globalThis.Response=oldResponse}
});

test('failed ledger finalization retains a scheduled retry instead of losing usage',async()=>{
 const db={prepare(){return {bind(){return {first:async()=>({joinedAt:1000,endedAt:null,minutes:0}),run:async()=>{throw Error('D1 unavailable')}}}}}};
 const room=makeRoom({MEETING_TICKET_SECRET:secret,DB:db});
 await room.ctx.storage.put('ledgerRoomId','room123');
 await room.ctx.storage.put('ledgerOwnerId','owner');
 await assert.rejects(room.endMeeting('host-ended'),/D1 unavailable/);
 assert.ok(await room.ctx.storage.get('meetingClosedAt'));
 assert.ok((await room.ctx.storage.getAlarm())>Date.now());
});
