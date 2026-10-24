import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.DurableObject = class {};
const {default: worker} = await import('../src/worker.js');
const mockEnv = {ROOMS:{idFromName(name){return name},get(name){return {fetch:async()=>new Response('routed:'+name)}}}};
test('home renders branded application with defensive headers',async()=>{
 const r=await worker.fetch(new Request('https://example.test/'),mockEnv);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.match(html,/Heavenly Key MeetingSpace/);
 assert.match(html,/Create meeting/);
 assert.match(html,/Join meeting/);
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('unrecognized paths do not serve the application',async()=>{
 const r=await worker.fetch(new Request('https://example.test/not-found'),mockEnv);
 assert.equal(r.status,404);
});
test('room socket requires WebSocket upgrade',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket'),mockEnv);
 assert.equal(r.status,426);
});
test('room identifiers are constrained',async()=>{
 for(const path of ['/api/rooms/short/socket','/api/rooms/bad%20room/socket','/api/rooms/room123/socket/extra']){
  const r=await worker.fetch(new Request('https://example.test'+path),mockEnv);
  assert.equal(r.status,404);
 }
});
test('valid upgraded request reaches its room object',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://example.test'}}),mockEnv);
 assert.equal(r.status,503);
});

test('cross-origin socket requests are rejected',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://other.test'}}),mockEnv);
 assert.equal(r.status,403);
});
test('missing Origin on socket request is rejected',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket'}}),mockEnv);
 assert.equal(r.status,403);
});

test('meeting UI includes accessible chat and send controls',async()=>{
 const r=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await r.text();
 assert.match(html,/id="chatLog" role="log"/);
 assert.match(html,/id="chatInput"/);
 assert.match(html,/id="chatSend"/);
 assert.match(html,/createTextNode\(message\)/);
});

test('chat echoes to sender and identifies server-assigned participant',async()=>{
 const r=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await r.text();
 assert.match(html,/serverParticipantId=m\.id/);
 assert.match(html,/m\.from===serverParticipantId/);
 assert.match(html,/server\.send\(JSON\.stringify\(\{type:'chat',from:id,text:msg\.text\.trim\(\)\}\)\)/);
});

test('meeting socket refuses anonymous requests when secret is configured',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://example.test'}}),{...mockEnv,MEETING_TICKET_SECRET:'this-is-a-test-secret-long-enough-123456789'});
 assert.equal(r.status,401);
});
test('explicit development demo flag permits existing socket flow',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://example.test'}}),{...mockEnv,ALLOW_UNAUTHENTICATED_DEMO:'true'});
 assert.equal(await r.text(),'routed:room123');
});

test('WebRTC buffers early ICE candidates until remote description',async()=>{
 const r=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await r.text();
 assert.match(html,/const pendingIce=new Map\(\)/);
 assert.match(html,/if\(!pc\.remoteDescription\)/);
 assert.match(html,/pendingIce\.delete\(m\.from\)/);
});

test('meeting ticket is not reflected in WebSocket response protocol',async()=>{
 const r=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await r.text();
 assert.doesNotMatch(html,/Sec-WebSocket-Protocol/);
});

test('meeting room displays broadcast integration status',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 assert.match(html,/Live broadcast destinations/);
 assert.match(html,/Encoder: not connected/);
 assert.match(html,/Broadcasting is not yet connected/);
});

test('broadcast status endpoint reports no encoder until configured',async()=>{
 const response=await worker.fetch(new Request('https://example.test/api/broadcast/status'),mockEnv);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 assert.deepEqual(await response.json(),{configured:false,encoder:'disconnected',liveDestinations:0,readyToStream:false});
});
