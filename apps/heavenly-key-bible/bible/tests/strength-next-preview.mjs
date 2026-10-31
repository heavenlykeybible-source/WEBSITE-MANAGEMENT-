import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const html=readFileSync(resolve(root,'strength-for-today-next.html'),'utf8');
const js=readFileSync(resolve(root,'strength-for-today-next.js'),'utf8');
const css=readFileSync(resolve(root,'strength-for-today-next.css'),'utf8');
assert.match(html,/href="\.\/strength-for-today-next\.css"/);
assert.doesNotMatch(html,/<style\b|\sstyle=/i);
assert.match(html,/http-equiv="Content-Security-Policy"/);
for(const directive of ["default-src 'none'","script-src 'self'","style-src 'self'","connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'"]){
 assert.ok(html.includes(directive),'Missing CSP protection '+directive);
}
assert.doesNotMatch(html,/unsafe-inline|unsafe-eval/);

assert.doesNotMatch(js,/\.style\.fontSize\s*=/);
assert.match(html,/Development preview — not published devotional content/);
assert.match(html,/strength-for-today-next\.js/);
assert.match(html,/aria-live="polite"/);
assert.ok(html.includes('href="#main-content"'));
assert.ok(html.includes('id="section-title" tabindex="-1"'));
assert.ok(css.includes('button:focus-visible'));
for(const id of ['menu','content','section-number','section-title','prev','next','progress','copy-section','copy-all','share','status','font-smaller','font-larger','font-reset','print']){
 assert.ok(html.includes('id="'+id+'"'),'Missing preview control '+id);
}
for(const name of ["Today's Topic",'Bible Reading','Hymn of the Day','Bible Story','Life Stories Around the World','Eternity in View','Destiny Decision & Action','Warfare Prayer','Prophetic Prayer','Health & Wellness Prayer','Salvation Prayer','12 Kingdom Challenges for Today']){
 assert.ok(js.includes(name),'Missing devotional section '+name);
}
assert.match(js,/Awaiting approved daily challenge/);
assert.match(js,/menu\.addEventListener\('keydown'/);
for(const key of ['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'])assert.ok(js.includes("case '"+key+"'"),'Missing keyboard shortcut '+key);
assert.ok(js.includes('navigate(target,{focus:false})'),'Keyboard navigation should use common navigation handler');
assert.match(js,/b\.tabIndex=i===current\?0:-1/);
assert.ok(js.includes("$('section-title').focus()"));
assert.ok(js.includes('DEVELOPMENT PREVIEW — NOT FOR PUBLICATION'));
for(const marker of ['sectionFromHash','hashchange','history.replaceState','window.print()','adjustText'])assert.ok(js.includes(marker),'Missing navigation or reader feature '+marker);
assert.ok(css.includes('@media print'));
assert.ok(js.includes('readFontScale()'));
assert.ok(js.includes('saveFontScale(textScale)'));
assert.ok(js.includes('Math.min(2,Math.max(.85'));
assert.ok(js.includes("$('font-reset').onclick"));
assert.ok(js.includes('try{const value=Number(localStorage.getItem'));
assert.ok(js.includes('try{localStorage.setItem'));
assert.ok(css.includes('overflow-wrap:anywhere'));
for(const n of [85,90,95,100,110,150,200])assert.ok(css.includes('#content.font-scale-'+n),'Missing text scale '+n);
assert.doesNotMatch(js,/innerHTML\s*=/);
assert.doesNotMatch(js,/fetch\s*\(/);
console.log('Twelve-section preview structure and draft-only safety checks passed.');
