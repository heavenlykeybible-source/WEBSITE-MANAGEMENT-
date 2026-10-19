import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const text=readFileSync('.github/workflows/cloudflare-recovery-control.yml','utf8');
describe('Account 4 owner-only deployment boundary',()=>{
 it('must not automatically deploy control-plane changes on push',()=>{
  const trigger=text.split('permissions:')[0];
  expect(trigger).toContain('workflow_dispatch:');
  expect(trigger).not.toMatch(/^  push:/m);
  expect(trigger).toContain('confirm_owner_release:');
  expect(trigger).toContain('required: true');
 });
 it('requires exact owner, protected branch, and deliberate release confirmation',()=>{
  expect(text).toContain("github.ref == 'refs/heads/main'");
  expect(text).toContain("github.actor == 'aoemeta247-cell'");
  expect(text).toContain("inputs.confirm_owner_release == 'RELEASE_ACCOUNT4'");
  expect(text).toContain('environment: account4-owner-approval');
 });
 it('still blocks database substitution, password resets and unverified binaries',()=>{
  expect(text).toContain('ACCOUNT4_PROTECTED_D1_ID');
  expect(text).toContain('Account 4 existing D1 database identity changed');
  expect(text).toContain('scripts/account4-permanence-gate.mjs');
  expect(text).toContain('scripts/protected-state-gate.mjs');
  expect(text).toContain('Check previously configured persistent login secrets');
  expect(text).not.toMatch(/wrangler.*d1\s+(create|delete)/);
 });
});
