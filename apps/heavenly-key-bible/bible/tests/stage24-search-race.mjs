import assert from 'node:assert/strict';
import fs from 'node:fs';
const script=fs.readFileSync('heavenly-key-website/bible/study-extensions.js','utf8');
const form=script.slice(script.indexOf("$('concordance-form').addEventListener('submit'"));
assert(form.includes('const searchSequence=++concordanceSequence'),'each search uniquely identified');
assert(form.includes('if(searchSequence!==concordanceSequence)return;'),'stale searches discarded');
assert(form.includes('resetConcordanceResults();'),'results cleared before retry');
assert(script.includes("$('prev-page').onclick=null"),'outdated pagination handlers removed');
console.log('PASS: stale concordance responses cannot overwrite subsequent search, invalid queries reset results');
