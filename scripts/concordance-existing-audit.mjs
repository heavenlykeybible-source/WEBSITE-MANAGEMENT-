// Read-only audit of existing concordance study notes. Never deploys or rewrites content.
// Run: node scripts/concordance-existing-audit.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root = 'apps/heavenly-key-bible/heavenly-key-website/bible/concordance';
const files = ['concordance.js','study-notes-matthew-5.js','study-notes-matthew-5b.js'];
const all = new Map(), duplicates = [], failures = [];
for (const file of files) {
  const source = fs.readFileSync(path.join(root,file),'utf8');
  // Source files have different structures: collect the explicit reference keys
  // only; a source match is NOT proof of a reviewed, complete explanation.
  const matches = [...source.matchAll(/(?:["'])([1-3]?\s?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?\s+\d+:\d+)(?:["'])\s*:/g)];
  const entries = new Set(matches.map(m=>m[1]));
  if (file.startsWith('study-notes')) {
    // These files store entries as objects with a ref property, not keyed objects.
    for (const m of source.matchAll(/["']ref["']\s*:\s*["']([^"']+)["']/g)) entries.add(m[1]);
  }
  for (const ref of entries) {
    if (all.has(ref)) duplicates.push({ref,first:all.get(ref),again:file});
    else all.set(ref,file);
  }
  if (!entries.size) failures.push(file + ': no references extracted; inspect source format');
}
const report = {
  target:31102,
  locatedReferenceKeys:all.size,
  possibleRemaining:31102-all.size,
  duplicates,
  sourceFiles:files,
  limitations:'Static inventory only. References may be non-explanation fields; does not certify complete, verified, or approved commentary. Manual and runtime review required.',
  failures
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
