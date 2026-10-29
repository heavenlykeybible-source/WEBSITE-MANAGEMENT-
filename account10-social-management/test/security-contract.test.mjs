import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

test('Meta webhooks require a signed request before storage', () => {
  assert.match(source, /x-hub-signature-256/);
  assert.match(source, /crypto\.subtle\.sign/);
  assert.match(source, /mismatch!==0/);
  assert.match(source, /INSERT OR IGNORE INTO webhook_events/);
});
test('Admin endpoints require configured authentication', () => {
  assert.match(source, /if\(!env\.ADMIN_TOKEN\)/);
  assert.match(source, /Unauthorized/);
});
test('Worker configuration does not contain literal authentication secrets', () => {
  assert.doesNotMatch(config, /^\s*(ADMIN_TOKEN|META_APP_SECRET|META_WHATSAPP_ACCESS_TOKEN)\s*=/m);
});
test('Public health response does not claim readiness', () => {
  assert.match(source, /status:'setup_required'/);
});
