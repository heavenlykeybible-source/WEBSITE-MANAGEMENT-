import {test} from 'node:test';
import assert from 'node:assert/strict';
import {route} from './worker.mjs';

test('forwards the exact path and query to the fixed community host', async () => {
  const result = await route(new Request('https://global.heavenlykey.org/api/posts?before=4'), async request => {
    assert.equal(request.url, 'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/api/posts?before=4');
    assert.equal(request.redirect, 'manual');
    return new Response('existing application');
  });
  assert.equal(await result.text(), 'existing application');
});
test('routes Bible scripture only to the verified Bible Worker', async () => {
  const result = await route(new Request('https://bible.heavenlykey.org/api/bible/Genesis/1'), async request => {
    assert.equal(request.url, 'https://onlinebible.heavenlykeybible.workers.dev/api/bible/Genesis/1');
    return Response.json({success: true, translation: 'KJV'});
  });
  assert.equal((await result.json()).translation, 'KJV');
});
test('preserves authenticated same-origin writes and session cookies', async () => {
  const result = await route(new Request('https://global.heavenlykey.org/api/posts', {
    method: 'POST', headers: {Origin: 'https://global.heavenlykey.org', Cookie: 'session=existing', 'Content-Type': 'application/json'}, body: '{"message":"hello"}'
  }), async request => {
    assert.equal(request.headers.get('Origin'), 'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev');
    assert.equal(request.headers.get('Cookie'), 'session=existing');
    assert.equal(await request.text(), '{"message":"hello"}');
    return new Response('saved', {headers: {'Set-Cookie': 'session=next; Secure; HttpOnly; Path=/'}});
  });
  assert.equal(result.headers.get('Set-Cookie'), 'session=next; Secure; HttpOnly; Path=/');
});
test('rejects cross-site writes before contacting upstream', async () => {
  for (const headers of [{Origin: 'https://unrelated.example'}, {'Sec-Fetch-Site': 'cross-site'}]) {
    const result = await route(new Request('https://global.heavenlykey.org/api/posts', {method: 'POST', headers}), () => {throw Error('must not be called')});
    assert.equal(result.status, 403);
  }
});
test('rejects unknown hostnames without contacting upstream', async () => {
  const result = await route(new Request('https://unrelated.example/'), () => {throw Error('must not be called')});
  assert.equal(result.status, 404);
});
test('rewrites only redirects within the same portal, retaining cookies', async () => {
  const result = await route(new Request('https://global.heavenlykey.org/api/auth'), async () => new Response(null, {
    status: 302, headers: {Location: 'https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/profile?id=2', 'Set-Cookie': 'session=next; Secure; HttpOnly; Path=/'}
  }));
  assert.equal(result.headers.get('Location'), 'https://global.heavenlykey.org/profile?id=2');
  assert.ok(result.headers.get('Set-Cookie').includes('HttpOnly'));
});
test('preserves external sign-in redirects without following them', async () => {
  const result = await route(new Request('https://global.heavenlykey.org/api/auth'), async () => new Response(null, {status: 302, headers: {Location: 'https://accounts.google.com/signin'}}));
  assert.equal(result.headers.get('Location'), 'https://accounts.google.com/signin');
});
test('upstream network failures return a non-cacheable error', async () => {
  const result = await route(new Request('https://global.heavenlykey.org/'), async () => {throw Error('network')});
  assert.equal(result.status, 503);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});

test('Studio root opens the administrator page on the Studio domain',async()=>{const r=await route(new Request('https://studio.heavenlykey.org/'),()=>{throw Error('No upstream needed')});assert.equal(r.headers.get('Location'),'https://studio.heavenlykey.org/pages/admin.html#studio');});
test('Control login retains same-origin CSRF validation and secure cookies',async()=>{const r=await route(new Request('https://control.heavenlykey.org/api/owner/login',{method:'POST',headers:{Origin:'https://control.heavenlykey.org','Content-Type':'application/json'},body:'{"username":"owner","password":"test-password"}'}),async req=>{assert.equal(req.url,'https://heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev/api/owner/login');assert.equal(req.headers.get('Origin'),'https://heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev');return new Response('ok',{headers:{'Set-Cookie':'__Host-hkem-owner=session; Path=/; Secure; HttpOnly; SameSite=Strict'}})});assert.ok(r.headers.get('Set-Cookie').includes('SameSite=Strict'));});
test('Studio auth APIs retain the exact upstream path',async()=>{await route(new Request('https://studio.heavenlykey.org/api/auth/profile',{headers:{Cookie:'session=existing'}}),async req=>{assert.equal(req.url,'https://heavenlykey.alldaywow247.workers.dev/api/auth/profile');assert.equal(req.headers.get('Cookie'),'session=existing');return new Response('ok')})});
test('Control rejects a cross-site login before reaching account 4',async()=>{const r=await route(new Request('https://control.heavenlykey.org/api/owner/login',{method:'POST',headers:{Origin:'https://unrelated.example'}}),()=>{throw Error('Must not forward')});assert.equal(r.status,403)});

test('chat asset route changes only the two static files, never production APIs',async()=>{for(const suffix of ['js','css']){const r=await route(new Request('https://heavenlykey.org/js/cms-runtime-20261015.'+suffix+'?v=current'),async req=>{assert.equal(req.url,'https://heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev/cms-runtime-20261015.'+suffix+'?v=current');assert.equal(req.headers.get('Cookie'),null);return new Response('asset')});assert.match(r.headers.get('Cache-Control'),/no-cache/)}const r=await route(new Request('https://heavenlykey.org/api/auth/login'),()=>{throw Error('Must stay on production backend')});assert.equal(r.status,404)});
