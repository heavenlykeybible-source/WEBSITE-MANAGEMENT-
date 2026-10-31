import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicFile = path => readFileSync(new URL('../public/' + path, import.meta.url), 'utf8');
const apps = JSON.parse(publicFile('app-downloads.json'));
const approvedHosts = new Set([
  'apps.heavenlykey.org',
  'onlinebible.heavenlykey.org',
  'global.heavenlykey.org',
  'radio.heavenlykey.org',
  'meeting.heavenlykey.org',
  'heavenlykey.org',
  'www.heavenlykey.org',
]);

test('published catalogue contains exactly 11 named applications', () => {
  assert.equal(Object.keys(apps).length, 11);
  for (const [id, app] of Object.entries(apps)) {
    assert.match(id, /^[a-z0-9-]{1,64}$/);
    assert.equal(typeof app.name, 'string');
    assert.ok(app.name.trim(), 'Empty app name: ' + id);
  }
});

test('every official catalogue destination is HTTPS and belongs to an approved hostname', () => {
  for (const [id, app] of Object.entries(apps)) {
    const url = new URL(app.url);
    assert.equal(url.protocol, 'https:', id);
    assert.ok(approvedHosts.has(url.hostname), id + ' has an unapproved host');
    assert.equal(url.username, '', id + ' contains URL credentials');
    assert.equal(url.password, '', id + ' contains URL credentials');
  }
});

test('all five platform QR assets exist for every catalogue app', () => {
  for (const id of Object.keys(apps)) {
    for (const platform of ['android', 'iphone', 'ipad', 'windows', 'mac']) {
      const svg = publicFile('qr/app-' + id + '-' + platform + '.svg');
      assert.match(svg, /^<svg\s/, id + ' ' + platform);
      assert.match(svg, /<\/svg>\s*$/, id + ' ' + platform);
    }
  }
});

test('catalogue download links have matching controls in directory', () => {
  const directory = publicFile('downloads.html');
  for (const id of Object.keys(apps)) {
    assert.ok(directory.includes('data-download-app="' + id + '"'), id);
  }
});

test('all nine installable web apps retain unique same-origin identities and safe launch paths', () => {
  const names = [
    'all-in-one', 'public-assistant', 'walk-with-god',
    'eternity-in-view', 'bible-study-portal', 'bible-reader',
    'hymns', 'audio-hymns', 'daily-reading',
  ];
  const identities = new Set();
  for (const name of names) {
    const manifest = JSON.parse(publicFile('manifests/' + name + '.webmanifest'));
    assert.equal(manifest.id, '/installed/' + name);
    assert.ok(!identities.has(manifest.id), 'Duplicate installation ID: ' + name);
    identities.add(manifest.id);
    assert.match(manifest.start_url, /^\/[a-z0-9/-]+(?:\.html)?\/$|^\/[a-z0-9/-]+(?:\.html)?$/);
    assert.equal(manifest.scope, '/');
    assert.equal(manifest.display, 'standalone');
    assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
    for (const icon of manifest.icons) {
      assert.match(icon.src, /^\/icons\/[a-z0-9-]+\.(?:png|svg)$/);
      assert.match(icon.sizes, /^\d+x\d+$/);
    }
  }
});

test('installed Hymn Library launches the real hymn book, not a redirect', () => {
  const manifest=JSON.parse(publicFile('manifests/hymns.webmanifest'));
  const page=publicFile('old-time-gospel-revival-hymn-book.html');
  const worker=publicFile('sw.js');
  assert.equal(manifest.start_url,'/old-time-gospel-revival-hymn-book.html');
  assert.match(page,/rel="manifest" href="\/manifests\/hymns\.webmanifest"/);
  assert.match(page,/navigator\.serviceWorker\.register\('\/sw\.js'\)/);
  assert.doesNotMatch(page,/<meta\s+http-equiv="refresh"/i);
  assert.match(worker,/'\/old-time-gospel-revival-hymn-book\.html'/);
  assert.doesNotMatch(worker,/'\/hymns\.html'/);
});

test('Audio Hymnal opens local rights-gated player instead of redirecting offsite', () => {
  const html=publicFile('audio-hymns.html');
  const manifest=JSON.parse(publicFile('manifests/audio-hymns.webmanifest'));
  const release=JSON.parse(publicFile('audio-hymn-manifest.json'));
  const essential=['hymn-select','hymn-style','hymn-player','hymn-status','hymn-count','hymn-save','hymn-remove','hymn-with-music','hymn-background-player'];
  assert.equal(manifest.start_url,'/audio-hymns.html');
  assert.match(html,/rel="manifest" href="\/manifests\/audio-hymns\.webmanifest"/);
  assert.match(html,/type="module" src="\/audio-hymns\.js"/);
  assert.doesNotMatch(html,/http-equiv="refresh"/i);
  for(const id of essential)assert.ok(html.includes('id="'+id+'"'),'Missing player control '+id);
  assert.equal(release.publicationApproved,false,'Never bypass unpublished recording permissions');
  assert.match(publicFile('audio-hymn-catalog.js'),/manifest\.publicationApproved!==true/);
});
