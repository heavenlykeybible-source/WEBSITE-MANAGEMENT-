import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Account 5 has its own Cloudflare Worker identity, without account 1–4 storage bindings',()=>{
 const config=get('wrangler.toml');
 assert.match(config,/name\s*=\s*"heavenly-key-app"/);
 assert.match(config,/main\s*=\s*"src\/index.js"/);
 assert.match(config,/directory\s*=\s*"\.\/public"/);
 assert.doesNotMatch(config,/\[\[d1_databases\]\]|\[\[kv_namespaces\]\]|\[\[r2_buckets\]\]/);
});
test('mobile app has installable PWA shell and all navigable sections',()=>{
 const html=get('public/index.html'),js=get('public/app.js');
 const manifest=JSON.parse(get('public/manifest.webmanifest'));
 assert.equal(manifest.start_url,'/');
 assert.equal(manifest.display,'standalone');
 for(const section of ['home','community','grow','profile','bible','live','messages','groups','prayer'])
  assert.ok(html.includes('id="'+section+'"'),section+' screen missing');
 assert.ok(html.includes('heavenlykey.org'));
 assert.match(js,/data-screen/);
 assert.match(js,/serviceWorker\.register\("\/sw\.js"\)/);
});
test('mobile community and media shortcuts only use verified HTTPS ministry pages',()=>{
 const html=get('public/index.html');
 for(const page of ['community.html','radio.html','video.html','grdpc.html']){
  assert.ok(html.includes('href="https://heavenlykey.alldaywow247.workers.dev/pages/'+page+'"'),page+' link missing');
 }
 const external=[...html.matchAll(/<a\b[^>]*class="service-link"[^>]*>/g)].map(m=>m[0]);
 assert.equal(external.length,4,'Expected four official service shortcuts');
 for(const a of external){
  assert.match(a,/target="_blank"/);
  assert.match(a,/rel="noopener noreferrer"/);
  assert.doesNotMatch(a,/javascript:|data:/i);
 }
 assert.match(html,/sign-in inside this app remains pending/i);
 assert.match(html,/not yet integrated into this app/i);
});
test('script styles and service worker do not contain the original cloud credentials',()=>{
 for(const path of ['src/index.js','public/app.js','public/sw.js','public/index.html','public/styles.css']){
  assert.doesNotMatch(get(path),/(?:CLOUDFLARE_API_TOKEN|PASSWORD_PEPPER|ACCOUNT4_PROTECTED_D1_ID|ACCOUNT_4_TOKEN)\s*[:=]/);
 }
 const worker=get('src/index.js');
 assert.match(worker,/\/api\/health/);
 assert.match(worker,/env\.ASSETS\.fetch\(request\)/);
 assert.match(worker,/status:404/);
 const sw=get('public/sw.js');
 assert.ok(sw.includes('!PUBLIC.has(url.pathname)'),'Cache only explicitly approved public app-shell files');
});


test('Account 5 public shell rejects all third-party framing after website uses direct app feature links',()=>{
 const headers=get('public/_headers');
 assert.match(headers,/^\s*X-Frame-Options:\s*DENY\s*$/m);
 assert.match(headers,/frame-ancestors 'none'/);
 assert.match(headers,/default-src 'self'/);
 assert.match(headers,/script-src 'self'/);
 assert.match(headers,/form-action 'self'/);
 assert.match(headers,/object-src 'none'/);
});

