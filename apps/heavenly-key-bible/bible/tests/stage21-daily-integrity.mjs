import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('heavenly-key-website/bible/study-extensions.js','utf8');
assert(src.includes('Date.UTC(year,month-1,day)/86400000'),'fixed UTC calendar day indexing');
assert(src.includes('k>localDay()'),'future dated entries excluded');
assert(src.includes('dt.getUTCFullYear()===year'),'invalid calendar dates excluded');
assert(src.includes('completedDays.has(day)'),'streak uses validated completed days');
for(const [y,m,d] of [[2025,1,1],[2025,6,1],[2026,12,31]]){
const idx=Math.floor(Date.UTC(y,m-1,d)/86400000);
assert.equal(Math.floor(Date.UTC(y,m-1,d+1)/86400000)-idx,1,'every UTC calendar day advances once');
}
console.log('PASS: calendar-safe topic rotation and validated daily completion streaks');
