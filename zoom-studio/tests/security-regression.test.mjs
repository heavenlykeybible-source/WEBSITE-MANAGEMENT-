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
  await assert.rejects(verifyAccount8({...env,STUDIO_D1_DATABASE_ID:'9549fc74-f6a8-4cf8-a066-7cb965c59b91'},good),/identity mismatch/);
});
