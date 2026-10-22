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
 for(const page of ['community.html','video.html','grdpc.html']){
  assert.ok(html.includes('href="https://heavenlykey.alldaywow247.workers.dev/pages/'+page+'"'),page+' link missing');
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


test('premium homepage features laptop hero and app family while app remains accessible',()=>{
 const html=get('public/index.html');
 assert.match(html,/class="laptop"/);
 assert.match(html,/id="all-in-one"/);
 assert.match(html,/class="family-grid"/);
 assert.match(html,/href="\/experience\.html"/);
 assert.match(get('public/experience.html'),/id="bible"/);
});

test('premium page assets, CSP, navigation and app preservation',()=>{
 const html=get('public/index.html');
 const sw=get('public/sw.js');
 const css=get('public/premium-home.css');
 for(const path of ['premium-home.css','premium-family-nav.js','premium-download-options.js','experience.html','assets/ministry/logo.png','assets/ministry/hero-people-laptop.jpg','assets/ministry/global-community-network.svg','assets/ministry/rotating-world-land.svg']){
  assert.ok(sw.includes('/'+path),'Offline asset missing: '+path);
 }
 assert.match(html,/href="\/premium-home\.css"/);
 assert.doesNotMatch(html,/<style\b|\sstyle=/i);
 assert.match(html,/class="laptop"/);
 assert.match(css,/\.foot \.social-links/);
 assert.match(html,/aria-label="Main navigation"/);
 assert.match(html,/aria-label="Follow Heavenly Key"/);
 assert.match(html,/href="\/experience\.html"/);
 assert.match(get('public/premium-download-options.js'),/window\.location\.origin/);
 assert.doesNotMatch(get('public/premium-download-options.js'),/api\.qrserver\.com/);
});

test('premium page references only existing bundled local assets',()=>{
 const html=get('public/index.html');
 const css=get('public/premium-home.css');
 const source=[...html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)].map(m=>m[1])
  .concat([...css.matchAll(/url\(["']?(\/[^)"']+)["']?\)/g)].map(m=>m[1]));
 for(const path of new Set(source)){
  if(path==='/')continue;
  assert.ok(existsSync(new URL('../public'+path,import.meta.url)),'Missing premium local asset: '+path);
 }
 assert.ok(source.includes('/assets/ministry/hero-people-laptop.jpg'));
 assert.ok(source.includes('/premium-home.css'));
});

test('mission message and five app sharing controls are present and safe',()=>{
 const html=get('public/index.html');
 assert.match(html,/<\/div><p class="hero-mission-line">Together we take Christ to the nations of the world<\/p>/);
 assert.equal((html.match(/class="share-to-bless family-share"/g)||[]).length,5);
 assert.match(html,/src="\/premium-share\.js"/);
 assert.match(get('public/sw.js'),/\/premium-share\.js/);
 const script=get('public/premium-share.js');
 assert.match(script,/navigator\.share/);
 assert.match(script,/navigator\.clipboard/);
 assert.doesNotMatch(script,/innerHTML\s*=/);
});

test('all five device QR assets are local, included in offline shell, and linked to installation pages',()=>{const sw=get('public/sw.js'),code=get('public/premium-download-options.js');for(const device of ['android','iphone','ipad','windows','mac']){const qr=get('public/qr/'+device+'.svg');assert.match(qr,/<svg /);assert.match(qr,/<path fill="#111"/);assert.match(sw,new RegExp('/qr/'+device+'\\.svg'));assert.ok(code.includes("'/download/'")||code.includes("'download/'"));assert.ok(get('public/download/'+device+'/index.html').length>100);}assert.match(code,/qrLink\.append\(img\)/);});
