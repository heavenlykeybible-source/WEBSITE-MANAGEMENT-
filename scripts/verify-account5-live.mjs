import assert from 'node:assert/strict';
const origin='https://apps.heavenlykey.org';
const pages=['/','/downloads.html','/experience.html','/bible.html','/audio-bible.html','/devotional.html','/hymns.html','/audio-hymns.html','/walk-offline.html','/creation-to-eternity.html'];
let home;
for(const path of pages){const r=await fetch(origin+path,{signal:AbortSignal.timeout(20000),redirect:'follow'}),text=await r.text();assert.equal(r.status,200,'Unavailable app page '+path);assert.equal(new URL(r.url).origin,origin,'App redirected away '+path);assert.match(r.headers.get('content-type')||'',/text\/html/,'Not an app document '+path);assert.ok(!/Under Construction|Connection timed out|Page not found/i.test(text.match(/<title[^>]*>([^<]*)/i)?.[1]||''),'Error document '+path);if(path==='/')home=text;else assert.notEqual(text,home,'App route returned the generic home '+path);console.log('PASS live app page '+path);}
assert.ok(home.includes('data-app-launcher'),'App popup launcher missing');
const r=await fetch(origin+'/app-launcher.js',{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const source=await r.text();const urls=[...source.matchAll(/\['[^']+','[^']+','([^']+)'/g)].map(m=>m[1]);assert.ok(urls.length>=10);assert.equal(new Set(urls).size,urls.length);assert.ok(source.includes('https://radio.heavenlykey.org/'));assert.ok(source.includes('https://global.heavenlykey.org/'));
console.log('PASS live app launcher: distinct direct URLs and current radio/community destinations. This check does not certify media playback or member journeys.');
