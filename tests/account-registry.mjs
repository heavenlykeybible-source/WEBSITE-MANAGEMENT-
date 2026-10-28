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

// An agent must be able to locate Account 8 without guessing another repository.
const meetings = registry.accounts.find(account => account.account === 8);
assert.equal(meetings.name, 'Heavenly Key MeetingSpace');
for (const field of ['website', 'ai_target_url', 'page_url']) {
  assert.equal(meetings[field], 'https://meeting.heavenlykey.org');
}
assert.equal(meetings.worker, 'heavenly-key-meetingspace');
assert.ok(fs.existsSync(meetings.folder + '/README.md'));
for (const file of ['package.json', 'site/index.html', 'site/join.html', 'site/_worker.js']) {
  assert.ok(fs.existsSync(meetings.source + '/' + file), 'Missing MeetingSpace source: ' + file);
}
assert.ok(fs.existsSync(meetings.deployment_workflow));
const manifest = JSON.parse(fs.readFileSync('heavenly-key-accounts/ACCOUNT-MANIFEST.json', 'utf8'));
const meetingEntry = manifest.accounts.find(account => account.account === 8);
assert.equal('heavenly-key-accounts/' + meetingEntry.folder, meetings.folder);
assert.equal(meetingEntry.currentSource, meetings.source);
assert.equal(meetingEntry.worker, meetings.worker);
assert.equal(meetingEntry.deploymentWorkflow, meetings.deployment_workflow);
assert.notEqual(meetingEntry.status, 'not-identified');
console.log('PASS Account 8 source, account directory and deployment links resolve consistently');

assert.equal(meetings.source, meetings.folder + '/source');
assert.ok(!fs.existsSync('zoom-studio/package.json'), 'Do not keep a second deployable MeetingSpace copy at the old location');
const scripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
assert.ok(scripts['test:meetings'].endsWith(meetings.source));
assert.ok(scripts['build:meetings'].endsWith(meetings.source));
const workflow = fs.readFileSync(meetings.deployment_workflow, 'utf8');
assert.ok(workflow.includes('working-directory: ' + meetings.source));
assert.ok(workflow.includes("MEETINGSPACE_PRIVATE_PREVIEW: '0'"), 'Public hostname must use public release mode');
assert.ok(workflow.includes('MEETINGSPACE_APPROVED_COMMIT: ${{ inputs.approved_commit }}'), 'Deployment must use exact approval input');
