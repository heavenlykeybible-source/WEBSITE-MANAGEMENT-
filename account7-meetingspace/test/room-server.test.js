import test from 'node:test';
import assert from 'node:assert/strict';
import {issueMeetingTicket} from '../src/session-tokens.js';
globalThis.DurableObject=class {constructor(ctx,env){this.ctx=ctx;this.env=env}};
const {MeetingRoom}=await import('../src/room-server.js');
const secret='meeting-room-test-signing-secret-at-least-32-characters';
const url='https://example.test/api/rooms/room123/socket';
const socketRequest=ticket=>new Request(url,{headers:{Upgrade:'websocket',Authorization:'Bearer '+ticket}});
test('meeting server rejects unauthenticated upgrade',async()=>{
 const room=new MeetingRoom({}, {MEETING_TICKET_SECRET:secret});
 assert.equal((await room.fetch(new Request(url,{headers:{Upgrade:'websocket'}}))).status,401);
});
test('participants cannot create a room before an owner joins',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'guest',role:'participant',secret});
 const room=new MeetingRoom({}, {MEETING_TICKET_SECRET:secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,403);
});
test('room rejects tokens signed for a different meeting',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room456',userId:'owner',role:'owner',secret});
 const room=new MeetingRoom({}, {MEETING_TICKET_SECRET:secret});
 assert.equal((await room.fetch(socketRequest(ticket))).status,401);
});
test('anonymous demo is disabled outside development',async()=>{
 const room=new MeetingRoom({}, {ALLOW_UNAUTHENTICATED_DEMO:'true',ENVIRONMENT:'production'});
 assert.equal((await room.fetch(new Request(url,{headers:{Upgrade:'websocket'}}))).status,401);
});
