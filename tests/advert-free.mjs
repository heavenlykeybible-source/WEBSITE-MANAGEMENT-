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
