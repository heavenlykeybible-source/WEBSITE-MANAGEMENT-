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
  assert.match(js, /nativeLink\.hidden = !available\.ok/);
  assert.match(js, /nativeLink\.hidden = true/);
  assert.match(js, /\/api\/native-download\//);
});

test('download guide restricts app destinations to secure HTTPS or local development', () => {
  const js = publicFile('app-device-guide.js');
  assert.match(js, /destination\.protocol !== 'https:'/);
  assert.match(js, /destination\.protocol === 'http:' && destination\.hostname === 'localhost'/);
});
