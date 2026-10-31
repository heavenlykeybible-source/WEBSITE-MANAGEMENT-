import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertReviewedAccount4Source} from '../scripts/account4-release-integrity.mjs';

const source='export default { fetch(){ return new Response("reviewed"); } };';
const sha=createHash('sha256').update(source,'utf8').digest('hex');
const metadata={after_sha256:sha,built_sha256:'f'.repeat(64)};
assert.equal(assertReviewedAccount4Source(source,metadata),sha);
assert.equal(assertReviewedAccount4Source(source,{after_sha256:'0'.repeat(64),built_sha256:sha}),sha);
for(const [candidate,meta] of [
  [source+'// unexpected',metadata],
  [source,{after_sha256:'invalid',built_sha256:'invalid'}],
  [source,null],
  ['',metadata]
]) assert.throws(()=>assertReviewedAccount4Source(candidate,meta),/deployment blocked/);
console.log('PASS Account 4 deployment accepts only the exact reviewed Worker source');
