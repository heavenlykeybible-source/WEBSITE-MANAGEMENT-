import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const checklist = readFileSync(resolve(root, 'DEPLOYMENT-VERIFICATION.md'), 'utf8');
const wrangler = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');
const migrations = ['0002_webhook_events.sql','0003_conversation_lookup.sql','0004_whatsapp_delivery.sql','0005_whatsapp_receipts.sql','0006_whatsapp_receipt_inbox.sql','0007_post_media.sql','0008_ai_rate_limits.sql','0009_human_contact_target.sql','0010_whatsapp_handover_dedupe.sql','0011_human_request_version.sql','0012_operator_credentials.sql','0013_auth_rate_limits.sql'];

test('Every production migration is checked into source', () => {
  for (const migration of migrations) {
    assert.ok(existsSync(resolve(root, 'migrations', migration)), migration + ' missing');
  }
});

test('Migration inventory is documented but bulk remote execution is deliberately disabled', () => {
  for (const migration of migrations) assert.ok(checklist.includes(migration), 'checklist omits ' + migration);
  assert.equal(packageJson.scripts['db:migrate:remote'], undefined);
  assert.equal(packageJson.scripts['db:init:remote'], undefined);
  assert.equal(packageJson.scripts['db:migrate:local'], undefined);
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

test('SocialPlus custom domain is declared for approved Worker deployments', () => {
  assert.match(wrangler, /\[\[routes\]\]\s*pattern\s*=\s*"socialplus\.heavenlykey\.org"\s*custom_domain\s*=\s*true/);
});

test('Account 10 GitHub workflow performs only verification, never deployment', () => {
  const workflowPath=resolve(root, '..', '.github', 'workflows', 'account10-verify.yml');
  assert.ok(existsSync(workflowPath), 'verification workflow missing');
  const workflow=readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.match(workflow, /npm run verify:local/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /\bwrangler deploy\b|\bwrangler d1 execute\b|CLOUDFLARE_API_TOKEN|\bnpx wrangler deploy\b/);
});

test('preflight is mandatory, read-only, and never claims production readiness', () => {
 const preflightPath=resolve(root,'scripts','preflight.mjs');
 assert.ok(existsSync(preflightPath),'preflight script missing');
 const source=readFileSync(preflightPath,'utf8');
 assert.match(packageJson.scripts['verify:local'],/^npm run preflight &&/);
 assert.equal(packageJson.scripts.preflight,'node scripts/preflight.mjs');
 assert.match(source,/NOT proof of a live deployment/);
 assert.match(source,/Production readiness cannot be certified/);
 assert.doesNotMatch(source,/execSync|spawnSync|wrangler deploy|wrangler d1 execute/);
});

test('preflight validates the domain within one route block and every migration', () => {
 const source=readFileSync(resolve(root,'scripts','preflight.mjs'),'utf8');
 assert.match(source,/const routeBlocks=/);
 assert.match(source,/socialRoutes.length!==1/);
 assert.match(source,/custom_domain/);
 assert.match(source,/migrations.map\(name=>'migrations\/'\+name\)/);
 assert.match(source,/Unsafe bulk database command must remain disabled/);
 assert.match(source,/MIGRATION-SAFETY\.md/);
 assert.ok(existsSync(resolve(root,'MIGRATION-SAFETY.md')));
});

test('preflight refuses wrong Worker identity and missing dashboard module', () => {
 const source=readFileSync(resolve(root,'scripts','preflight.mjs'),'utf8');
 assert.match(source,/Expected Worker identity/);
 assert.match(source,/heavenly-key-social-management/);
 assert.match(source,/public\/editorial-studio\.js/);
 assert.match(source,/run_worker_first/);
 assert.ok(existsSync(resolve(root,'public','editorial-studio.js')));
});

test('preflight isolates assets section', () => {
 const script=readFileSync(resolve(root,'scripts','preflight.mjs'),'utf8');
 assert.ok(script.includes("const assetConfig="));
 assert.ok(script.includes('assetSections.length!==1'));
 assert.ok(script.includes('assetSections[0]?.[1]'));
 assert.ok(script.includes('Assets section must specify ./public directory'));
 assert.ok(script.includes('Assets section must declare ASSETS binding'));
});

test('preflight rejects duplicate critical asset keys', () => {
 const source=readFileSync(resolve(root,'scripts','preflight.mjs'),'utf8');
 assert.match(source,/matches\.length!==1/);
 assert.match(source,/Assets section must declare/);
});


test('Account 10 strict script CSP has a same-origin external dashboard bundle', () => {
 const html=readFileSync(resolve(root,'public','index.html'),'utf8');
 const worker=readFileSync(resolve(root,'src','index.ts'),'utf8');
 assert.ok(existsSync(resolve(root,'public','app.js')));
 assert.match(html,/<script src="\/app\.js" defer><\/script>/);
 assert.doesNotMatch(html,/<script\b(?![^>]*\bsrc=)[^>]*>/i);
 assert.match(worker,/script-src 'self'; script-src-attr 'none'/);
});


test('preflight syntax-checks the external dashboard bundle without executing it', () => {
 const preflight=readFileSync(resolve(root,'scripts','preflight.mjs'),'utf8');
 assert.match(preflight,/new Script\(read\('public\/app\.js'\)/);
 assert.match(preflight,/node:vm/);
});

test('D1 release instructions require schema inspection, backup and one-at-a-time migrations', () => {
 const safety=readFileSync(resolve(root,'MIGRATION-SAFETY.md'),'utf8');
 assert.match(safety,/Take and verify a D1 backup/);
 assert.match(safety,/PRAGMA table_info/);
 assert.match(safety,/one file at a time/);
 assert.match(safety,/Do not infer migration state/);
 assert.match(safety,/does not claim that any remote migration has been applied/);
});
