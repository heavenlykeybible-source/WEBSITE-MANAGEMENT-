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
  assert.match(js, /nativeLink\.hidden = !\(nativeAvailable && matchesDevice\(\)\)/);
  assert.match(js, /nativeLink\.hidden = true/);
  assert.match(js, /\/api\/native-download\//);
});

test('download guide restricts app destinations to secure HTTPS or local development', () => {
  const js = publicFile('app-device-guide.js');
  assert.match(js, /destination\.protocol !== 'https:'/);
  assert.match(js, /trustedHosts\.has\(destination\.hostname\)/);
  assert.match(js, /destination\.username \|\| destination\.password/);
  assert.match(js, /destination\.protocol === 'http:' && destination\.hostname === 'localhost'/);
  assert.match(js, /location\.hostname === 'localhost'/);
});

test('every published app in catalogue has a download control in directory', () => {
  const catalogue = JSON.parse(publicFile('app-downloads.json'));
  const directory = publicFile('downloads.html');
  for (const appId of Object.keys(catalogue)) {
    assert.ok(directory.includes('data-download-app="' + appId + '"'), 'Missing app download control for ' + appId);
  }
});

test('every device guide has exactly one installation event controller', () => {
  for (const device of ['android', 'iphone', 'ipad', 'windows', 'mac']) {
    const html = publicFile('download/' + device + '/index.html');
    assert.match(html, /app-device-guide\.js/, device + ' missing primary guide script');
    assert.doesNotMatch(html, /hk-page-script-index-1\.js/, device + ' has conflicting legacy prompt script');
  }
});

test('native package status remains visible after browser install guidance updates', () => {
  const js = publicFile('app-device-guide.js');
  assert.match(js, /nativeAvailable = available\.ok/);
  assert.match(js, /else if \(nativeAvailable\)/);
});

