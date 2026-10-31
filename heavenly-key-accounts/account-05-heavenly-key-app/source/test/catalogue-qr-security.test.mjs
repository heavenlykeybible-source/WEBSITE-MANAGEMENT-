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
