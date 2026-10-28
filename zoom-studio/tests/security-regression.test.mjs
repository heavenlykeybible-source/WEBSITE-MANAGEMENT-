import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(resolve(root, 'site/sw.js'), 'utf8');

test('offline worker never intercepts authenticated API, non-GET or private pages', async () => {
  const pending = [];
  const handlers = {};
  const self = {
    location: { origin: 'https://meeting.example' },
    addEventListener: (kind, fn) => { handlers[kind] = fn; },
  };
  runInNewContext(source, {
    self, URL,
    caches: { open: async () => ({ match: async () => null, put: async () => {} }) },
    Request, fetch: async () => ({ ok: false, type: 'opaque' }),
  });
  assert.equal(typeof handlers.fetch, 'function');
  const intercepts = (path, { method='GET', authorization=false, credentials='same-origin', mode='same-origin' }={}) => {
    let handled = false;
    const headers = new Headers(authorization ? { authorization: 'Bearer secret' } : {});
    const request = mode === 'navigate' ?
      { url: 'https://meeting.example' + path, method, headers, credentials, mode } :
      new Request('https://meeting.example' + path, { method, headers, credentials });
    handlers.fetch({ request, respondWith(promise) { handled = true; pending.push(promise); } });
    return handled;
  };
  assert.equal(intercepts('/api/me'), false);
  assert.equal(intercepts('/api/health'), false);
  assert.equal(intercepts('/api/meeting-token'), false);
  assert.equal(intercepts('/join.html?token=private', { authorization: true }), false);
  assert.equal(intercepts('/users/private'), false);
  assert.equal(intercepts('/join.html', { method: 'POST' }), false);
  assert.equal(intercepts('/join.html', { mode: 'navigate' }), false);
  assert.equal(intercepts('/'), false);
  assert.equal(intercepts('/studio-theme.css'), true);
  assert.equal(intercepts('/manifest.webmanifest'), true);
  assert.equal(intercepts('/icons/icon-192.png'), true);
  assert.equal(intercepts('/bg/globe-doves.jpg'), true);
  assert.equal(intercepts('/join.html', { credentials: 'include' }), false);
  assert.equal(intercepts('/join.html?r=publicroom&k=privatekey'), false);
  assert.equal(intercepts('/?ticket=single-use'), false);
  assert.equal(intercepts('/icons/icon-192.png', { credentials: 'include' }), false);
  await Promise.all(pending);
});

test('production preflight rejects templates but accepts finalized notices', () => {
  const rootTmp=mkdtempSync(resolve(tmpdir(),'account8-legal-'));
  try {
    mkdirSync(resolve(rootTmp,'scripts'));
    mkdirSync(resolve(rootTmp,'site'));
    copyFileSync(resolve(root,'scripts/legal-preflight.mjs'),resolve(rootTmp,'scripts/legal-preflight.mjs'));
    const check=()=>spawnSync(process.execPath,[resolve(rootTmp,'scripts/legal-preflight.mjs')],{encoding:'utf8'});
    writeFileSync(resolve(rootTmp,'site/privacy.html'),'<p>DRAFT TEMPLATE. [BUSINESS NAME] [DATE]</p>');
    writeFileSync(resolve(rootTmp,'site/terms.html'),'<p>Terms for [ADDRESS], [LAWYER TO CONFIRM]</p>');
    let result=check();
    assert.equal(result.status,1);
    assert.ok(result.stderr.includes('privacy.html'));
    assert.ok(result.stderr.includes('terms.html'));
    writeFileSync(resolve(rootTmp,'site/privacy.html'),'<h1>Privacy Policy</h1><p>Example finalized policy content.</p>');
    writeFileSync(resolve(rootTmp,'site/terms.html'),'<h1>Terms of Service</h1><p>Example finalized terms content.</p>');
    result=check();
    assert.equal(result.status,0);
    assert.match(result.stdout,/preflight passed/);
  } finally { rmSync(rootTmp,{recursive:true,force:true}); }
});

test('Account 8 Cloudflare D1 identity verification is read-only and fail-closed', async () => {
  const { verifyAccount8 }=await import('../scripts/verify-deployment-identity.mjs');
  const env={
    MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:'0123456789abcdef0123456789abcdef',
    STUDIO_D1_DATABASE_ID:'f47b2e3f-f937-4d6e-8891-f08d8bc4f6b8',
    CLOUDFLARE_API_TOKEN:'fixture-only'
  };
  let called=0;
  const good=async (url, options)=>{
    called++;
    assert.match(url,/\/d1\/database\/f47b2e3f-f937-4d6e-8891-f08d8bc4f6b8$/);
    assert.equal(options.method,undefined);
    return {ok:true,json:async()=>({success:true,result:{uuid:env.STUDIO_D1_DATABASE_ID,name:'heavenly-key-meetingspace-db'}})};
  };
  assert.equal(await verifyAccount8(env,good),true);
  assert.equal(called,1);
  await assert.rejects(verifyAccount8(env,async()=>({ok:true,json:async()=>({success:true,result:{uuid:env.STUDIO_D1_DATABASE_ID,name:'wrong-db'}})})),/identity mismatch/);
  await assert.rejects(verifyAccount8({...env,CLOUDFLARE_ACCOUNT_ID:'ffffffffffffffffffffffffffffffff'},good),/Conflicting/);
  await assert.rejects(verifyAccount8({...env,STUDIO_D1_DATABASE_ID:'9549fc74-f6a8-4cf8-a066-7cb965c59b91'},good),/cannot reuse an existing shared production database/);
});

