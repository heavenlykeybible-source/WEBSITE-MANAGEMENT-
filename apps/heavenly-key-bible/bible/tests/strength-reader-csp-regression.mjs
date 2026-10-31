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
const shareStudio=readFileSync(resolve(root,'strength-share-studio.js'),'utf8');
const shareJs=readFileSync(resolve(root,'strength-share-studio.js'),'utf8');
assert.ok(html.includes('href="./strength-for-today.css"'),'External stylesheet must be linked');
assert.match(html,/http-equiv="Content-Security-Policy"[^>]*style-src \'self\'/,'Reader must enforce a page-level no-inline-style CSP');
assert.doesNotMatch(html,/unsafe-inline|unsafe-eval/i,'Reader CSP must not weaken style or script policy');
assert.ok(html.includes('src="./strength-for-today.js"'),'External reader script must be linked');
assert.ok(!/<style\b/i.test(html),'Inline style blocks are forbidden');
assert.ok(!/\sstyle\s*=/i.test(html),'Inline style attributes are forbidden');
assert.match(html,/<img[^>]*id="manna-image-preview"[^>]*class="strength-inline-9"\s*\/>/,'Scripture preview image markup must be valid and class must precede self-closing slash');
assert.doesNotMatch(shareJs,/\.style\b|\.cssText\b|\.setProperty\s*\(/,'Share studio must not write inline styles');
assert.ok(shareJs.includes('preview.dataset.imageSize=size.value'),'Share studio must select image preview sizing through data attributes');
assert.ok(css.includes('#manna-image-preview[data-image-size="vertical"]')&&css.includes('#manna-image-preview[data-image-size="facebook"]'),'Preview size styles must be provided by external CSS');
assert.ok(!/\son[a-z]+\s*=/i.test(html),'Inline event-handler attributes are forbidden');
for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
 const attrs=match[1];
 assert.ok(/\bsrc\s*=/i.test(attrs)||/application\/(?:ld\+json|json)/i.test(attrs),'Inline executable script is forbidden');
}
assert.ok(!/\b(?:eval|Function)\s*\(/.test(js),'Dynamic code evaluation is forbidden');
assert.ok(!/\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b/.test(js),'Unsafe HTML-string DOM sinks require explicit review');
assert.ok(!/\b(?:postMessage|window\.parent)\b/.test(js),'Cross-window messaging is not part of this reader');
assert.ok(css.length>1000,'External stylesheet appears unexpectedly incomplete');

assert.match(html,/<title>OUR DAILY MANNA — STRENGTH FOR TODAY/i,'OUR DAILY MANNA must lead the page title');
assert.match(html,/<h1>OUR DAILY MANNA<\/h1>/,'OUR DAILY MANNA must lead the visible masthead');
assert.ok(html.includes('id="daily-central-message"')&&html.includes('id="daily-spiritual-focus"'),'Daily central message and spiritual focus must have dedicated fields');
assert.ok(shareStudio.includes('OUR DAILY MANNA  •  KJV')&&shareStudio.includes('OUR DAILY MANNA — STRENGTH FOR TODAY'),'Scripture cards and share metadata must use the approved title');
assert.ok(js.includes("Our Daily Manna — Strength for Today")&&js.includes("typeof entry.centralMessage==='string'")&&js.includes("typeof entry.spiritualFocus==='string'"),'A dated edition must not render without an approved central message and spiritual focus');

const batchFiles=[
 'strength-devotionals-2026.json','strength-devotionals-2027-batch01.json',
 'strength-devotionals-year1-batch02.json','strength-devotionals-year1-batch03.json','strength-devotionals-year1-batch04.json',
 'strength-devotionals-year2-batch01.json','strength-devotionals-year2-batch02.json','strength-devotionals-year2-batch03.json','strength-devotionals-year2-batch04.json',
 'strength-devotionals-year3-batch01.json','strength-devotionals-year3-batch02.json','strength-devotionals-year3-batch03.json','strength-devotionals-year3-batch04.json',
 'strength-devotionals-year4-batch01.json','strength-devotionals-year4-batch02.json','strength-devotionals-year4-batch03.json','strength-devotionals-year4-batch04.json',
 'strength-devotionals-year5-batch01.json','strength-devotionals-year5-batch02.json','strength-devotionals-year5-batch03.json','strength-devotionals-year5-batch04.json'
];
const datedEntries=[];
for(const file of batchFiles){
 assert.ok(js.includes(file),'Reader must map '+file);
 const data=JSON.parse(readFileSync(resolve(root,file),'utf8'));
 assert.equal(data.timezone,'Africa/Lagos','Every batch must use Africa/Lagos');
 assert.ok(Array.isArray(data.entries)&&data.entries.length>0,'Every batch must contain dated entries: '+file);
 datedEntries.push(...data.entries);
}
const dates=datedEntries.map(entry=>entry.date).sort();
assert.equal(dates.length,1826,'The current draft library should contain 1,826 dated editions through 2031-10-29');
assert.equal(new Set(dates).size,dates.length,'Daily edition dates must not be duplicated');
const dayMs=86400000;
for(let day=Date.parse('2026-10-30T00:00:00Z');day<=Date.parse('2031-10-29T00:00:00Z');day+=dayMs){
 assert.ok(dates.includes(new Date(day).toISOString().slice(0,10)),'Missing daily edition date '+new Date(day).toISOString().slice(0,10));
}
assert.ok(!dates.includes('2031-10-30')&&!dates.includes('2031-10-31'),'Do not fabricate the two missing final dates');


assert.doesNotMatch(js,/\.style\b|\.cssText\b|\.setProperty\s*\(/,'Runtime CSSOM/inline style assignments are forbidden by the reader CSP');
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
