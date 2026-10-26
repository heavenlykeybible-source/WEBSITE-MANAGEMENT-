// Deploy the existing MeetingSpace Worker without migrating or replacing its database.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const target=process.env.MEETINGSPACE_TARGET_ACCOUNT || '8';
if(target!=='8') throw Error('MeetingSpace deploys only Account 8; Account 7 is Heavenly Key Radio');
const worker='heavenly-key-meetingspace';
const origin=process.env.MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN;
if(!origin || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(origin)) throw Error('Set MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN to the confirmed HTTPS URL for Account 8');
const privatePreview=process.env.MEETINGSPACE_PRIVATE_PREVIEW==='1';
const expectedHealth={ok:true,meetingConfigured:true,...(privatePreview?{}:{turnConfigured:true})};
const releaseEnv={...process.env,RELEASE_WORKER:worker,RELEASE_ORIGIN:origin,RELEASE_HEALTH_PATH:'/api/health',RELEASE_HEALTH_EXPECT:JSON.stringify(expectedHealth),RELEASE_SMOKE_PATHS:'/index.html,/join.html'};
// The currently deployed private preview may not yet have TURN; only the *new* public release must.
const snapshotEnv={...releaseEnv,RELEASE_HEALTH_EXPECT:JSON.stringify({ok:true,meetingConfigured:true})};
function run(args,env=process.env){const r=spawnSync(args[0],args.slice(1),{stdio:'inherit',shell:false,env});if(r.error)throw r.error;if(r.status!==0)throw Error('Existing MeetingSpace release stopped at '+args[1]+' (exit '+r.status+')');}
if(process.env.MEETINGSPACE_PRIVATE_PREVIEW!=='1') run([process.execPath,'scripts/legal-preflight.mjs']);
else console.log('Private preview only: legal publication gate deferred; public signup disabled in Worker');
run([process.execPath,'scripts/bundle-control-room.mjs']);
const built=readFileSync(new URL('../build/meeting-worker.mjs',import.meta.url),'utf8');
const releaseMatch=built.match(/^const MEETING_RELEASE_ID=("[a-f0-9]{20}");/);
if(!releaseMatch)throw Error('MeetingSpace build identity missing: refusing unverified release');
releaseEnv.RELEASE_HEALTH_EXPECT=JSON.stringify({...expectedHealth,releaseId:JSON.parse(releaseMatch[1])});
run([process.execPath,'scripts/configure.mjs']);
run([process.execPath,'scripts/verify-deployment-identity.mjs']);
run([process.execPath,'../scripts/existing-worker-release.mjs','snapshot'],snapshotEnv);
let deployError;
try { run(['npx','--yes','wrangler@4','deploy','--config','wrangler.generated.json','--keep-vars']); }
catch(error) { deployError=error; }
let verifyError;
try { run([process.execPath,'../scripts/existing-worker-release.mjs','verify'],releaseEnv); }
catch(error) { verifyError=error; }
if(deployError){if(verifyError)console.error('Post-deployment verification also failed:',verifyError);throw deployError;}
if(verifyError)throw verifyError;
