import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertReviewedAccount4Source} from '../scripts/account4-release-integrity.mjs';

const source='x'.repeat(10001);
const sha=createHash('sha256').update(source,'utf8').digest('hex');
const blobSha=createHash('sha1').update('blob '+Buffer.byteLength(source,'utf8')+'\0').update(source,'utf8').digest('hex');
assert.equal(assertReviewedAccount4Source(source,{after_sha256:sha,built_sha256:'f'.repeat(64)}),sha);
assert.equal(assertReviewedAccount4Source(source,{after_sha256:'0'.repeat(64),built_sha256:'f'.repeat(64),source_blob_sha:blobSha}),sha);
for(const [candidate,meta] of [
  [source+'x',{after_sha256:sha,built_sha256:'f'.repeat(64),source_blob_sha:blobSha}],
  [source,{after_sha256:'bad',built_sha256:'bad'}],
  [source,null],
  ['',{after_sha256:sha,built_sha256:'f'.repeat(64)}]
]) assert.throws(()=>assertReviewedAccount4Source(candidate,meta),/deployment blocked/);
console.log('PASS Account 4 exact SHA-256 and Git blob release integrity gates');
