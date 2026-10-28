import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const publicFile = path => readFileSync(new URL('../public/' + path, import.meta.url), 'utf8');

test('Android guide has only one install prompt controller', () => {
  const html = publicFile('download/android/index.html');
  assert.match(html, /app-device-guide\.js/);
  assert.doesNotMatch(html, /hk-page-script-index-1\.js/);
});

test('device guide only advertises native download when the server confirms its availability', () => {
  const js = publicFile('app-device-guide.js');
  assert.match(js, /method:'HEAD'/);
  assert.match(js, /nativeLink\.hidden = !nativeAvailable/);
  assert.match(js, /nativeLink\.hidden = true/);
  assert.match(js, /\/api\/native-download\//);
});

test('download guide restricts app destinations to secure HTTPS or local development', () => {
  const js = publicFile('app-device-guide.js');
  assert.match(js, /destination\.protocol !== 'https:'/);
  assert.match(js, /destination\.protocol === 'http:' && destination\.hostname === 'localhost'/);
});

test('every published app in catalogue has a download control in directory', () => {
  const catalogue = JSON.parse(publicFile('app-downloads.json'));
  const directory = publicFile('downloads.html');
  for (const appId of Object.keys(catalogue)) {
    assert.ok(directory.includes('data-download-app="' + appId + '"'), 'Missing app download control for ' + appId);
  }
});

test('every device guide has exactly one installation event controller', () => {
  for (const device of ['android', 'iphone', 'ipad', 'windows', 'mac']) {
    const html = publicFile('download/' + device + '/index.html');
    assert.match(html, /app-device-guide\.js/, device + ' missing primary guide script');
    assert.doesNotMatch(html, /hk-page-script-index-1\.js/, device + ' has conflicting legacy prompt script');
  }
});

test('native package status remains visible after browser install guidance updates', () => {
  const js = publicFile('app-device-guide.js');
  assert.match(js, /nativeAvailable = available\.ok/);
  assert.match(js, /else if \(nativeAvailable\)/);
});

test('unavailable native package links remain hidden even when button CSS uses display', () => {
  const stylesheet = publicFile('app-pages.css');
  assert.match(stylesheet, /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
});

test('offline shell caches device guides without failing when optional assets are missing', () => {
  const sw = publicFile('sw.js');
  for (const device of ['android', 'iphone', 'ipad', 'windows', 'mac']) {
    assert.ok(sw.includes('/download/' + device + '/index.html'), 'Guide missing from cache: ' + device);
  }
  assert.match(sw, /for\(const path of SHELL\.filter/);
  assert.match(sw, /const cachePath=guide\?url\.pathname\+'index\.html':url\.pathname/);
  assert.match(sw, /getAll\('app'\)\.length===1/);
});

test('native download button requires a security digest and a positive package length', () => {
 const js = publicFile('app-device-guide.js');
 assert.match(js, /x-release-sha256/);
 assert.match(js, /Number\.isSafeInteger\(size\) && size > 0/);
 assert.match(js, /nativeAvailable = available\.ok/);
});

test('device guide never offers an installation prompt for the wrong app scope', () => {
 const js = publicFile('app-device-guide.js');
 assert.doesNotMatch(js, /install\.hidden = false/);
 assert.match(js, /open the selected app/i);
});

test('premium install dialog has an accessible close control and device options', () => {
 const js = publicFile('app-pages.js');
 const css = publicFile('app-pages.css');
 assert.match(js, /dialog\.setAttribute\('aria-label','Download '/);
 assert.match(js, /dialog\.addEventListener\('close'/);
 assert.match(js, /install-primary/);
 assert.match(js, /install-device-description/);
 assert.match(css, /\.hk-install-dialog\.downloadgrid|\.hk-install-dialog \.downloadgrid/);
 assert.match(css, /@media\(max-width:480px\)/);
});

test('premium download chooser keeps every device and a safe selected-device route', () => {
 const js = publicFile('app-pages.js');
 const css = publicFile('app-pages.css');
 assert.match(js, /hk-install-dialog/);
 assert.match(js, /install-primary/);
 assert.match(js, /const devices=\[\['android'/);
 assert.match(js, /\['iphone','iPhone'\]/);
 assert.match(js, /\['ipad','iPad'\]/);
 assert.match(js, /\['windows','Windows'\]/);
 assert.match(js, /\['mac','Mac'\]/);
 assert.match(js, /encodeURIComponent\(id\)/);
 assert.match(js, /dialog\.addEventListener\('close'/);
 assert.match(css, /\.hk-install-dialog \.downloadgrid/);
 assert.match(css, /@media\(max-width:480px\)/);
});