test('Account 8 generated Worker config keeps registration closed by default', () => {
  const conf=resolve(root,'scripts/configure.mjs');
  const base={
    ...process.env,
    MEETINGSPACE_TARGET_ACCOUNT:'8',
    MEETINGSPACE_ACCOUNT8_CLOUDFLARE_ID:'6401a8f41a41f5325ba5bd4d006b4ff5',
    CLOUDFLARE_ACCOUNT_ID:'6401a8f41a41f5325ba5bd4d006b4ff5',
    STUDIO_D1_DATABASE_ID:'f47b2e3f-f937-4d6e-8891-f08d8bc4f6b8',
    MEETINGSPACE_ACCOUNT8_DATABASE_CONFIRMED:'1',
    MEETINGSPACE_SHARED_CLOUDFLARE_ACCOUNT:'1'
  };
  const check=(preview)=>{
    const env={...base};delete env.MEETINGSPACE_PRIVATE_PREVIEW;
    if(preview!==undefined)env.MEETINGSPACE_PRIVATE_PREVIEW=preview;
    const result=spawnSync(process.execPath,[conf],{cwd:root,env,encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(readFileSync(resolve(root,'wrangler.generated.json'),'utf8'));
  };
  for(const value of [undefined,'1','unexpected']) {
    const config=check(value);
    assert.equal(config.vars.MEETINGSPACE_PRIVATE_PREVIEW,'1');
    assert.equal(config.d1_databases[0].database_id,base.STUDIO_D1_DATABASE_ID);
    assert.equal(config.name,'heavenly-key-meetingspace');
  }
  assert.equal(check('0').vars.MEETINGSPACE_PRIVATE_PREVIEW,'0');
});

test('Guest WebRTC signaling buffers candidates and reconnects through admission', () => {
  const host=readFileSync(resolve(root,'site/index.html'),'utf8');
  const guest=readFileSync(resolve(root,'site/join.html'),'utf8');
  assert.match(host,/pendingIce:\[\]/);
  assert.match(host,/if\(g\.pc\.remoteDescription\)/);
  assert.match(host,/g\.pendingIce\.splice\(0\)/);
  assert.match(guest,/joined=false;if\(AUD\)\{stopLocal\(\);onStage=false;mode\(false\)\}try\{shareTrack&&shareTrack\.stop\(\)\}/);
  assert.match(guest,/shareTrack=null;camTrack=null;sharing=false/);
  assert.match(guest,/show\('wait'\)/);
  assert.match(guest,/if\(pc&&pc\.signalingState!=='closed'&&pc\.remoteDescription\)/);
  assert.match(guest,/if\(!local\)\{if\(!over&&joined&&epoch===invitationEpoch\)\$\('invrow'\)\.hidden=false/);
});

test('Guest screen sharing closes capture tracks on manual stop and room exit', () => {
  const source=readFileSync(resolve(root,'site/join.html'),'utf8');
  assert.match(source,/shareTrack=null;try\{pc&&pc\.close\(\)\}/);
  assert.match(source,/if\(t&&t\.readyState==='live'\)t\.stop\(\)/);
  assert.match(source,/camTrack=null;sharing=false/);
  assert.match(source,/shareTrack=t;sharing=true/);
});

test('Audio processing releases the original microphone and screen share on stage demotion', () => {
 const source=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(source,/rawMedia=m/);
 assert.match(source,/rawMedia&&rawMedia!==local/);
 assert.match(source,/rawMedia\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
 assert.match(source,/case 'demoted':invitationEpoch\+\+;try\{shareTrack&&shareTrack\.stop\(\)\}/);
});

test('Host retries failed peer media using bounded ICE restarts', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/restartAttempts:0/);
 assert.match(host,/gRestart\(g\)/);
 assert.match(host,/createOffer\(\{iceRestart:true\}\)/);
 assert.match(host,/g\.restartAttempts>=2/);
 assert.match(host,/if\(pc\.connectionState==='connected'\)g\.restartAttempts=0/);
});

test('Joining guards repeated clicks and handles failed websocket creation', () => {
 const source=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(source,/if\(connecting\|\|over\)return/);
 assert.match(source,/connecting=true;\$\('go'\)\.disabled=true/);
 assert.match(source,/connecting=false;\$\('go'\)\.disabled=false/);
 assert.match(source,/if\(over\|\|ws!==currentSocket\)return/);
 assert.match(source,/catch\(e\)\{connecting=false;end\('The meeting link could not open/);
});

test('Screen sharing restores the actual camera and stops captures after setup failures', () => {
 const source=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(source,/const originalTrack=s\.track;await s\.replaceTrack\(t\);if\(over\|\|!joined\|\|!onStage\|\|pc\?\.connectionState==='closed'\)\{await s\.replaceTrack\(originalTrack\)\.catch\(\(\)=>\{\}\);capture\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\);return\}camTrack=originalTrack/);
 assert.match(source,/if\(capture\)capture\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
 assert.match(source,/if\(s&&camTrack\)await s\.replaceTrack\(camTrack\)/);
});

test('Host room start prevents duplicate concurrent creation and ignores stale events', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/if\(gStarting\)return/);
 assert.match(host,/gStarting=true;\$\('grs'\)\.disabled=true/);
 assert.match(host,/finally\{gStarting=false;\$\('grs'\)\.disabled=false\}/);
 assert.match(host,/w\.onmessage=e=>\{if\(gws!==w\)return/);
});

test('Guest signaling bounds early ICE candidates and ignores stale WebSocket messages', () => {
 const source=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(source,/if\(pend\.length<100\)pend\.push\(d\.c\)/);
 assert.match(source,/ws\.onmessage=e=>\{if\(over\|\|ws!==currentSocket\)return/);
 assert.match(source,/ws\.onopen=\(\)=>\{clearTimeout\(openTimer\);openTimer=null;if\(over\|\|ws!==currentSocket\)return/);
});

test('Host room creation has a bounded handshake and safe cleanup', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/gHandshakeTimer=setTimeout\(\(\)=>\{/);
 assert.match(host,/gStop\('The meeting service did not confirm the room/);
 assert.match(host,/function gStop\(msg\)\{clearTimeout\(gHandshakeTimer\)/);
 assert.match(host,/if\(m\.t==='created'\)\{clearTimeout\(gHandshakeTimer\)/);
});

test('Guest WebSocket connection timeout is bounded and cleaned up', () => {
 const guest=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(guest,/openTimer=setTimeout\(\(\)=>\{/);
 assert.match(guest,/currentSocket\.readyState===WebSocket\.CONNECTING/);
 assert.match(guest,/clearTimeout\(openTimer\);openTimer=null/);
});

test('Guest handles ICE restart offers on existing peer connection without losing media tracks', () => {
 const source=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(source,/if\(pc&&pc\.signalingState==='stable'&&d\.sdp\.type==='offer'&&pc\.connectionState!=='closed'\)/);
 assert.match(source,/await pc\.setRemoteDescription\(d\.sdp\);\s*const answer=await pc\.createAnswer\(\)/);
 assert.match(source,/await pc\.setLocalDescription\(answer\)/);
});

test('Guest ignores stale ICE candidates after peer connection closure', () => {
 const source=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(source,/pc\.signalingState!=='closed'&&pc\.remoteDescription/);
 assert.match(source,/pc\.addIceCandidate\(d\.c\)\.catch\(\(\)=>\{\}\)/);
});

test('Guest join acknowledgement timeout closes stalled sockets and cleans up timers', () => {
 const guest=readFileSync(resolve(root,'site/join.html'),'utf8');
 assert.match(guest,/joinAckTimer=setTimeout\(\(\)=>\{/);
 assert.match(guest,/currentSocket\.readyState===WebSocket\.OPEN/);
 assert.match(guest,/case 'welcome':clearTimeout\(joinAckTimer\);joinAckTimer=null/);
 assert.match(guest,/ws\.onclose=\(\)=>\{if\(over\|\|ws!==currentSocket\)return;invitationEpoch\+\+;clearTimeout\(openTimer\);openTimer=null;clearTimeout\(joinAckTimer\)/);
});

test('ICE restart attempts only count when signaling is stable', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/if\(!pc\|\|pc\.signalingState!=='stable'\|\|!guests\.has\(g\.id\)\|\|g\.restartAttempts>=2\)return;\s*g\.restartAttempts\+\+/);
});

test('Host ignores rejected late ICE candidates without breaking further signaling', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/g\.pc\.addIceCandidate\(d\.c\)\.catch\(\(\)=>\{\}\)/);
 assert.match(host,/else if\(g\.pendingIce\.length<100\)g\.pendingIce\.push\(d\.c\)/);
});

test('Host accepts SDP answers only when an outgoing offer is pending', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/if\(d\.sdp\.type!=='answer'\|\|g\.pc\.signalingState!=='have-local-offer'\)return/);
 assert.match(host,/const activePc=g\.pc;await activePc\.setRemoteDescription\(d\.sdp\)/);
 assert.match(host,/if\(g\.pc!==activePc\|\|activePc\.signalingState==='closed'\)return/);
});

test('Failed host media recovery retries after signaling stabilizes', () => {
 const host=readFileSync(resolve(root,'site/index.html'),'utf8');
 assert.match(host,/pc\.onsignalingstatechange=\(\)=>\{if\(g\.pc===pc&&pc\.signalingState==='stable'&&pc\.connectionState==='failed'\)gRestart\(g\)\}/);
 assert.match(host,/if\(!pc\|\|pc\.signalingState!=='stable'\|\|!guests\.has\(g\.id\)\|\|g\.restartAttempts>=2\)return/);
});
