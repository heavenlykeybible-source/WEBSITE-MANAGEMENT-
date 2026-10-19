/** First-install runtime configuration. Values stay in the runner and Cloudflare secret storage. */
import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
const media=process.argv.includes('--media');
function wrangler(args,input){const r=spawnSync('npx',['--yes','wrangler@4.145.0',...args],{cwd:media?'media-engine':process.cwd(),env:process.env,input,encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)throw new Error('Cloudflare configuration command failed: '+args[0]+' '+args[1]);return r.stdout;}
const names=new Set(JSON.parse(wrangler(['secret','list','--format','json']).trim()).map(x=>x.name));
const values={};
// Never regenerate Account 1 security secrets during an existing site deployment.
// Changing PASSWORD_PEPPER makes every existing member/admin password unverifiable.
// Changing ENCRYPTION_KEY can make previously stored confidential data unreadable.
if(!media){
 const required=['PASSWORD_PEPPER','ENCRYPTION_KEY','SESSION_SECRET'];
 const missing=required.filter(name=>!names.has(name));
 if(missing.length)throw new Error('ACCOUNT 1 DEPLOYMENT STOPPED: existing critical secrets are missing ('+missing.join(', ')+'). Recover the original values securely; do not regenerate them during updates.');
}
// Shared media connectivity is optional during an Account 1 deployment. Never make
// Account 1 availability depend on an Account 2 credential. Account 2 can still
// configure its own copy when MEDIA_LINK_SEED is explicitly supplied.
if(media && !names.has('MEDIA_ENGINE_SHARED_SECRET') && process.env.MEDIA_LINK_SEED){
 values.MEDIA_ENGINE_SHARED_SECRET=createHmac('sha256',process.env.MEDIA_LINK_SEED).update('heavenlykey-core-media-connection-v1').digest('hex');
}else if(!names.has('MEDIA_ENGINE_SHARED_SECRET')){
 console.log('MEDIA_ENGINE_SHARED_SECRET is not configured here; preserving existing account runtime without cross-account changes.');
}
for(const [name,value] of Object.entries(values)){console.log('::add-mask::'+value);wrangler(['secret','put',name],value+'\n');console.log('Configured '+name);}
console.log('Account 1 security secrets verified and preserved; no automatic credential rotation.');
