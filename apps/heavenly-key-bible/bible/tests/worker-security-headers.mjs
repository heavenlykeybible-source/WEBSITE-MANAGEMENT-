import assert from 'node:assert/strict';
import worker from '../worker.js';

const secure=await worker.fetch(new Request('https://bible.example/health'),{});
assert.equal(secure.status,200);
assert.equal(secure.headers.get('X-Content-Type-Options'),'nosniff');
assert.equal(secure.headers.get('X-Frame-Options'),'SAMEORIGIN');
assert.equal(secure.headers.get('Referrer-Policy'),'strict-origin-when-cross-origin');
assert.equal(secure.headers.get('Permissions-Policy'),'camera=(), microphone=(), geolocation=()');
assert.equal(secure.headers.get('Strict-Transport-Security'),'max-age=31536000');
assert.match(secure.headers.get('Content-Security-Policy')||'',/script-src 'self'/);
assert.match(secure.headers.get('Content-Security-Policy')||'',/frame-ancestors 'self'/);

const insecure=await worker.fetch(new Request('http://bible.example/health'),{});
assert.equal(insecure.headers.get('Strict-Transport-Security'),null);

const head=await worker.fetch(new Request('https://bible.example/health',{method:'HEAD'}),{});
assert.equal(head.status,200);
assert.equal(head.headers.get('X-Content-Type-Options'),'nosniff');
assert.equal(await head.text(),'');

console.log('PASS: Worker-generated responses receive baseline security headers; HSTS is HTTPS-only; HEAD remains bodyless.');
