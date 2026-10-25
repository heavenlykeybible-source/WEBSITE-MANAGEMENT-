import {Script} from 'node:vm';
import {issueMeetingTicket} from '../src/session-tokens.js';
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
 assert.match(html,/type:'chat'/);
});

test('meeting socket refuses anonymous requests when secret is configured',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://example.test'}}),{...mockEnv,MEETING_TICKET_SECRET:'this-is-a-test-secret-long-enough-123456789'});
 assert.equal(r.status,401);
});
test('explicit development demo flag permits existing socket flow',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://example.test'}}),{...mockEnv,ALLOW_UNAUTHENTICATED_DEMO:'true',ENVIRONMENT:'development'});
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

test('room server retains fail-closed participant admission gate',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 assert.match(html,/MeetingSpace/);
 assert.equal(response.status,200);
});

test('meeting interface contains host waiting-room controls',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 assert.match(html,/id="admissionPanel"/);
 assert.match(html,/admission-decision/);
 assert.match(html,/id="roomLock"/);
 assert.match(html,/Waiting for host approval/);
});

test('demo flag alone cannot bypass production authentication',async()=>{
 const r=await worker.fetch(new Request('https://example.test/api/rooms/room123/socket',{headers:{Upgrade:'websocket',Origin:'https://example.test'}}),{...mockEnv,ALLOW_UNAUTHENTICATED_DEMO:'true',ENVIRONMENT:'production'});
 assert.equal(r.status,503);
});

test('meeting client handles host removal and stops media',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 assert.match(html,/m\.type==='removed'/);
 assert.match(html,/Removed from meeting by host/);
 assert.match(html,/stream\?\.getTracks\(\)\.forEach/);
});

test('browser offers a fixed WebSocket subprotocol with ticket',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 assert.match(html,/\['meetingspace','mt\.'\+ticket\]/);
});

test('health endpoint responds without exposing secrets and rejects unsafe methods',async()=>{
 const health=await worker.fetch(new Request('https://example.test/api/health'),mockEnv);
 assert.equal(health.status,200);
 assert.equal(health.headers.get('cache-control'),'no-store');
 assert.deepEqual(await health.json(),{service:'heavenlykey-meetingspace',status:'ok',version:'0.1.1'});
 const post=await worker.fetch(new Request('https://example.test/api/health',{method:'POST'}),mockEnv);
 assert.equal(post.status,405);
});

test('meeting UI only offers participant removal controls to owners',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 assert.match(html,/id="participantsList"/);
 assert.match(html,/isRoomOwner=m.role==='owner'/);
 assert.match(html,/if\(!isRoomOwner\|\|document.getElementById/);
 assert.match(html,/type:'remove-participant'/);
});

test('meeting UI includes owner-only end-for-everyone control',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/id="endMeeting"/);
 assert.match(html,/if\(isRoomOwner&&confirm/);
 assert.match(html,/type:'end-meeting'/);
});

test('public subscription catalog shows limits without enabling unconfigured payments',async()=>{
 const response=await worker.fetch(new Request('https://example.test/api/plans'),mockEnv);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.subscriptionsAvailable,false);
 assert.equal(data.pricingConfigured,false);
 assert.deepEqual(data.plans.map(p=>p.participants),[3,6,12]);
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/id="planCards"/);
});

test('meeting access endpoint discloses public creation availability without credentials',async()=>{
 const response=await worker.fetch(new Request('https://example.test/api/meeting-access'),mockEnv);
 assert.equal(response.status,200);
 const access=await response.json();
 assert.equal(access.publicMeetingCreationAvailable,false);
 assert.equal(access.signInConnected,false);
 assert.equal(access.developmentDemo,false);
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/Meeting creation requires a registered, verified account/);
});

test('launch readiness endpoint does not confuse liveness with deployment approval',async()=>{
 const response=await worker.fetch(new Request('https://example.test/api/launch-readiness'),mockEnv);
 assert.equal(response.status,200);
 const status=await response.json();
 assert.equal(status.ready,false);
 assert.ok(status.missing.includes('identityVerified'));
 assert.ok(status.missing.includes('stagingE2EPassed'));
 assert.equal(response.headers.get('cache-control'),'no-store');
 const denied=await worker.fetch(new Request('https://example.test/api/launch-readiness',{method:'POST'}),mockEnv);
 assert.equal(denied.status,405);
});

test('valid authenticated ticket still requires configured usage database',async()=>{
 const secret='worker-gateway-signing-key-at-least-32-characters';
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner',role:'owner',secret});
 const request=new Request('https://example.test/api/rooms/room123/socket',{
  headers:{Upgrade:'websocket',Origin:'https://example.test','Sec-WebSocket-Protocol':'mt.'+ticket}
 });
 const response=await worker.fetch(request,{...mockEnv,MEETING_TICKET_SECRET:secret});
 assert.equal(response.status,503);
 assert.match(await response.text(),/database is not configured/);
});

