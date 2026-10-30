import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../apps/global-christian-community/src/adverts.ts', import.meta.url),'utf8');

// Source-level regression checks, not a replacement for deployment integration tests.
test('public advert feed defaults to off unless explicitly enabled', () => {
  assert.match(source, /ADVERTS_ENABLED[^\n]*!=="true"\)return \{items:\[\]\}/);
});
test('advert images default to off unless explicitly enabled', () => {
  assert.match(source, /ADVERTS_ENABLED[^\n]*!=="true"\)return null/);
});
test('publishing requires the explicitly configured owner account and owner role', () => {
  assert.match(source, /a\.status==="published"/);
  assert.match(source, /actor\.userId!==ownerId\|\|actor\.role!=="owner"/);
});
test('public feeds must filter out legacy advertisements not signed by the designated owner', () => {
  assert.match(source, /status='published' AND updated_by=\?/);
  assert.match(source, /\.bind\(ownerId,now,now\)/);
});
test('advert images must have the same owner-authorized delivery filter', () => {
  assert.match(source, /a\.status='published' AND a\.updated_by=\?/);
  assert.match(source, /\.bind\(id,url,ownerId,now,now\)/);
});
test('public delivery must fail closed when designated owner is unset', () => {
  assert.match(source, /Number\.isSafeInteger\(ownerId\)\|\|ownerId<=0\)return \{items:\[\]\}/);
  assert.match(source, /Number\.isSafeInteger\(ownerId\)\|\|ownerId<=0\)return null/);
});
