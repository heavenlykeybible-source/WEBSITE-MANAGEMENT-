import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://apps.heavenlykey.org';

function harness(network = async () => publicResponse()) {
  const listeners = new Map();
  const entries = new Map();
  const cache = {
    put: async (key, value) => { entries.set(String(key), value); },
    match: async key => entries.get(String(key)),
  };
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
  };
  const self = {
    location: { origin },
    addEventListener: (type, callback) => listeners.set(type, callback),
    clients: { claim: async () => undefined },
    skipWaiting: async () => undefined,
  };
  runInNewContext(source, { self, caches, fetch: network, URL, Response });
  return {
    entries,
    async install() {
      let task;
      listeners.get('install')({ waitUntil: value => { task = value; } });
      await task;
    },
    async request(url, { mode = 'same-origin', destination = 'script', credentials = 'include' } = {}) {
      let task;
      const background = [];
      const request = {
        url: origin + url,
        method: 'GET',
        mode,
        destination,
        credentials,
        headers: { has: () => false },
      };
      listeners.get('fetch')({
        request,
        respondWith: value => { task = value; },
        waitUntil: value => { background.push(value); },
      });
      if (!task) return { handled: false };
      const response = await task;
      await Promise.all(background);
      return { handled: true, response };
    },
  };
}

function publicResponse(headers = {}, extra = {}) {
  return {
    ok: true,
    type: 'basic',
    redirected: false,
    headers: { get: key => headers[key] ?? null },
    clone() { return this; },
    ...extra,
  };
}

test('core files must all succeed before offline installation finishes', async () => {
  const good = harness();
  await good.install();
  for (const file of ['/index.html', '/app.js', '/styles.css', '/manifest.webmanifest']) {
    assert.ok(good.entries.has(file), file);
  }
  const broken = harness(async path => path === '/app.js'
    ? publicResponse({}, { ok: false })
    : publicResponse());
  await assert.rejects(broken.install(), /Essential app shell unavailable: \/app\.js/);
});

test('optional files install with bounded concurrency', async () => {
  let active = 0;
  let peak = 0;
  const runner = harness(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active -= 1;
    return publicResponse();
  });
  await runner.install();
  assert.ok(peak > 1, 'optional resources should load concurrently');
  assert.ok(peak <= 6, 'never exceed six simultaneous downloads');
});

test('runtime excludes personalized documents but caches public assets', async () => {
  const runner = harness();
  await runner.request('/app.js', { mode: 'navigate', destination: 'document' });
  assert.equal(runner.entries.size, 0);
  await runner.request('/app.js', { mode: 'same-origin', destination: 'script' });
  assert.ok(runner.entries.has(origin + '/app.js'));
});

test('private and cookie-varying runtime responses never enter offline cache', async () => {
  for (const headers of [
    { 'cache-control': 'private' },
    { 'cache-control': 'no-store' },
    { 'cache-control': 'no-cache' },
    { vary: 'Accept-Encoding, Cookie' },
    { vary: 'Authorization' },
  ]) {
    const runner = harness(async () => publicResponse(headers));
    await runner.request('/app.js');
    assert.equal(runner.entries.size, 0, JSON.stringify(headers));
  }
});

test('offline Bible chapter requests remain isolated', async () => {
  const runner = harness(async () => { throw new Error('offline'); });
  const first = origin + '/bible.html?book=John&chapter=3';
  runner.entries.set(first, publicResponse({}, { marker: 'John 3' }));
  const response = await runner.request('/bible.html?book=John&chapter=3', { mode: 'navigate', destination: 'document' });
  assert.equal(response.response.marker, 'John 3');
  const other = await runner.request('/bible.html?book=John&chapter=4', { mode: 'navigate', destination: 'document' });
  assert.equal(other.response.type, 'error');
});
