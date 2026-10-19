/* Configure a stable private local-admin password for Account 4.
 * Password is derived from a GitHub Actions secret, never committed or logged.
 * The credential handoff is a one-day private Actions artifact (repository members only). */
import {createHmac,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
const seed=process.env.LOGIN_SEED;
if(!seed||seed.length<20||!process.env.GITHUB_WORKSPACE)throw Error('Missing HKEM_CONTROL_TOKEN or GitHub workspace');
const password=createHmac('sha256',seed).update('hkem-account4-local-owner-login-v1').digest('base64url').slice(0,28);
const digest=createHash('sha256').update(password).digest('hex');
const result=spawnSync('npx',['--yes','wrangler@4.145.0','secret','put','CONTROL_PASSWORD_HASH','--config','wrangler.deploy.toml'],{
 cwd:process.cwd(),env:process.env,input:digest+'\n',encoding:'utf8',maxBuffer:1048576
});
if(result.status!==0)throw Error('Could not install admin password hash in Account 4 Worker');
const path=join(process.env.GITHUB_WORKSPACE,'Account4-Administrator-Login.txt');
writeFileSync(path,
'HEAVENLY KEY WEBSITE UPDATE CENTRE\n'+
'Administrator username: admin\n'+
'Administrator password: '+password+'\n'+
'Login website: https://heavenlykey-recovery-control.emmanuel2026miracle.workers.dev/\n'+
'\nKeep this password private. This file is delivered through a private GitHub Actions artifact and is NOT committed to your repository.\n',
{mode:0o600});
console.log('Administrator login password hash installed securely in Cloudflare Account 4.');
console.log('Private login handoff file generated in GitHub workspace (password not printed).');
