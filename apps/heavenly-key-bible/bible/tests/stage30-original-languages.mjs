import assert from 'node:assert/strict';
import fs from 'node:fs';
const root='heavenly-key-website/bible/';
const entries=JSON.parse(fs.readFileSync(root+'original-language-guide.json','utf8'));
assert(entries.length>=15);
for(const e of entries){assert(/^[GH]\d+$/.test(e.strong));assert(e.english&&e.language&&e.meaning&&e.caution);}
assert(entries.some(e=>e.strong==='G4102'));
assert(entries.some(e=>e.strong==='H7965'));
const js=fs.readFileSync(root+'study-extensions.js','utf8');
const html=fs.readFileSync(root+'study-extensions.html','utf8');
assert(js.includes('renderOriginalLanguageGuide()'));
assert(js.includes("fetch('./original-language-guide.json')"));
assert(html.includes('id="original-query"'));
assert(fs.readFileSync(root+'sw.js','utf8').includes('"./original-language-guide.json"'));
console.log('PASS: source-aware original language glossary, UI wiring, and offline cache');
