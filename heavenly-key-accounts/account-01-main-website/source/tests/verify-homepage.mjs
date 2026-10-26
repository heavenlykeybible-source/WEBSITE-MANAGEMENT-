// Homepage structural checks — built-in Node only, no outside dependencies.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(dir,'index.html'),'utf8');
const attrs=[...html.matchAll(/\b(?:href|src)=(["'])(.*?)\1/g)].map(m=>m[2]);
const missing=[];
for(const value of new Set(attrs)){
 if(/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(value))continue;
 const pathname=decodeURIComponent(value.split(/[?#]/)[0]);if(!pathname)continue;
 const candidate=resolve(dir,pathname.replace(/^\//,''));
 if(!existsSync(candidate)&&!existsSync(resolve(candidate,'index.html')))missing.push(pathname);
}
assert.deepEqual(missing,[],'Missing local links: '+missing.join(', '));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const [img] of html.matchAll(/<img\b[^>]*>/g))assert.match(img,/\balt=/,'Missing alt attribute');
for(const [anchor] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.match(anchor,/rel="[^"]*noopener/,'Unsafe new tab');
assert.ok(!html.includes('css/homepage-polish.css'),'Do not alter existing homepage-wide design');
const ecosystem=html.indexOf('data-cms-section="ecosystem"');
assert.ok(ecosystem>html.indexOf('data-cms-section="welcome"')&&ecosystem<html.indexOf('data-cms-section="assignment"'),'Ecosystem position changed');
const globe=readFileSync(resolve(dir,'css/heavenly-ecosystem.css'),'utf8');
assert.match(globe,/@keyframes hk-land-drift/);
console.log('Homepage QA passed: internal links, unique IDs, image alt, safe tabs, section order, globe and finishing CSS.');
