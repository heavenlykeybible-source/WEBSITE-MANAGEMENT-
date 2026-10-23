import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('heavenly-key-website/bible/study-extensions.js','utf8');
assert(src.includes("concordanceButton.textContent='Find in KJV concordance'"));
assert(src.includes("$('concordance-form').requestSubmit()"));
assert(src.includes("$('word').value=e.term"));
assert(src.includes('card.append(concordanceButton)'));
assert(src.includes("concordanceButton.setAttribute('aria-label'"));
console.log('PASS: dictionary words can open complete KJV concordance searches');
