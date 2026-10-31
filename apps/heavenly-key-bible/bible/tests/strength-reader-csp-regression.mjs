// Static CSP regression checks for the legacy Strength for Today reader.
// Run directly with Node; does not replace deployed-header or browser testing.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../heavenly-key-website/bible');
const html=readFileSync(resolve(root,'strength-for-today.html'),'utf8');
const js=readFileSync(resolve(root,'strength-for-today.js'),'utf8');
const css=readFileSync(resolve(root,'strength-for-today.css'),'utf8');
assert.ok(html.includes('href="./strength-for-today.css"'),'External stylesheet must be linked');
assert.ok(html.includes('src="./strength-for-today.js"'),'External reader script must be linked');
assert.ok(!/<style\b/i.test(html),'Inline style blocks are forbidden');
assert.ok(!/\sstyle\s*=/i.test(html),'Inline style attributes are forbidden');
assert.ok(!/\son[a-z]+\s*=/i.test(html),'Inline event-handler attributes are forbidden');
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 const attrs=match[1];
 assert.ok(/\bsrc\s*=/i.test(attrs)||/application\/(?:ld\+json|json)/i.test(attrs),'Inline executable script is forbidden');
}
assert.ok(!/\b(?:eval|Function)\s*\(/.test(js),'Dynamic code evaluation is forbidden');
assert.ok(!/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(js),'Unsafe HTML-string DOM sinks require explicit review');
assert.ok(!/\b(?:postMessage|window\.parent)\b/.test(js),'Cross-window messaging is not part of this reader');
assert.ok(css.length>1000,'External stylesheet appears unexpectedly incomplete');

assert.doesNotMatch(js,/\\.style\\b|\\.cssText\\b|\\.setProperty\\s*\\(/,'Runtime CSSOM/inline style assignments are forbidden by the reader CSP');
for(const className of ['archive-history','archive-open-button','archive-topic-grid','archive-topic-button','member-search-input','member-result-label']){
 assert.ok(js.includes(className),'Reader must use CSP-safe class '+className);
 assert.ok(css.includes('.'+className),'External CSS must define '+className);
}
for(let i=0;i<12;i++){
 assert.ok(js.includes('data-topic=String(i)'),'Topic controls must be data-driven');
 assert.ok(css.includes('.topic[data-topic="'+i+'"]'),'Missing CSP-safe topic palette '+i);
 assert.ok(css.includes(':root[data-manna-theme="'+i+'"]'),'Missing CSP-safe theme palette '+i);
}

console.log('Strength for Today reader: inline-markup CSP regression checks passed.');
