import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../drafts/', import.meta.url));
const files = (await readdir(dir)).filter(name => /^[a-z0-9-]+\\.json$/.test(name)).sort();
const refs = new Set();
const errors = [];
let total = 0;
for (const file of files) {
  let entries;
  try { entries = JSON.parse(await readFile(join(dir, file), 'utf8')); }
  catch (error) { errors.push(`${file}: invalid JSON: ${error.message}`); continue; }
  if (!Array.isArray(entries)) { errors.push(`${file}: expected an array`); continue; }
  for (const [index, entry] of entries.entries()) {
    const at = `${file}[${index}]`;
    if (!entry || typeof entry !== 'object') { errors.push(`${at}: invalid entry`); continue; }
    if (!/^[1-3]?[A-Za-z ]+ \\d+:\\d+$/.test(entry.ref ?? '')) errors.push(`${at}: invalid verse reference`);
    if (refs.has(entry.ref)) errors.push(`${at}: duplicate ${entry.ref}`);
    refs.add(entry.ref);
    for (const key of ['explanation', 'context', 'application']) {
      if (typeof entry[key] !== 'string' || entry[key].trim().length < 35) errors.push(`${at}: missing or short ${key}`);
    }
    if (!Array.isArray(entry.crossReferences) || entry.crossReferences.length === 0 ||
        entry.crossReferences.some(ref => typeof ref !== 'string' || !/^[1-3]?[A-Za-z ]+ \\d+:\\d+$/.test(ref)))
      errors.push(`${at}: invalid crossReferences`);
    if (!['pending', 'approved', 'rejected'].includes(entry.reviewStatus)) errors.push(`${at}: invalid reviewStatus`);
    total++;
  }
}
console.log(JSON.stringify({ files: files.length, entries: total, uniqueReferences: refs.size, errors: errors.length, sampleErrors: errors.slice(0, 30) }, null, 2));
if (errors.length) process.exitCode = 1;
