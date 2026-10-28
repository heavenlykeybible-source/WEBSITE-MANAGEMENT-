import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Guard executable frontend/backend sources against third-party advertising SDKs.
// Documentation and historical migrations are intentionally excluded.
const blocked = [
  /pagead2\.googlesyndication\.com/i,
  /googleads\.g\.doubleclick\.net/i,
  /googletagservices\.com/i,
  /securepubads\.g\.doubleclick\.net/i,
  /adsbygoogle/i,
  /googletag\.cmd/i,
  /connect\.facebook\.net\/[^"'\\s]*fbevents\.js/i,
  /amazon-adsystem\.com/i,
  /taboola\.com\/[^"'\\s]*\/loader\.js/i,
  /outbrain\.com\/outbrain\.js/i,
];
const ignored = new Set(['node_modules','.git','dist','build','coverage','release-packages','docs','tests']);
const extensions = new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.html','.htm','.vue','.svelte']);
let scanned = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) continue;
    const file = path.join(dir,entry.name);
    if (entry.isDirectory()) {
      if (!ignored.has(entry.name)) walk(file);
    } else if (extensions.has(path.extname(entry.name))) {
      const source = fs.readFileSync(file,'utf8');
      for (const pattern of blocked) {
        assert.equal(pattern.test(source),false,`Advertising SDK detected in ${file}: ${pattern}`);
      }
      scanned++;
    }
  }
}
walk(process.cwd());
assert.ok(scanned > 0,'No executable source files scanned');
console.log(`Advertising SDK regression check passed: ${scanned} source files`);

const communityVariants = [
  'apps/global-christian-community',
  'heavenly-key-accounts/account-03-global-christian-community/source',
  'heavenly-key-accounts/account-03-global-christian-community/alternate-global-community',
];
for (const base of communityVariants) {
  const backend = fs.readFileSync(path.join(base,'src/index.ts'),'utf8');
  const frontend = fs.readFileSync(path.join(base,'public/app.js'),'utf8');
  const guard = backend.indexOf('OWNER POLICY: All Heavenly Key platforms are advertising-free.');
  const legacy = backend.indexOf('if(p==="/api/admin/social-signin"');
  assert.ok(guard >= 0 && legacy > guard,'Advert endpoint protection must precede normal routes: '+base);
  assert.ok(!backend.includes('Adverts.'),'Unreachable advert backend calls remain: '+base);
  assert.ok(backend.includes('advertisingEnabled:false'),'Public advert endpoint must declare disabled: '+base);
  assert.ok(backend.includes('if(p==="/api/adverts"&&m==="GET")'),'Public ad delivery must return an empty list: '+base);
  assert.ok(backend.includes('return json({error:{message:"Advertising is disabled across Heavenly Key platforms."},advertisingEnabled:false},410);'),'Advertising management routes must be rejected: '+base);
  assert.ok(!backend.includes('from "./adverts"'),'Advertising module must not be imported: '+base);
  for(const fragment of ['function renderAdvert(', 'function mountAdverts(', 'SPONSORED ·', 'api("/api/adverts")']) {
    assert.ok(!frontend.includes(fragment),'Advertising frontend survived in '+base+': '+fragment);
  }
}
console.log('Three community variants enforce the no-advert owner policy.');
