import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base = new URL('../../native/android/app/src/main/', import.meta.url);
const activity = readFileSync(new URL('java/org/heavenlykey/apps/MainActivity.java', base), 'utf8');
const manifest = readFileSync(new URL('AndroidManifest.xml',base),'utf8');
test('native wrapper keeps Account 5 isolated and does not intercept package downloads',()=>{
 assert.match(activity, /"apps\\.heavenlykey\\.org"\\.equalsIgnoreCase\\(host\\)/);
 assert.match(activity, /!url\\.getPath\\(\\)\\.startsWith\\("\/api\/native-download\/"\\)/);
 assert.match(activity, /Intent\\.ACTION_VIEW/);
 assert.doesNotMatch(activity, /host\\.endsWith\\("\\.heavenlykey\\.org"\\)/);
 assert.match(activity, /MIXED_CONTENT_NEVER_ALLOW/);
 assert.match(activity, /handler\\.cancel\\(\\)/);
 assert.match(activity, /setAcceptThirdPartyCookies\\(browser,false\\)/);
});
test('native app defaults to HTTPS without unnecessary access to device storage',()=>{
 assert.match(manifest, /android:usesCleartextTraffic="false"/);
 assert.match(manifest, /android:allowBackup="false"/);
 assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
});
