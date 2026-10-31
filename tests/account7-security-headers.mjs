import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../heavenly-key-accounts/account-07-unverified/source/', import.meta.url);
const headers = readFileSync(new URL('_headers', root), 'utf8');
const html = readFileSync(new URL('index.html', root), 'utf8');
const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1] || '';

test('Radio static assets ship core browser security headers', () => {
  for (const header of [
    'X-Content-Type-Options: nosniff',
    'X-Frame-Options: DENY',
    'Referrer-Policy: strict-origin-when-cross-origin',
    'Strict-Transport-Security: max-age=31536000; includeSubDomains',
    'Permissions-Policy: camera=(), microphone=(), geolocation=()'
  ]) assert.ok(headers.includes(header), 'Missing header: ' + header);
});

test('Radio CSP blocks framing, plugins and untrusted inline scripts', () => {
  assert.ok(csp, 'Content-Security-Policy must be present');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net\/npm\/livekit-client@2\.22\.3\//);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
});


test('Radio player imports only the exact LiveKit SDK version permitted by CSP', () => {
  const player = readFileSync(new URL('js/approved-widget-system.js', root), 'utf8');
  const sdk = player.match(/import\(['"]([^'"]*livekit-client[^'"]*)['"]\)/)?.[1];
  assert.equal(sdk, 'https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/+esm');
  assert.ok(csp.includes('https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/'));
});

test('Radio CSP hash authorizes only the approved inline shell configuration', () => {
  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(script => script.trim());
  assert.equal(inlineScripts.length, 1, 'Expected one inline bootstrap configuration');
  const hash = createHash('sha256').update(inlineScripts[0]).digest('base64');
  assert.ok(csp.includes("'sha256-" + hash + "'"), 'Inline bootstrap must match the exact CSP hash');
});

test('Radio CSP permits only the required secure playback and design resource classes', () => {
  assert.match(csp, /style-src 'self' 'unsafe-inline' https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com data:/);
  assert.match(csp, /img-src 'self' https:\/\/www\.heavenlykey\.org data:/);
  assert.match(csp, /media-src 'self' https: blob:/);
  assert.match(csp, /connect-src 'self' https: wss:/);
  assert.match(csp, /worker-src 'self' blob:/);
});
