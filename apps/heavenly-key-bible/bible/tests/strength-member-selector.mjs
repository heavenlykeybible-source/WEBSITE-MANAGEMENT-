// STRENGTH FOR TODAY — member selector and keyboard-accessibility regression test.
// Run from repository root: node apps/heavenly-key-bible/bible/tests/strength-member-selector.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const htmlPath=resolve(here,'../../heavenly-key-website/bible/strength-for-today.html');
const html=fs.readFileSync(htmlPath,'utf8');
const scriptStart=html.indexOf('<script>')+'<script>'.length;
const scriptEnd=html.indexOf('</script>',scriptStart);
assert(scriptStart>='<script>'.length&&scriptEnd>scriptStart,'inline application script must exist');
const script=html.slice(scriptStart,scriptEnd);
new vm.Script(script,{filename:htmlPath});

assert.equal(script.split("$('members').onclick=").length-1,1,'Send Strength to Members must have exactly one click handler');
assert(!script.includes('window.location.href=COMMUNITY_STRENGTH_URL'),'member button must not redirect away from selector');
assert(script.includes('selector.hidden=true'),'member selector must start hidden');
assert(script.includes("$('members').onclick=async()=>{if(!await authenticated())return;selector.hidden=false;"),'opening selector must require an active signed-in session');
assert(script.includes('memberInput.focus({preventScroll:true})'),'member search must receive focus when opened');
assert(script.includes("request('/api/discover?q='"),'member discovery must use validated same-origin API helper');
assert(script.includes("setAttribute('role','region')"),'member selector must expose a named accessible region');
assert(script.includes("setAttribute('aria-labelledby','strength-member-selector-title')"),'member selector must have an accessible name');
assert(script.includes("event.key==='Escape'"),'Escape must close the member selector');
assert(script.includes("$('members').focus()"),'focus must return to the opening control after closing');
console.log('PASS: Strength for Today member selector, authentication guard, safe discovery, keyboard operation and focus restoration.');
