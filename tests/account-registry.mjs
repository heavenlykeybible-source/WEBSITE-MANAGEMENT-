import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry = JSON.parse(fs.readFileSync('config/heavenly-key-accounts.json', 'utf8'));
assert.ok(Array.isArray(registry.accounts), 'Account registry must contain an accounts array');
const ids = registry.accounts.map(item => item.account);
assert.equal(new Set(ids).size, ids.length, 'Account IDs must be unique');
assert.ok(ids.every(id => Number.isSafeInteger(id) && id > 0), 'Account IDs must be positive integers');

const domains = new Set();
for (const account of registry.accounts) {
  assert.equal(typeof account.name, 'string');
  assert.ok(account.name.trim(), 'Every account must have a name');
  for (const field of ['website', 'ai_target_url', 'page_url']) {
    if (account[field] === undefined) continue;
    const url = new URL(account[field]);
    assert.equal(url.protocol, 'https:', field + ' must use HTTPS');
    assert.equal(url.username, '', field + ' must not contain credentials');
    assert.equal(url.password, '', field + ' must not contain credentials');
    assert.equal(url.search, '', field + ' must not contain query parameters');
    assert.equal(url.hash, '', field + ' must not contain a fragment');
    assert.equal(url.pathname, '/', field + ' must point to the origin');
  }
  if (account.website) {
    const origin = new URL(account.website).origin;
    assert.ok(!domains.has(origin), 'Duplicate website origin: ' + origin);
    domains.add(origin);
  }
}

const socialPlus = registry.accounts.find(account => account.account === 10);
assert.ok(socialPlus, 'Account 10 SocialPlus must be registered');
assert.equal(socialPlus.name, 'SocialPlus');
for (const field of ['website', 'ai_target_url', 'page_url']) {
  assert.equal(socialPlus[field], 'https://socialplus.heavenlykey.org');
}
console.log('PASS account registry uniqueness, secure origins and Account 10 domain');
