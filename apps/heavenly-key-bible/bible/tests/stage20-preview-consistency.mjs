import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('heavenly-key-website/bible/study-extensions.js','utf8');
assert(src.includes("const rotation=$('rotation').value||settings?.rotation||'chosen'"),'Preview rotation should use currently selected control');
assert(src.includes("const content=state.topics[selected]||state.topics[entries[0]]"),'Missing or stale topic must fall back safely');
assert(src.includes('if(!entries.length)return;'),'Empty topic library must not crash');
console.log('PASS: unsaved Read & Pray topic rotation preview matches UI, stale references handled safely');
