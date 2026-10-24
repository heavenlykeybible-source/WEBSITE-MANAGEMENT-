// Update only the existing MeetingSpace Worker. Database migrations are a separate maintenance action.
import {spawnSync} from 'node:child_process';
const releaseEnv={...process.env,RELEASE_WORKER:'heavenly-key-zoom-studio',RELEASE_ORIGIN:'https://meeting.heavenlykey.org/'};
function run(args,env=process.env){const r=spawnSync(args[0],args.slice(1),{stdio:'inherit',shell:false,env});if(r.error)throw r.error;if(r.status!==0)throw Error('Existing MeetingSpace release stopped; inspect the failed step');}
run([process.execPath,'scripts/configure.mjs']);
run([process.execPath,'../scripts/existing-worker-release.mjs','snapshot'],releaseEnv);
try{run(['npx','--yes','wrangler@4','deploy','--config','wrangler.generated.json','--keep-vars']);}
finally{run([process.execPath,'../scripts/existing-worker-release.mjs','verify'],releaseEnv);}
