import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../public/',import.meta.url);
const html=readFileSync(new URL('index.html',base),'utf8');
const catalog=JSON.parse(readFileSync(new URL('app-downloads.json',base),'utf8'));
const hymn='old-time-gospel-revival-hymn-book';
test('standalone Hymn Book is registered in Account 5 catalogue',()=>{
 assert.ok(Object.hasOwn(catalog,hymn));
 assert.equal(catalog[hymn].url,'https://apps.heavenlykey.org/old-time-gospel-revival-hymn-book.html');
});
test('Hymn Book has a download control on the existing Apps Page',()=>{
 assert.match(html,/data-download-app="old-time-gospel-revival-hymn-book"/);
 assert.match(html,/href="\/old-time-gospel-revival-hymn-book\.html"/);
});
test('each Apps Page download button has a catalogue entry',()=>{
 const ids=[...html.matchAll(/data-download-app="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(ids.length>0);
 for(const id of ids)assert.ok(Object.hasOwn(catalog,id),'Missing download catalogue entry: '+id);
});

test('install UI gracefully handles missing elements and QR image failures',()=>{
 const script=readFileSync(new URL('app-pages.js',base),'utf8');
 assert.match(script,/if\(el\)for\(/);
 assert.match(script,/if\(help&&/);
 assert.match(script,/QR unavailable/);
});

test('install QR code does not disclose install links to a third-party QR service',()=>{
 const script=readFileSync(new URL('app-pages.js',base),'utf8');
 assert.doesNotMatch(script,/api\.qrserver\.com/);
 assert.match(script,/\/qr\/app-/);
});

test('Hymn Book install options do not mislabel another app QR code',()=>{
 const script=readFileSync(new URL('app-pages.js',base),'utf8');
 assert.match(script,/id==='old-time-gospel-revival-hymn-book'/);
 assert.match(script,/Use the installation link below/);
 assert.doesNotMatch(script,/id==='old-time-gospel-revival-hymn-book'\?'\/qr\/app-all-in-one/);
});

test('native packages require explicit user download, not QR navigation',()=>{
 const script=readFileSync(new URL('app-device-guide.js',base),'utf8');
 assert.doesNotMatch(script,/window\.location\.assign\(nativeLink\.href\)/);
 assert.match(script,/nativeLink\.href\s*=\s*'\/api\/native-download\//);
});

test('catalogue install destinations use trusted Heavenly Key HTTPS hosts only',()=>{
 const allowed=new Set(['apps.heavenlykey.org','onlinebible.heavenlykey.org','global.heavenlykey.org','radio.heavenlykey.org','meeting.heavenlykey.org']);
 for(const [id,app] of Object.entries(catalog)){
   assert.equal(typeof app.name,'string','Missing name: '+id);
   assert.ok(app.name.trim(),'Empty name: '+id);
   assert.equal(typeof app.url,'string','Missing URL: '+id);
   const url=new URL(app.url);
   assert.equal(url.protocol,'https:','Non-HTTPS URL: '+id);
   assert.ok(allowed.has(url.hostname),'Untrusted host: '+id);
   assert.equal(url.username,'','User-info in URL: '+id);
   assert.equal(url.password,'','Password in URL: '+id);
   assert.equal(url.port,'','Non-standard port: '+id);
 }
 const guide=readFileSync(new URL('app-device-guide.js',base),'utf8');
 assert.match(guide,/trustedHosts\.has\(destination\.hostname\)/);
});

test('install guide never attaches a selected-app manifest outside its true scope',()=>{
 const guide=readFileSync(new URL('app-device-guide.js',base),'utf8');
 assert.doesNotMatch(guide,/document\.createElement\('link'\)[\s\S]*?manifest\.rel\s*=\s*'manifest'/);
 assert.match(guide,/Installation belongs to the selected app/);
});

test('installation guide QR links have accurate accessible descriptions',()=>{
 const script=readFileSync(new URL('app-pages.js',base),'utf8');
 assert.match(script,/Open installation guide for /);
 assert.doesNotMatch(script,/View QR code for /);
 assert.match(script,/img\.loading='lazy'/);
 assert.match(script,/img\.decoding='async'/);
});
