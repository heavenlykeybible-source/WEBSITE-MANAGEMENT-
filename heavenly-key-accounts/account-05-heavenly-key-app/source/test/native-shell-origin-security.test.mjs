import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const native = file=>readFileSync(new URL('../../native/'+file, import.meta.url),'utf8');

test('Android native shell does not trust nonstandard ports for app content or installer handoff',()=>{
 const java=native('android/app/src/main/java/org/heavenlykey/apps/MainActivity.java');
 assert.match(java,/url\.getPort\(\)==-1\s*\|\|\s*url\.getPort\(\)==443/);
 assert.match(java,/target\.getPort\(\)!=-1\s*&&\s*target\.getPort\(\)!=443/);
 assert.match(java,/setMixedContentMode\(WebSettings\.MIXED_CONTENT_NEVER_ALLOW\)/);
 assert.match(java,/handler\.cancel\(\)/);
});

test('iPhone and Mac native embedded browsers require official HTTPS origin and standard port',()=>{
 for(const platform of ['ios/HeavenlyKey/HeavenlyKeyApp.swift','macos/HeavenlyKeyMac/HeavenlyKeyMacApp.swift']){
  const swift=native(platform);
  assert.match(swift,/scheme == "https"/);
  assert.match(swift,/url\.host\?\.lowercased\(\) == "apps\.heavenlykey\.org"/);
  assert.match(swift,/url\.port == nil \|\| url\.port == 443/);
  assert.match(swift,/url\.user == nil && url\.password == nil/);
 }
});

test('Windows embedded WebView and download handoff reject alternate HTTPS ports',()=>{
 const code=native('windows/MainWindow.xaml.cs');
 assert.match(code,/uri\.Host\.Equals\("apps\.heavenlykey\.org"/);
 assert.equal((code.match(/uri\.IsDefaultPort/g)||[]).length,2);
 assert.match(code,/e\.Cancel = true/);
 assert.match(code,/IsFirstParty\(e\.Uri\)/);
});

test('Apple native shells open user-clicked target-blank links in the system browser',()=>{
 const cases=[
  ['ios/HeavenlyKey/HeavenlyKeyApp.swift','webView','UIApplication.shared.open'],
  ['macos/HeavenlyKeyMac/HeavenlyKeyMacApp.swift','browser','NSWorkspace.shared.open']
 ];
 for(const [file,view,opener] of cases){
  const swift=native(file);
  assert.match(swift,/final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate/);
  assert.ok(swift.includes(view+'.uiDelegate = context.coordinator'));
  assert.match(swift,/createWebViewWith configuration: WKWebViewConfiguration/);
  assert.match(swift,/navigationAction.targetFrame == nil/);
  assert.match(swift,/navigationAction.navigationType == .linkActivated/);
  assert.ok(swift.includes(opener+'(url'));
  assert.match(swift,/return nil/);
 }
});
