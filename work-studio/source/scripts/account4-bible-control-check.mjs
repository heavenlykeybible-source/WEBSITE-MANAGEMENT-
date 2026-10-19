import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const policy=JSON.parse(read('bible/deployment-policy.json'));
const wrangler=read('bible/wrangler.toml');
const quality=read('.github/workflows/bible-quality.yml');

if(policy.product!=='HEAVENLY KEY BIBLE') throw Error('Wrong Bible product identity.');
if(policy.worker!=='heavenly-key-bible') throw Error('Wrong Bible Worker identity.');
if(policy.releaseMode!=='account4-controlled') throw Error('Bible releases are not assigned to Account 4 control.');
if(policy.autoUpdate!==true || policy.autoUpdateBranch!=='main') throw Error('Bible auto-update policy is not enabled for main.');
if(!policy.watchedPaths.includes('bible/**') || !policy.watchedPaths.includes('heavenly-key-website/bible/**')) throw Error('Bible auto-update paths are incomplete.');
if(policy.requirements.dedicatedCloudflareToken!=='BIBLE_CLOUDFLARE_API_TOKEN') throw Error('Dedicated Bible token contract is missing.');
if(policy.requirements.dedicatedCloudflareAccountId!=='BIBLE_CLOUDFLARE_ACCOUNT_ID') throw Error('Dedicated Bible account contract is missing.');
if(!wrangler.includes('name = "heavenly-key-bible"')) throw Error('Dedicated Bible Worker configuration is missing.');
for(const marker of ['bible/**','heavenly-key-website/bible/**','workflow_dispatch']) if(!quality.includes(marker)) throw Error('Bible quality automation missing: '+marker);

console.log('PASS: Account 4 Bible deployment/auto-update contract is present, isolated and quality-gated.');
console.log('Activation still requires the dedicated Bible Cloudflare credentials and live URL in the protected deployment environment.');
