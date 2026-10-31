import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8');
const deployer = readFileSync('scripts/deploy-account4-existing.mjs', 'utf8');

function mustContain(source, fragment, label) {
  assert.ok(source.includes(fragment), 'Release safety regression: ' + label);
}

mustContain(workflow, 'workflow_dispatch:', 'deployment must be manual');
mustContain(workflow, 'environment: account-4', 'production environment approval');
mustContain(workflow, 'approved_commit:', 'explicit commit approval input');
mustContain(workflow, 'test "$APPROVED_COMMIT" = "$(git rev-parse HEAD)"', 'checkout must match approval');
mustContain(workflow, 'test "$APPROVED_COMMIT" = "$(git rev-parse origin/main)"', 'stale commit guard');
mustContain(workflow, 'cancel-in-progress: false', 'do not silently cancel release checks');
mustContain(deployer, "ACCOUNT4_PRODUCTION_APPROVED !== '1'", 'direct upload approval guard');
mustContain(deployer, "latest !== approved", 'direct upload latest main check');
mustContain(deployer, "finalSha !== approved", 'pre-upload latest main recheck');
mustContain(deployer, "const after = await api(base + '/settings')", 'verify bindings after upload');
mustContain(deployer, "signature(bindings) !== signature(after.bindings || [])", 'preserve existing resource bindings');
mustContain(workflow, 'git diff --exit-code HEAD -- control-room-worker.js', 'built Worker must match approved commit');
mustContain(workflow, 'git ls-files --error-unmatch control-room-worker.js', 'Worker must be tracked');
mustContain(deployer, "['diff', '--exit-code', 'HEAD', '--', 'control-room-worker.js']", 'direct upload must reject mutated Worker');
mustContain(deployer, "['ls-files', '--error-unmatch', 'control-room-worker.js']", 'direct upload must reject untracked Worker');
mustContain(workflow, 'npm ci --no-audit --no-fund', 'production dependencies must use lockfile');
assert.ok(!workflow.includes('run: npm install --no-audit --no-fund'), 'Unsafe unlocked production install');
const acceptance = readFileSync('.github/workflows/account4-release-safety.yml', 'utf8');
for (const [command, label] of [
  ['npm ci --no-audit --no-fund', 'locked acceptance dependencies'],
  ['node tests/native-imports.mjs', 'native import acceptance'],
  ['node tests/native-imports-browser.mjs', 'interactive mobile site preview acceptance'],
  ['node tests/account4-permission-ui.mjs', 'owner approval interface acceptance'],
  ['node tests/account4-studio-menu.mjs', 'owner Studio navigation acceptance'],
  ['node tests/account4-release-safety-regression.mjs', 'release safety self-check']
]) mustContain(acceptance, command, label);
for (const [command, label] of [
  ['node tests/domains.mjs', 'Cloudflare zone and account isolation'],
  ['node tests/ai-workspace.mjs', 'owner-only AI access requests'],
  ['node tests/browser-agent.mjs', 'browser agent permissions and private sessions'],
  ['node tests/account4-unified-access.mjs', 'external MCP and unified access boundaries'],
  ['node tests/owner-passkeys.mjs', 'owner passkey authentication'],
  ['npm run test:cms-dom', 'CMS document safety and editing'],
  ['npm run test:cms-browser', 'CMS visual browser verification']
]) mustContain(acceptance, command, label);
for (const [file, label] of [
  ["'cms/editor.js'", 'visual editor changes'],
  ["'cms/frame.js'", 'CMS iframe changes'],
  ["'browser-agent/**'", 'browser agent changes'],
  ["'tests/account4-unified-access.mjs'", 'unified access test changes'],
  ["'tests/owner-passkeys.mjs'", 'passkey test changes']
]) mustContain(acceptance, file, 'acceptance trigger: ' + label);
assert.ok(!acceptance.includes('CLOUDFLARE_API_TOKEN:'), 'Unapproved acceptance tests must not consume production Cloudflare credentials');
console.log('PASS: Account 4 manual deployment and stale-source regression guards are present.');
