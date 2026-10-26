// Homepage structural checks — built-in Node only, no outside dependencies.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(dir,'index.html'),'utf8');
const sharedJs=readFileSync(resolve(dir,'js/main.js'),'utf8');
const sw=readFileSync(resolve(dir,'service-worker.js'),'utf8');
assert.ok(sw.includes('url.origin !== self.location.origin'), 'PWA must not intercept cross-origin app or sign-in traffic');
assert.ok(!sw.includes('"/css/homepage-polish.css?v=20261026"'), 'Unused global style must not be precached');
assert.ok(!sharedJs.includes('/pages/legal-requests.html'), 'Broken Legal Requests link must not recur');
assert.ok(sharedJs.includes('/pages/contact'), 'Legal Requests must lead to the verified Contact page');
assert.ok(!sharedJs.includes('/pages/terms.html'), 'Terms URL should use the verified clean route');
const attrs=[...html.matchAll(/\b(?:href|src)=(["'])(.*?)\1/g)].map(m=>m[2]);
const missing=[];
for(const value of new Set(attrs)){
 if(/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(value))continue;
 const pathname=decodeURIComponent(value.split(/[?#]/)[0]);if(!pathname)continue;
 const candidate=resolve(dir,pathname.replace(/^\//,''));
 const htmlCandidate=candidate+'.html';
 if(!existsSync(candidate)&&!existsSync(htmlCandidate)&&!existsSync(resolve(candidate,'index.html')))missing.push(pathname);
}
assert.deepEqual(missing,[],'Missing local links: '+missing.join(', '));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const [img] of html.matchAll(/<img\b[^>]*>/g))assert.match(img,/\balt=/,'Missing alt attribute');
for(const [anchor] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.match(anchor,/rel="[^"]*noopener/,'Unsafe new tab');
assert.ok(!html.includes('css/homepage-polish.css'),'Do not alter existing homepage-wide design');
assert.doesNotMatch(html, /href=["']pages\/[a-z0-9-]+\.html/gi, 'Public homepage links must use extensionless routes');
const ecosystem=html.indexOf('data-cms-section="ecosystem"');
assert.ok(ecosystem>html.indexOf('data-cms-section="welcome"')&&ecosystem<html.indexOf('data-cms-section="assignment"'),'Ecosystem position changed');
const globe=readFileSync(resolve(dir,'css/heavenly-ecosystem.css'),'utf8');
assert.match(globe,/@keyframes hk-land-drift/);

// All public pages use the shared unobtrusive finish without changing ministry content.
const publicPages=['about','contact','grdpc','i-said-yes','meet-the-pastor','ministries','partner','privacy','radio','resources','social-handles','steps-to-salvation','terms','the-ministry','what-we-believe'];
const finish=readFileSync(resolve(dir,'css/global-clean-finish.css'),'utf8');
assert.ok(finish.includes('background-image:'),'Premium backdrop must remain available');
assert.ok(html.includes('css/global-clean-finish.css'),'Homepage must include shared finish');
assert.ok(html.includes('https://radio.heavenlykey.org/'),'Homepage radio must point to verified current service');
assert.doesNotMatch(html,/href=["']pages\/radio(?:\.html)?["']/i,'Old homepage radio links must not recur');
for(const page of publicPages){
 const pageHtml=readFileSync(resolve(dir,'pages',page+'.html'),'utf8');
 assert.ok(pageHtml.includes('/css/global-clean-finish.css'), 'Missing shared background on '+page);
 assert.doesNotMatch(pageHtml,/href=["'](?:\/pages\/radio(?:\.html)?|\.\/radio\.html)["']/i,'Old radio link found on '+page);
 assert.doesNotMatch(pageHtml,/href=["'](?:https:\/\/heavenlykey\.org)?\/pages\/[a-z0-9-]+\.html(?:[?#][^"']*)?["']/i,'Public links must not expose .html on '+page);
 assert.doesNotMatch(pageHtml,/href=["'](?:\.\/)?[a-z0-9-]+\.html(?:[?#][^"']*)?["']/i,'Relative .html navigation must not recur on '+page);
}

console.log('Homepage QA passed: internal links, unique IDs, image alt, safe tabs, section order, globe and finishing CSS.');
