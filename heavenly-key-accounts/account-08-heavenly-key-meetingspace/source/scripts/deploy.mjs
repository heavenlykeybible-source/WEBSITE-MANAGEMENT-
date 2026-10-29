// Deploy the existing MeetingSpace Worker without migrating or replacing its database.
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync} from 'node:fs';
const target=process.env.MEETINGSPACE_TARGET_ACCOUNT || '8';
if(target!=='8') throw Error('MeetingSpace deploys only Account 8; Account 7 is Heavenly Key Radio');
const worker='heavenly-key-meetingspace';
const origin=process.env.MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN;
if(!origin || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(origin)) throw Error('Set MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN to the confirmed HTTPS URL for Account 8');
const privatePreview=process.env.MEETINGSPACE_PRIVATE_PREVIEW==='1';
if(privatePreview && process.env.MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN &&
  /^(?:https:\/\/)?(?:(?:meeting|meetingspace)\.heavenlykey\.org|heavenly-key-meetingspace\.[^/]+\.workers\.dev)\/?$/i.test(process.env.MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN))
  throw Error('Private preview cannot target a known public production hostname');
// Every deployment targets the same existing Worker; preview mode must not bypass approval.
// Require explicit owner approval and passing tests even for private preview uploads.
{
  if(process.env.MEETINGSPACE_PRODUCTION_APPROVED!=='1')
    throw Error('Production deployment blocked: Control Room approval required (MEETINGSPACE_PRODUCTION_APPROVED=1)');
  if(!/^[a-f0-9]{40}$/i.test(process.env.MEETINGSPACE_APPROVED_COMMIT||''))
    throw Error('Production deployment blocked: approved Git commit SHA required');
  const latest=spawnSync('git',['ls-remote','--heads','origin','main'],{encoding:'utf8',shell:false,timeout:20000});
  const remoteSha=latest.stdout?.trim().split(/\s+/)[0];
  if(latest.status!==0||!/^[a-f0-9]{40}$/i.test(remoteSha)||remoteSha!==process.env.MEETINGSPACE_APPROVED_COMMIT)
    throw Error('Production deployment blocked: approved release is not latest main commit');
  const actual=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',shell:false});
  if(actual.status!==0||actual.stdout.trim()!==process.env.MEETINGSPACE_APPROVED_COMMIT)
    throw Error('Production deployment blocked: checked-out commit differs from approved commit');
  const testFiles=readdirSync('tests').filter(name=>name.endsWith('.test.mjs')).sort().map(name=>'tests/'+name);
  if(!testFiles.length)throw Error('Production deployment blocked: no regression tests found');
  const checks=spawnSync(process.execPath,['--test',...testFiles],{stdio:'inherit',shell:false});
  if(checks.error||checks.status!==0)throw Error('Production deployment blocked: regression tests failed');
}
const expectedHealth={ok:true,meetingConfigured:true,...(privatePreview?{}:{turnConfigured:true})};
const releaseEnv={...process.env,RELEASE_WORKER:worker,RELEASE_ORIGIN:origin,RELEASE_HEALTH_PATH:'/api/health',RELEASE_HEALTH_EXPECT:JSON.stringify(expectedHealth),RELEASE_SMOKE_PATHS:'/index.html,/join.html'};
// The currently deployed private preview may not yet have TURN; only the *new* public release must.
const snapshotEnv={...releaseEnv,RELEASE_HEALTH_EXPECT:JSON.stringify({ok:true,meetingConfigured:true})};
function run(args,env=process.env){const r=spawnSync(args[0],args.slice(1),{stdio:'inherit',shell:false,env});if(r.error)throw r.error;if(r.status!==0)throw Error('Existing MeetingSpace release stopped at '+args[1]+' (exit '+r.status+')');}
// This script always uploads the existing Worker, including for preview mode.
// Never bypass mandatory public legal checks through a preview environment flag.
run([process.execPath,'scripts/legal-preflight.mjs']);
run([process.execPath,'scripts/bundle-control-room.mjs']);
const built=readFileSync(new URL('../build/meeting-worker.mjs',import.meta.url),'utf8');
const releaseMatch=built.match(/^const MEETING_RELEASE_ID=("[a-f0-9]{20}");/);
if(!releaseMatch)throw Error('MeetingSpace build identity missing: refusing unverified release');
releaseEnv.RELEASE_HEALTH_EXPECT=JSON.stringify({...expectedHealth,releaseId:JSON.parse(releaseMatch[1])});
run([process.execPath,'scripts/configure.mjs']);
run([process.execPath,'scripts/verify-deployment-identity.mjs']);
run([process.execPath,'../../../scripts/existing-worker-release.mjs','snapshot'],snapshotEnv);
let deployError;
try {
  const remote=spawnSync('git',['ls-remote','--heads','origin','main'],{encoding:'utf8',shell:false,timeout:20000});
  const newest=remote.stdout?.trim().split(/\s+/)[0];
  if(remote.status!==0||newest!==process.env.MEETINGSPACE_APPROVED_COMMIT)
    throw Error('Account 8 release cancelled: newer main revision appeared during preparation');
  run(['npx','--yes','wrangler@4','deploy','--config','wrangler.generated.json','--keep-vars']);
}
catch(error) { deployError=error; }
let verifyError;
try { run([process.execPath,'../../../scripts/existing-worker-release.mjs','verify'],releaseEnv); }
catch(error) { verifyError=error; }
if(deployError){if(verifyError)console.error('Post-deployment verification also failed:',verifyError);throw deployError;}
if(verifyError)throw verifyError;
