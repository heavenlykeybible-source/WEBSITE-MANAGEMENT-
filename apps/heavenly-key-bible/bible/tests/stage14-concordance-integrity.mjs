import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync('heavenly-key-website/bible/study-extensions.js','utf8');
assert(s.includes("textIndex.clear();throw new Error('Concordance incomplete:"),'reject partial search index');
assert(s.includes('if(!booksLoaded)loading=null'),'allow retry after failed load');
assert(s.includes("$('concordance-results').replaceChildren()")&&s.includes("$('concordance-breakdown').replaceChildren()"),'remove stale partial results');
assert(s.includes("$('prev-page').disabled=true")&&s.includes("$('next-page').disabled=true"),'prevent browsing stale result pages');
console.log('PASS: incomplete KJV concordance index fails closed and retries safely');
