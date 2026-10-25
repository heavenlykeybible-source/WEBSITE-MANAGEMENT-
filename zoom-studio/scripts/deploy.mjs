// Deploy the existing MeetingSpace Worker without migrating or replacing its database.
import {spawnSync} from 'node:child_process';
const target=process.env.MEETINGSPACE_TARGET_ACCOUNT || '8';
if(target!=='8') throw Error('MeetingSpace deploys only Account 8; Account 7 is Heavenly Key Radio');
const worker='heavenly-key-meetingspace';
const origin=process.env.MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN;
if(!origin || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(origin)) throw Error('Set MEETINGSPACE_ACCOUNT8_RELEASE_ORIGIN to the confirmed HTTPS URL for Account 8');
const releaseEnv={...process.env,RELEASE_WORKER:worker,RELEASE_ORIGIN:origin};
function run(args,env=process.env){const r=spawnSync(args[0],args.slice(1),{stdio:'inherit',shell:false,env});if(r.error)throw r.error;if(r.status!==0)throw Error('Existing MeetingSpace release stopped at '+args[1]+' (exit '+r.status+')');}
run([process.execPath,'scripts/configure.mjs']);
run([process.execPath,'../scripts/existing-worker-release.mjs','snapshot'],releaseEnv);
let deployError;
try { run(['npx','--yes','wrangler@4','deploy','--config','wrangler.generated.json','--keep-vars']); }
catch(error) { deployError=error; }
let verifyError;
try { run([process.execPath,'../scripts/existing-worker-release.mjs','verify'],releaseEnv); }
catch(error) { verifyError=error; }
if(deployError){if(verifyError)console.error('Post-deployment verification also failed:',verifyError);throw deployError;}
if(verifyError)throw verifyError;