test('unavailable native package links remain hidden even when button CSS uses display', () => {
  const stylesheet = publicFile('app-pages.css');
  assert.match(stylesheet, /\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
});

test('offline shell caches device guides without failing when optional assets are missing', () => {
  const sw = publicFile('sw.js');
  for (const device of ['android', 'iphone', 'ipad', 'windows', 'mac']) {
    assert.ok(sw.includes('/download/' + device + '/index.html'), 'Guide missing from cache: ' + device);
  }
  assert.match(sw, /const optional=SHELL\.filter/);
  assert.match(sw, /Math\.min\(6,optional\.length\)/);
  assert.match(sw, /await Promise\.all\(Array\.from/);
  assert.match(sw, /const cachePath=guide\?url\.pathname\+'index\.html':url\.pathname/);
  assert.match(sw, /getAll\('app'\)\.length===1/);
});

test('native download button requires a security digest and a positive package length', () => {
 const js = publicFile('app-device-guide.js');
 assert.match(js, /x-release-sha256/);
 assert.match(js, /Number\.isSafeInteger\(size\) && size > 0/);
 assert.match(js, /nativeAvailable = available\.ok/);
});

test('device guide never offers an installation prompt for the wrong app scope', () => {
 const js = publicFile('app-device-guide.js');
 assert.doesNotMatch(js, /install\.hidden = false/);
 assert.match(js, /open the selected app/i);
});

test('premium install dialog has an accessible close control and device options', () => {
 const js = publicFile('app-pages.js');
 const css = publicFile('app-pages.css');
 assert.match(js, /dialog\.setAttribute\('aria-label','Download '/);
 assert.match(js, /dialog\.addEventListener\('close'/);
 assert.match(js, /install-primary/);
 assert.match(js, /install-device-description/);
 assert.match(css, /\.hk-install-dialog\.downloadgrid|\.hk-install-dialog \.downloadgrid/);
 assert.match(css, /@media\(max-width:480px\)/);
});

test('premium download chooser keeps every device and a safe selected-device route', () => {
 const js = publicFile('app-pages.js');
 const css = publicFile('app-pages.css');
 assert.match(js, /hk-install-dialog/);
 assert.match(js, /install-primary/);
 assert.match(js, /const devices=\[\['android'/);
 assert.match(js, /\['iphone','iPhone'\]/);
 assert.match(js, /\['ipad','iPad'\]/);
 assert.match(js, /\['windows','Windows'\]/);
 assert.match(js, /\['mac','Mac'\]/);
 assert.match(js, /encodeURIComponent\(id\)/);
 assert.match(js, /dialog\.addEventListener\('close'/);
 assert.match(css, /\.hk-install-dialog \.downloadgrid/);
 assert.match(css, /@media\(max-width:480px\)/);
});

test('public app directory and device chooser do not require registration before download',()=>{
 for(const page of ['index.html','downloads.html']){
  const html=publicFile(page);
  assert.match(html,/no Heavenly Key account required/i);
  assert.match(html,/data-download-app="all-in-one"/);
 }
 const chooser=publicFile('app-pages.js');
 assert.match(chooser,/No Heavenly Key sign-in required/);
 assert.match(chooser,/Some member-only features require sign-in after opening the app/);
 const guide=publicFile('app-device-guide.js');
 assert.match(guide,/No Heavenly Key sign-in is required to download it/);
});

test('scanned guides require deliberate download and hide mismatched native installers',()=>{
 const js=publicFile('app-device-guide.js');
 assert.match(js,/function matchesDevice\(\)/);
 assert.match(js,/nativeLink\.hidden = !\(nativeAvailable && matchesDevice\(\)\)/);
 assert.doesNotMatch(js,/window\.location\.assign\(nativeLink\.href\)/);
 assert.doesNotMatch(js,/window\.location\.assign\(destination\.href\)/);
 assert.match(js,/different device/i);
});


test('sharing URLs are restricted to approved secure ministry destinations', () => {
 const source = publicFile('app-pages.js');
 assert.match(source, /destination\.protocol/);
 assert.match(source, /destination\.hostname/);
 assert.match(source, /destination\.username/);
 assert.match(source, /Sharing link unavailable/);
});

test('device guide must not inject a misleading PWA installation manifest', () => {
  const js = publicFile('app-device-guide.js');
  assert.doesNotMatch(js, /manifest\.rel\s*=\s*['"]manifest['"]/);
  assert.doesNotMatch(js, /document\.head\.append\(manifest\)/);
  assert.match(js, /destination app/);
});

test('all app QR images stay on first-party infrastructure', () => {
 const js = publicFile('app-pages.js');
 assert.match(js, /img\.src='\/qr\/app-'/);
 assert.doesNotMatch(js, /api\.qrserver\.com/);
 assert.match(js, /recommended\.href='\/download\/'/);
 assert.doesNotMatch(js, /onlinebible\.heavenlykey\.org\/install\//);
});

test('installation dialog close button works with and without native dialog API', () => {
 const js = publicFile('app-pages.js');
 assert.match(js, /typeof dialog\.close==='function'/);
 assert.match(js, /else dialog\.remove\(\)/);
});

test('offline Bible cache keys distinguish each book and chapter', () => {
 const sw = publicFile('sw.js');
 assert.match(sw, /READING\.has\(url\.pathname\)\?url\.search:''/);
 assert.match(sw, /const key=url\.origin\+cachePath\+/);
 assert.match(sw, /url\.searchParams\.getAll\('book'\)\.length>1/);
 assert.match(sw, /url\.searchParams\.getAll\('chapter'\)\.length>1/);
});


test('offline precache uses a bounded worker pool and rejects private response caches', () => {
 const sw = publicFile('sw.js');
 assert.match(sw, /let cursor=0/);
 assert.match(sw, /async function cacheOptional/);
 assert.match(sw, /optional\[cursor\+\+\]/);
 assert.match(sw, /Math\.min\(6,optional\.length\)/);
 assert.match(sw, /credentials:'omit'/);
 assert.match(sw, /private\|no-store/);
});

test('offline runtime never caches session-varying redirects or no-cache responses', () => {
 const sw = publicFile('sw.js');
 assert.match(sw, /response\.redirected/);
 assert.match(sw, /no-store\|no-cache/);
 assert.match(sw, /cookie\|authorization/);
 assert.match(sw, /response\.headers\.get\('vary'\)/);
});

test('offline fallback can read only the current reviewed shell cache', () => {
 const sw = publicFile('sw.js');
 assert.match(sw, /const cache=await caches\.open\(CACHE\)/);
 assert.match(sw, /await cache\.match\(key\)/);
 assert.match(sw, /await cache\.match\('\/index\.html'\)/);
 assert.doesNotMatch(sw, /await caches\.match\(/);
});

test('precache and runtime share a single safe public-response cache policy', () => {
 const sw=publicFile('sw.js');
 assert.match(sw,/function isSafePublicResponse\(response\)/);
 assert.equal((sw.match(/if\(isSafePublicResponse\(response\)\)/g)||[]).length,1);
 assert.match(sw,/!response\.ok/);
 assert.match(sw,/response\.redirected/);
 assert.match(sw,/no-store\|no-cache/);
 assert.match(sw,/cookie\|authorization/);
});

test('incomplete essential offline app shell rejects installation', () => {
 const sw=publicFile('sw.js');
 assert.match(sw,/Essential app shell unavailable/);
 assert.match(sw,/if\(!isSafePublicResponse\(response\)\) throw new Error/);
 assert.match(sw,/await cache\.put\(path,response\)/);
 assert.doesNotMatch(sw,/for\(const path of core\)\{\s*try\{/);
});

test('runtime never retains personalized HTML navigation responses', () => {
 const sw=publicFile('sw.js');
 assert.match(sw,/request\.mode!=='navigate'/);
 assert.match(sw,/request\.destination!=='document'/);
 assert.match(sw,/isSafePublicResponse\(response\)\)event\.waitUntil/);
});

test('service worker omits member cookies for public asset fetches', () => {
 const sw=publicFile('sw.js');
 assert.match(sw,/const isDocument=request\.mode==='navigate'\|\|request\.destination==='document'/);
 assert.match(sw,/credentials:isDocument\?request\.credentials:'omit'/);
 assert.match(sw,/request\.mode!=='navigate' && request\.destination!=='document'/);
});

test('shared app page script tolerates missing directory widgets', () => {
 const js=publicFile('app-pages.js');
 assert.match(js,/if\(el\)for\(const \[icon,name,device,slug\] of options\)/);
 assert.match(js,/if\(!help\)return/);
 assert.match(js,/document\.querySelectorAll\('\[data-download-app\]'\)/);
});

test('native installer checks exact MIME type and avoids unsupported verification claims', () => {
 const js=publicFile('app-device-guide.js');
 assert.match(js,/contentType\.split\(';',1\)\[0\]\.trim\(\) === expectedTypes\[platform\]/);
 assert.doesNotMatch(js,/contentType\.includes\(expectedTypes\[platform\]\)/);
 assert.match(js,/Confirm its publisher signature before installing/);
 assert.doesNotMatch(js,/A verified native installation package is available/);
});

test('native installer HEAD metadata rejects redirects and member credentials', () => {
 const js = publicFile('app-device-guide.js');
 assert.match(js, /method:'HEAD', cache:'no-store', credentials:'omit', redirect:'error'/);
 assert.doesNotMatch(js, /HEAD verifies a signed and scanned package/);
});
