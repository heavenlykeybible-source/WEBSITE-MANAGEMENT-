import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../.github/workflows/',import.meta.url);
const meeting=fs.readFileSync(new URL('zoom-studio.yml',base),'utf8');
const account5=['check-account5-app.yml','test-account5-downloads.yml'].map(n=>fs.readFileSync(new URL(n,base),'utf8'));
const eventSection=meeting.slice(meeting.indexOf('\non:'),meeting.indexOf('\npermissions:'));
assert.ok(!eventSection.includes("'tests/**'"),'Account 8 must not rebuild on every unrelated test update');
assert.ok(!eventSection.includes("'control-room-worker.js'"),'Account 8 must not rebuild on unrelated Account 4 Worker updates');
assert.ok(eventSection.includes("account-08-heavenly-key-meetingspace/source/**"),'Keep Account 8 source checks');
assert.ok(eventSection.includes("'scripts/existing-worker-release.mjs'"),'Keep shared release script checks');
assert.ok(meeting.includes("if: github.event_name == 'workflow_dispatch' && inputs.deploy && github.ref == 'refs/heads/main'"),'Deployment must require explicit manual approval on main');
assert.ok(meeting.includes("environment: account8-meetingspace-production"),'Protected GitHub environment must be preserved');
assert.ok(meeting.includes("test \"$APPROVED_COMMIT\" = \"$(git rev-parse HEAD)\""),'Deploy must verify exact approved commit');
for(const a of account5){assert.ok(/wrangler deploy --dry-run/.test(a),'Account 5 validations must dry-run, not publish');assert.ok(!/run:\s*npm run deploy\s*$/m.test(a),'Account 5 PR checks must not deploy');}
console.log('PASS Account 8 manual-only deployment gate and scoped triggers');
console.log('PASS Account 5 PR workflows remain non-deploying dry-runs');
