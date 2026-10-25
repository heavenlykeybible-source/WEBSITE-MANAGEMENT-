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
test('participants cannot create a room before an owner joins',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'guest',role:'participant',secret});
 const room=makeRoom({MEETING_TICKET_SECRET:secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,403);
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
