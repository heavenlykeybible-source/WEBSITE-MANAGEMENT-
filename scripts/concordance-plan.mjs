/**
 * Deterministic concordance work planner. No AI generation and no deployment.
 * node scripts/concordance-plan.mjs canon.json completed.json [batchSize]
 * completed.json: array of verse records; existing work is never overwritten.
 */
import fs from 'node:fs';
const [, , canonFile, completedFile, sizeArg = '750'] = process.argv;
if (!canonFile || !completedFile) {
  console.error('Usage: node scripts/concordance-plan.mjs canon.json completed.json [500..1000]');
  process.exit(2);
}
const size = Number(sizeArg);
if (!Number.isInteger(size) || size < 500 || size > 1000) throw new Error('Batch size must be 500–1,000');
const canon = JSON.parse(fs.readFileSync(canonFile, 'utf8'));
const completed = JSON.parse(fs.readFileSync(completedFile, 'utf8'));
if (!Array.isArray(canon) || canon.length !== 31102) throw new Error('Expected complete 31,102-verse KJV canon');
if (!Array.isArray(completed)) throw new Error('Completed work must be an array');
const canonRefs = new Set(canon.map(v => v.ref));
if (canonRefs.size !== 31102 || canon.some(v => !v.ref || !v.text)) throw new Error('Canon is incomplete or contains duplicate references');
const existing = new Set();
for (const v of completed) {
  if (!canonRefs.has(v.ref)) throw new Error('Completed entry outside KJV canon: ' + v.ref);
  if (existing.has(v.ref)) throw new Error('Duplicate completed entry: ' + v.ref);
  existing.add(v.ref);
}
const pending = canon.filter(v => !existing.has(v.ref));
const batches = [];
for (let i = 0; i < pending.length; i += size) {
  const verses = pending.slice(i, i + size);
  batches.push({
    batch: batches.length + 1,
    start: verses[0].ref,
    end: verses.at(-1).ref,
    count: verses.length,
    references: verses.map(v => v.ref),
    status: 'not_generated'
  });
}
const report = {
  target: canon.length,
  existingEntriesPreserved: existing.size,
  remaining: pending.length,
  plannedBatches: batches.length,
  batchSizeTarget: size,
  note: 'Final batch may be smaller than 500; validation must allow a documented final remainder.',
  batches
};
console.log(JSON.stringify(report, null, 2));
