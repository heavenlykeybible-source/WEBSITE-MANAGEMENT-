import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const html=readFileSync(resolve(root,'strength-for-today-next.html'),'utf8');
const js=readFileSync(resolve(root,'strength-for-today-next.js'),'utf8');
assert.match(html,/Development preview — not published devotional content/);
assert.match(html,/strength-for-today-next\.js/);
assert.match(html,/aria-live="polite"/);
assert.ok(html.includes('href="#main-content"'));
assert.ok(html.includes('id="section-title" tabindex="-1"'));
assert.ok(html.includes('button:focus-visible'));
for(const id of ['menu','content','section-number','section-title','prev','next','progress','copy-section','copy-all','share','status']){
 assert.ok(html.includes('id="'+id+'"'),'Missing preview control '+id);
}
for(const name of ["Today's Topic",'Bible Reading','Hymn of the Day','Bible Story','Life Stories Around the World','Eternity in View','Destiny Decision & Action','Warfare Prayer','Prophetic Prayer','Health & Wellness Prayer','Salvation Prayer','12 Kingdom Challenges for Today']){
 assert.ok(js.includes(name),'Missing devotional section '+name);
}
assert.match(js,/Awaiting approved daily challenge/);
assert.match(js,/menu\.addEventListener\('keydown'/);
for(const key of ['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'])assert.ok(js.includes("case '"+key+"'"),'Missing keyboard shortcut '+key);
assert.match(js,/event\.preventDefault\(\);buttons\[target\]\.focus\(\)/);
assert.ok(js.includes("$('section-title').focus()"));
assert.ok(js.includes('DEVELOPMENT PREVIEW — NOT FOR PUBLICATION'));
assert.doesNotMatch(js,/innerHTML\s*=/);
assert.doesNotMatch(js,/fetch\s*\(/);
console.log('Twelve-section preview structure and draft-only safety checks passed.');
