import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {issueMeetingTicket,verifyMeetingTicket} from '../src/session-tokens.js';
const secret='development-test-key-should-never-be-used-in-production-123';
test('ticket verifies for the correct room',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'user-1',role:'participant',secret,now:1000});
 const claims=await verifyMeetingTicket({ticket,roomId:'room123',secret,now:1001});
 assert.equal(claims.userId,'user-1');
 assert.equal(claims.role,'participant');
});
test('ticket cannot be used in another room',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'user-1',role:'participant',secret,now:1000});
 assert.equal(await verifyMeetingTicket({ticket,roomId:'room456',secret,now:1001}),null);
});
test('expired tickets are rejected',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'user-1',role:'host',secret,now:1000,ttlSeconds:30});
 assert.equal(await verifyMeetingTicket({ticket,roomId:'room123',secret,now:1030}),null);
});
test('modified tickets are rejected',async()=>{
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'user-1',role:'host',secret,now:1000});
 const changed=ticket.slice(0,-2)+(ticket.endsWith('aa')?'bb':'aa');
 assert.equal(await verifyMeetingTicket({ticket:changed,roomId:'room123',secret,now:1001}),null);
});
test('short secrets and excessive TTLs are rejected',async()=>{
 await assert.rejects(()=>issueMeetingTicket({roomId:'room123',userId:'x',role:'host',secret:'short'}));
 await assert.rejects(()=>issueMeetingTicket({roomId:'room123',userId:'x',role:'host',secret,ttlSeconds:10000}));
});
