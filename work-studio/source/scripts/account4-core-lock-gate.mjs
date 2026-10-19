import {existsSync,readFileSync} from 'node:fs';

const required=[
 'ACCOUNT4-CORE-LOCKS.md',
 'recovery-control/src/index.ts',
 'recovery-control/src/local-auth.ts',
 'recovery-control/src/package-intake.ts',
 'recovery-control/src/agent-bridge.ts',
 'recovery-control/src/assistant-spec.ts',
 'recovery-control/migrations/0001_recovery_control.sql',
 'recovery-control/migrations/0002_direct_upload.sql',
 'recovery-control/migrations/0003_security_quota.sql',
 '.github/workflows/account4-review-stage.yml',
 '.github/workflows/account4-stage-all.yml',
 '.github/workflows/account4-direct-upload-review.yml'
];
const issues=[];
for(const path of required)if(!existsSync(path))issues.push('Missing protected Account 4 component: '+path);
const read=p=>existsSync(p)?readFileSync(p,'utf8'):'';
const intake=read('recovery-control/src/package-intake.ts');
for(const marker of ['protectedCandidatePath','quarantined','account4-security-state'.replaceAll('-','_')]){
 if(!intake.includes(marker))issues.push('Package intake lost required security marker: '+marker);
}
for(const forbidden of [/targetAccounts:\s*\[[^\]]*['"]4['"]/i,/account:\{type:['"]string['"],enum:\[[^\]]*['"]4['"]/i]){
 if(forbidden.test(read('recovery-control/src/agent-bridge.ts'))||forbidden.test(read('recovery-control/src/assistant-spec.ts')))
  issues.push('AI gateway must never expose Account 4 as a candidate target.');
}
const auto=read('.github/workflows/account4-auto-updates.yml');
if(/\n\s*push\s*:/m.test(auto))issues.push('Account 4 core workflow must not trigger from normal push events.');
if(!/workflow_dispatch\s*:/m.test(auto))issues.push('Account 4 core maintenance must remain explicit/manual.');
if(issues.length){
 console.error('ACCOUNT 4 CORE LOCK GATE FAILED');
 for(const issue of issues)console.error('- '+issue);
 process.exit(1);
}
console.log('ACCOUNT 4 CORE LOCK GATE PASSED — protected control plane and AI boundary retained.');
