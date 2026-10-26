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
  assert.match(guest,/joined=false;try\{shareTrack&&shareTrack\.stop\(\)\}/);
  assert.match(guest,/shareTrack=null;camTrack=null;sharing=false/);
  assert.match(guest,/show\('wait'\)/);
  assert.match(guest,/if\(pc&&pc\.remoteDescription\)/);
  assert.match(guest,/if\(!local\)\{\$\('invrow'\)\.hidden=false/);
});

test('Guest screen sharing closes capture tracks on manual stop and room exit', () => {
  const source=readFileSync(resolve(root,'site/join.html'),'utf8');
  assert.match(source,/shareTrack=null;try\{pc&&pc\.close\(\)\}/);
  assert.match(source,/if\(t&&t\.readyState==='live'\)t\.stop\(\)/);
  assert.match(source,/camTrack=null;sharing=false/);
  assert.match(source,/shareTrack=t;sharing=true/);
});
