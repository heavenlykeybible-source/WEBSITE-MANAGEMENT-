// Run from zoom-studio/. Requires Cloudflare sign-in or CI deployment credentials.
// Deployment never provisions/reset accounts or changes secrets.
import {spawnSync} from 'node:child_process';
const run=args=>{const r=spawnSync(args[0],args.slice(1),{stdio:'inherit',shell:false});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status||1)};
run([process.execPath,'scripts/configure.mjs']);
run(['npx','--yes','wrangler@4','d1','migrations','apply','heavenly-key-zoom-studio-db','--remote','--config','wrangler.generated.json']);
run(['npx','--yes','wrangler@4','deploy','--config','wrangler.generated.json']);