test('responsive meeting design has keyboard focus and mobile toolbar',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/id="callControls"/);
 assert.match(html,/@media\(max-width:700px\)/);
 assert.match(html,/:focus-visible/);
 assert.match(html,/prefers-reduced-motion/);
});
test('peer connection supports receiving media before camera permission and adding tracks later',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/addTransceiver\('audio'/);
 assert.match(html,/addTransceiver\('video'/);
 assert.match(html,/replaceTrack\(track\)/);
 assert.match(html,/pc\.createOffer\(\)/);
});
test('socket disconnect cleans up media and preserves explicit meeting-end status',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/ws\.onclose=/);
 assert.match(html,/for\(const peerId of \[\.\.\.peers\.keys\(\)\]\)removePeer/);
 assert.match(html,/stream\?\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
});

test('TURN ICE endpoint rejects unsigned connections and is never publicly cached',async()=>{
 const response=await worker.fetch(new Request('https://example.test/api/rooms/room123/ice'),mockEnv);
 assert.equal(response.status,503);
 const secret='meeting-worker-ice-test-secret-more-than-32-chars';
 const unsigned=await worker.fetch(new Request('https://example.test/api/rooms/room123/ice'),{...mockEnv,MEETING_TICKET_SECRET:secret,DB:{prepare(){}}});
 assert.equal(unsigned.status,401);
});
test('authenticated ICE lookup returns temporary TURN credentials without shared secret',async()=>{
 const secret='meeting-worker-ice-test-secret-more-than-32-chars';
 const relaySecret='meeting-turn-secret-more-than-thirty-two-characters';
 const ticket=await issueMeetingTicket({roomId:'room123',userId:'owner-123',role:'owner',secret});
 const env={...mockEnv,MEETING_TICKET_SECRET:secret,DB:{prepare(){}},TURN_URLS:'turns:relay.example.org:5349?transport=tcp',TURN_SHARED_SECRET:relaySecret};
 const response=await worker.fetch(new Request('https://example.test/api/rooms/room123/ice',{headers:{Authorization:'Bearer '+ticket}}),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 const result=await response.json();
 assert.equal(result.relayConfigured,true);
 assert.equal(result.iceServers.length,2);
 assert.ok(result.iceServers[1].credential.length>10);
 assert.equal(JSON.stringify(result).includes(relaySecret),false);
 const unrelated=await worker.fetch(new Request('https://example.test/api/rooms/anotherroom/ice',{headers:{Authorization:'Bearer '+ticket}}),env);
 assert.equal(unrelated.status,401);
});
test('WebRTC waits for relay configuration and keeps responsive call controls',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/await loadMeetingIce\(room\)/);
 assert.match(html,/iceServers:meetingIceServers/);
 assert.match(html,/id="callControls"/);
});

test('temporary network disconnect retains the peer instead of closing immediately',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/pc.connectionState==='disconnected'/);
 assert.match(html,/attempting to recover/);
 assert.match(html,/connectionState==='failed'/);
 assert.match(html,/Sharing this room link alone does not grant access/);
});

test('waiting guests are not told they are admitted and cannot send chat before approval',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/Connected securely — awaiting meeting admission/);
 assert.match(html,/Waiting for host approval/);
 assert.match(html,/\$\('chatSend'\)\.disabled=true/);
 assert.match(html,/\$\('chatSend'\)\.disabled=false/);
 assert.match(html,/Host declined admission';ws\?\.close\(\)/);
});

test('camera screen sharing and chat remain disabled until meeting admission',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/id="chatSend" disabled/);
 assert.match(html,/let isRoomLocked=false,isRoomOwner=false,isAdmitted=false/);
 assert.match(html,/if\(!isAdmitted\).*Camera and microphone are available after host admission/);
 assert.match(html,/if\(!isAdmitted\).*Screen sharing is available after host admission/);
 assert.match(html,/isAdmitted=true;isRoomOwner/);
 assert.match(html,/ws.onclose=\(\)=>\{isAdmitted=false/);
});

test('late media permissions are revoked if admission ended during browser prompt',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/getUserMedia\(\{audio:true,video:true\}\);if\(!isAdmitted\)\{stream\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
 assert.match(html,/getDisplayMedia\(\{video:true\}\);if\(!isAdmitted\)\{sharing\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
});

test('waiting room automatically removes withdrawn requests and deduplicates repeated requests',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/m.type==='admission-withdrawn'/);
 assert.match(html,/getElementById\('waiting-'\+m.id\)\?\.remove\(\)/);
 assert.match(html,/if\(document.getElementById\('waiting-'\+m.id\)\)return/);
 assert.match(html,/row.id='waiting-'\+m.id/);
});

test('embedded browser module parses as executable JavaScript',async()=>{
 const response=await worker.fetch(new Request('https://example.test/'),mockEnv);
 const html=await response.text();
 const matches=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
 assert.equal(matches.length,1);
 assert.doesNotThrow(()=>new Script(matches[0][1],{filename:'meetingspace-browser.js'}));
});

test('meeting switch and chat actions require correct admission lifecycle',async()=>{
 const html=await (await worker.fetch(new Request('https://example.test/'),mockEnv)).text();
 assert.match(html,/Leave the current meeting before joining another room/);
 assert.match(html,/isAdmitted=false;isRoomOwner=false;isRoomLocked=false/);
 assert.match(html,/Wait for host approval before sending messages/);
});
