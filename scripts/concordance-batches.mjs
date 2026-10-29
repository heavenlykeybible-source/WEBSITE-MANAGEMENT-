/**
 * Concordance batch validation and deterministic progress reporting.
 * Node 20+. No network, deployment, or automatic doctrinal approval.
 * Usage: node scripts/concordance-batches.mjs validate canon.json batch.json [more-batches.json]
 * Canon: [{ref:"Genesis 1:1",text:"..."}] (all 31,102 verified KJV verses).
 * Batch: [{ref,explanation,context,crossReferences:["John 1:1"],application,reviewStatus:"pending"}].
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
const [, , command, canonPath, ...batchPaths] = process.argv;
if (command !== 'validate' || !canonPath || !batchPaths.length) {
  console.error('Usage: node scripts/concordance-batches.mjs validate canon.json batch.json [...]');
  process.exit(2);
}
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const canon = read(canonPath);
const errors = [];
if (!Array.isArray(canon) || canon.length !== 31102) errors.push('Canon must contain exactly 31,102 verses');
const canonRefs = new Set(canon.map(v => v.ref));
if (canonRefs.size !== canon.length || canon.some(v => !v.ref || !v.text)) errors.push('Canon references must be unique and include KJV text');
const seen = new Set(), fingerprints = new Map(), records = [];
for (const path of batchPaths) {
  const batch = read(path);
  if (!Array.isArray(batch) || batch.length === 0 || batch.length > 1000 || (batch.length < 500 && batchPaths.indexOf(path) !== batchPaths.length - 1)) errors.push(path + ': expected 500–1,000 entries (final remainder excepted)');
  for (const entry of batch) {
    if (!entry || typeof entry !== 'object') { errors.push(path + ': invalid record'); continue; }
    const ref = entry.ref;
    if (!canonRefs.has(ref)) errors.push('Unknown verse: ' + ref);
    if (seen.has(ref)) errors.push('Duplicate verse: ' + ref);
    seen.add(ref);
    for (const field of ['explanation','context','application']) {
      if (typeof entry[field] !== 'string' || entry[field].trim().length < 30) errors.push(ref + ': missing or too-short ' + field);
    }
    if (!Array.isArray(entry.crossReferences) || !entry.crossReferences.length) errors.push(ref + ': missing cross-references');
    else for (const cross of entry.crossReferences) if (!canonRefs.has(cross)) errors.push(ref + ': unknown cross-reference ' + cross);
    if (!['pending','approved','rejected'].includes(entry.reviewStatus)) errors.push(ref + ': invalid review status');
    const normalized = String(entry.explanation || '').toLowerCase().replace(/\s+/g,' ').trim();
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    if (normalized && fingerprints.has(hash)) errors.push(ref + ': identical explanation to ' + fingerprints.get(hash));
    fingerprints.set(hash, ref);
    records.push(entry);
  }
}
const covered = records.filter(v => canonRefs.has(v.ref)).length;
const report = {
  canonCount: canon.length, submittedRecords: records.length,
  uniqueValidReferences: seen.size, coveragePercent: Number((100 * seen.size / 31102).toFixed(2)),
  remainingVerses: Math.max(0,31102 - seen.size),
  humanApproved: records.filter(v => v.reviewStatus === 'approved').length,
  pendingReview: records.filter(v => v.reviewStatus === 'pending').length,
  errors, passed: errors.length === 0
};
console.log(JSON.stringify(report,null,2));
if (errors.length) process.exitCode = 1;
