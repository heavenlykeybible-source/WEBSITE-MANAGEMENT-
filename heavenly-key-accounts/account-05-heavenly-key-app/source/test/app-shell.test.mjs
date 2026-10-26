import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Account 5 has its own Cloudflare Worker identity, without account 1–4 storage bindings',()=>{
 const config=get('wrangler.toml');
 assert.match(config,/name\s*=\s*"heavenly-key-app"/);
 assert.match(config,/main\s*=\s*"src\/index.js"/);
 assert.match(config,/directory\s*=\s*"\.\/public"/);
 assert.doesNotMatch(config,/\[\[d1_databases\]\]|\[\[kv_namespaces\]\]|\[\[r2_buckets\]\]/);
});
test('mobile app has installable PWA shell and all navigable sections',()=>{
 const html=get('public/experience.html'),js=get('public/app.js');
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
 const html=get('public/experience.html');
 for(const page of ['https://global.heavenlykey.org/','https://heavenlykey.alldaywow247.workers.dev/pages/video.html','https://heavenlykey.alldaywow247.workers.dev/pages/grdpc.html']){
  assert.ok(html.includes('href="'+page+'"'),page+' link missing');
 }
 const external=[...html.matchAll(/<a\b[^>]*class="service-link"[^>]*>/g)].map(m=>m[0]);
 assert.equal(external.length,3,'Expected three official service shortcuts; radio has its own accessible launch button');
 for(const a of external){
  assert.match(a,/target="_blank"/);
  assert.match(a,/rel="noopener noreferrer"/);
  assert.doesNotMatch(a,/javascript:|data:/i);
 }
 assert.match(html,/sign-in inside this app remains pending/i);
 assert.match(html,/member sign-in and live playback are still being connected and tested/i);
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


test('Public Apps pages use only the clean theme and preserve direct app access',()=>{for(const name of ['index.html','downloads.html']){const html=get('public/'+name);assert.match(html,/data-theme="clean-apps"/);assert.match(html,/href="\/app-pages.css"/);assert.match(html,/src="\/app-pages.js"/);assert.match(html,/href="\/experience.html"/);assert.match(html,/id="individual-apps"/);assert.doesNotMatch(html,/premium-home.css|hk-approved-page-style-public-index|class="laptop"|src="\/app.js"|<style\b|\sstyle=/i);assert.equal((html.match(/class="hk-directory-card"/g)||[]).length,13);}});
test('Clean public theme is offline-cached without removing protected app resources',()=>{const sw=get('public/sw.js');for(const path of ['app-pages.css','app-pages.js','experience.html','walk-offline.html','creation-to-eternity.html'])assert.ok(sw.includes('/'+path));});
test('Clean theme has responsive layouts and reduced-motion support',()=>{const css=get('public/app-pages.css');assert.match(css,/@media\(max-width:620px\)/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/focus-visible/);});
test('all five device QR assets are local, included in offline shell, and linked to installation pages',()=>{const sw=get('public/sw.js'),code=get('public/premium-download-options.js');for(const device of ['android','iphone','ipad','windows','mac']){const qr=get('public/qr/'+device+'.svg');assert.match(qr,/<svg /);assert.match(qr,/<path fill="#111"/);assert.match(sw,new RegExp('/qr/'+device+'\\.svg'));assert.ok(code.includes("'/download/'")||code.includes("'download/'"));assert.ok(get('public/download/'+device+'/index.html').length>100);}assert.match(code,/qrLink\.append\(img\)/);});

test('App directory and downloads remain distinct from the preserved all-in-one application',()=>{const home=get('public/index.html'),experience=get('public/experience.html');assert.match(home,/href="\/experience.html"/);assert.match(experience,/data-screen="community"/);assert.match(experience,/data-screen="live"/);assert.match(experience,/\/app.js/);});
