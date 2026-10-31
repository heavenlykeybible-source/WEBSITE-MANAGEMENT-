// STRENGTH FOR TODAY — member selector regression test.
// Run from repository root: node apps/heavenly-key-bible/bible/tests/strength-member-selector.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(here, '../../heavenly-key-website/bible/strength-for-today.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>', scriptStart);
assert(scriptStart >= '<script>'.length && scriptEnd > scriptStart, 'inline application script must exist');
const script = html.slice(scriptStart, scriptEnd);
new vm.Script(script, { filename: htmlPath });

const handlers = script.match(/\$\('members'\)\.onclick=/g) || [];
assert.equal(handlers.length, 1, 'Send Strength to Members must have exactly one click handler');
assert(!script.includes("window.location.href=COMMUNITY_STRENGTH_URL"), 'member button must not redirect away from the selector');
assert.match(script, /selector\.hidden=true/, 'member selector must start hidden and support closing');
assert.match(script, /\$\('members'\)\.onclick=async\(\)=>\{if\(!await authenticated\(\)\)return;selector\.hidden=false;/, 'opening the member selector must require an active signed-in session');
assert.match(script, /memberInput\.focus\(\{preventScroll:true\}\)/, 'member search must receive focus when opened');
assert.match(script, /request\('\/api\/discover\?q='/, 'member discovery must continue using the validated same-origin API helper');
console.log('PASS: Strength for Today member selector opens safely, focuses search, and does not redirect away.');
