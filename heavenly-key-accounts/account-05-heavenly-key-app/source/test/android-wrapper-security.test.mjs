import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../../native/android/app/src/main/', import.meta.url);
const activity=readFileSync(new URL('java/org/heavenlykey/apps/MainActivity.java',base),'utf8');
const manifest=readFileSync(new URL('AndroidManifest.xml',base),'utf8');
test('native WebView stays on the Account 5 origin and sends APK downloads to system browser',()=>{
 assert.ok(activity.includes('"apps.heavenlykey.org".equalsIgnoreCase(host)'));
 assert.ok(activity.includes('!url.getPath().startsWith("/api/native-download/")'));
 assert.ok(activity.includes('Intent.ACTION_VIEW'));
 assert.ok(!activity.includes('host.endsWith(".heavenlykey.org")'));
 assert.ok(activity.includes('MIXED_CONTENT_NEVER_ALLOW'));
 assert.ok(activity.includes('Build.VERSION.SDK_INT >= Build.VERSION_CODES.O'));
 assert.ok(activity.includes('settings.setSafeBrowsingEnabled(true)'));
 assert.ok(activity.includes('handler.cancel()'));
 assert.ok(activity.includes('setAcceptThirdPartyCookies(browser,false)'));
});
test('native app disables cleartext and backup and does not request device storage permissions',()=>{
 assert.ok(manifest.includes('android:usesCleartextTraffic="false"'));
 assert.ok(manifest.includes('android:allowBackup="false"'));
 for(const value of ['READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','MANAGE_EXTERNAL_STORAGE'])assert.ok(!manifest.includes(value));
});
