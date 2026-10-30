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
console.log('PASS: Account 4 manual deployment and stale-source regression guards are present.');
