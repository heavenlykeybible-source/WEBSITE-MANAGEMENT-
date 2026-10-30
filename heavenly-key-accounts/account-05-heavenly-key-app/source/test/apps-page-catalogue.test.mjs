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
 assert.match(script,/img\.src='\/qr\/app-'/);
});

test('Hymn Book install options do not mislabel another app QR code',()=>{
 const script=readFileSync(new URL('app-pages.js',base),'utf8');
 assert.match(script,/id==='old-time-gospel-revival-hymn-book'/);
 assert.match(script,/Use the installation link below/);
 assert.doesNotMatch(script,/id==='old-time-gospel-revival-hymn-book'\?'\/qr\/app-all-in-one/);
});
