import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const checklist = readFileSync(resolve(root, 'DEPLOYMENT-VERIFICATION.md'), 'utf8');
const wrangler = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');
const migrations = ['0002_webhook_events.sql','0003_conversation_lookup.sql','0004_whatsapp_delivery.sql','0005_whatsapp_receipts.sql','0006_whatsapp_receipt_inbox.sql','0007_post_media.sql'];

test('Every production migration is checked into source', () => {
  for (const migration of migrations) {
    assert.ok(existsSync(resolve(root, 'migrations', migration)), migration + ' missing');
  }
});

test('Migration scripts and release checklist include every migration in sequence', () => {
  for (const scriptName of ['db:migrate:local','db:migrate:remote']) {
    const script = packageJson.scripts[scriptName] || '';
    let prior = -1;
    for (const migration of migrations) {
      const index = script.indexOf(migration);
      assert.ok(index > prior, scriptName + ': missing or out-of-order ' + migration);
      prior = index;
    }
  }
  for (const migration of migrations) assert.ok(checklist.includes(migration), 'checklist omits ' + migration);
});

test('Cloudflare config binds the expected database and assets', () => {
  assert.match(wrangler, /binding\s*=\s*"DB"/);
  assert.match(wrangler, /binding\s*=\s*"ASSETS"/);
  assert.match(wrangler, /directory\s*=\s*"\.\/public"/);
});

test('Local verification includes release and security contract tests', () => {
  assert.match(packageJson.scripts['verify:local'], /test:security/);
  assert.match(packageJson.scripts['verify:local'], /test:release/);
});
