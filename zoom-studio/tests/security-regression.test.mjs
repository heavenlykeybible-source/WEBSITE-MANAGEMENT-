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
    fetch: async () => ({ ok: false, type: 'opaque' }),
  });
  assert.equal(typeof handlers.fetch, 'function');
  const intercepts = (path, { method='GET', authorization=false, credentials='same-origin', mode='same-origin' }={}) => {
    let handled = false;
    const headers = new Headers(authorization ? { authorization: 'Bearer secret' } : {});
    const request = { url: 'https://meeting.example' + path, method, headers, credentials, mode };
    handlers.fetch({ request, respondWith(promise) { handled = true; pending.push(promise); } });
    return handled;
  };
  assert.equal(intercepts('/api/me'), false);
  assert.equal(intercepts('/api/health'), false);
  assert.equal(intercepts('/api/meeting-token'), false);
  assert.equal(intercepts('/join.html?token=private', { authorization: true }), false);
  assert.equal(intercepts('/users/private'), false);
  assert.equal(intercepts('/join.html', { method: 'POST' }), false);
  assert.equal(intercepts('/join.html', { mode: 'navigate' }), true);
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
    assert.match(result.stderr,/privacy\\.html/);
    assert.match(result.stderr,/terms\\.html/);
    writeFileSync(resolve(rootTmp,'site/privacy.html'),'<h1>Privacy Policy</h1><p>Example finalized policy content.</p>');
    writeFileSync(resolve(rootTmp,'site/terms.html'),'<h1>Terms of Service</h1><p>Example finalized terms content.</p>');
    result=check();
    assert.equal(result.status,0);
    assert.match(result.stdout,/preflight passed/);
  } finally { rmSync(rootTmp,{recursive:true,force:true}); }
});
