// Read-only verification. Never print tokens or replace saved bindings.
import fs from 'node:fs';
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Set CLOUDFLARE_RADIO_API_TOKEN and CLOUDFLARE_RADIO_ACCOUNT_ID in GitHub Actions secrets for Account 7.');
const headers={Authorization:'Bearer '+token};
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/pages/projects/heavenly-key-radio`,{headers,signal:AbortSignal.timeout(15000)});
const data=await response.json();
if(!response.ok||!data.success)throw Error('Account 7 Pages access failed. Check the account ID and grant this token Account / Cloudflare Pages / Edit for Account 7. Cloudflare error: '+(data.errors?.map(x=>x.code).join(',')||response.status));
const config=data.result?.deployment_configs?.production?.env_vars||{};
const origin=config.MEDIA_PUBLIC_ORIGIN?.value;
if(!origin||!config.RADIO_PUBLIC_API_KEY)throw Error('Set MEDIA_PUBLIC_ORIGIN to the verified Account 2 Media Engine origin, and RADIO_PUBLIC_API_KEY as a production secret in the Account 7 Pages project. The same key must be configured in Account 2.');
const url=new URL(origin);
if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw Error('MEDIA_PUBLIC_ORIGIN must be the exact HTTPS origin for Account 2.');
const health=await fetch(new URL('/health',url),{signal:AbortSignal.timeout(15000),redirect:'error'});
if(!health.ok||(await health.json()).service!=='heavenlykey-media-engine')throw Error('The configured Account 2 Media Engine is unreachable or is not the broadcast source.');
// Pages uses Wrangler vars as the source of truth; preserve the verified origin.
const configPath=new URL('../source/wrangler.toml',import.meta.url);
fs.appendFileSync(configPath,'\n[vars]\nMEDIA_PUBLIC_ORIGIN = '+JSON.stringify(url.origin)+'\n');
// Cloudflare does not return secret values. Verify authenticated programme access after deploy.
console.log('Account 7 Pages access, production binding names and Account 2 health verified.');
