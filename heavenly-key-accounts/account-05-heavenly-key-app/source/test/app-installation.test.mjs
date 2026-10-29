import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const publicDir = new URL('../public/', import.meta.url);
import {routeIndependentApp} from '../src/independent-apps.js';
const read = path => readFileSync(new URL(path, publicDir), 'utf8');
test('all published app download entries have valid secure URLs and a device-specific guide', async () => {
  const apps = JSON.parse(read('app-downloads.json'));
  assert.ok(Object.keys(apps).length >= 10);
  for (const [id, app] of Object.entries(apps)) {
    assert.match(id, /^[a-z0-9-]+$/);
    assert.ok(app.name && typeof app.name === 'string');
    const url = new URL(app.url);
    assert.equal(url.protocol, 'https:');
    if (url.origin === 'https://apps.heavenlykey.org') {
      const pathname = url.pathname === '/' ? '/index.html' : url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      if (existsSync(new URL('.' + pathname, publicDir))) continue;
      const routed = await routeIndependentApp(new Request(url), {INDEPENDENT_APPS_ENABLED:'true', ETERNITY_APP:{fetch:async()=>new Response('portal',{headers:{'X-HK-App-Service':'eternity-in-view'}})}});
      assert.equal(routed?.status,200,'missing app destination: '+pathname);
      assert.equal(routed.headers.get('X-HK-App-Service'),id);
    }
  }
  for (const platform of ['android','iphone','ipad','windows','mac']) {
    assert.ok(existsSync(new URL('download/' + platform + '/index.html', publicDir)));
  }
});
test('native download guide never substitutes browser installation for a package', () => {
  const script = read('app-device-guide.js');
  assert.doesNotMatch(script, /beforeinstallprompt|userChoice|Add to Home Screen|serviceWorker.register/);
  assert.match(script, /method:'HEAD'/);
  assert.match(script, /nativeLink.hidden = !nativeAvailable/);
  assert.match(script, /store.hostname!=='apps.apple.com'/);
  assert.match(script, /not published yet/);
});
test('individual local PWA manifests have unique IDs and valid icons', () => {
  const apps = JSON.parse(read('app-downloads.json'));
  const ids = new Set();
  for (const [id, app] of Object.entries(apps)) {
    if (new URL(app.url).origin !== 'https://apps.heavenlykey.org') continue;
    const path = 'manifests/' + id + '.webmanifest';
    assert.ok(existsSync(new URL(path, publicDir)), 'missing manifest: ' + path);
    const manifest = JSON.parse(read(path));
    assert.ok(manifest.id && !ids.has(manifest.id), 'duplicate or missing manifest ID: ' + id);
    ids.add(manifest.id);
    assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.icons.length >= 1);
    for (const icon of manifest.icons) {
      assert.ok(existsSync(new URL('.' + icon.src, publicDir)), 'missing icon: ' + icon.src);
    }
  }
});
