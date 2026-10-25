// Read-only access check. Never print token values or replace saved bindings.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!account)throw Error('Set CLOUDFLARE_RADIO_API_TOKEN and CLOUDFLARE_RADIO_ACCOUNT_ID in GitHub Actions secrets for Account 8.');
// Match the physical Workers namespace before any deployment, regardless of legacy folder labels.
const namespaceResponse=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/subdomain`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
const namespace=await namespaceResponse.json();
if(!namespaceResponse.ok||!namespace.success||namespace.result?.subdomain!=='heavenlykeyradio')throw Error('Radio account identity could not be verified: expected heavenlykeyradio.workers.dev. No deployment permitted.');
console.log('Physical Radio account verified: heavenlykeyradio.workers.dev (Account 8).');
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/workers/scripts/heavenlykeyradio/settings`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
const data=await response.json();
if(!response.ok||!data.success)throw Error('Cannot access the existing Account 8 Worker heavenlykeyradio. Check the account ID and Workers Scripts Edit permission. Cloudflare error: '+(data.errors?.map(x=>x.code).join(',')||response.status));
const bindings=data.result?.bindings||[];
if(bindings.some(b=>!['plain_text','json','secret_text','secret_key'].includes(b.type)&&b.name!=='ASSETS'))throw Error('Existing resource bindings need to be included in the deployment config. Refusing to remove them.');
const origin=bindings.find(b=>b.name==='MEDIA_PUBLIC_ORIGIN')?.text;
const key=bindings.some(b=>b.name==='RADIO_PUBLIC_API_KEY');
console.log('Existing Account 8 Worker access verified. Variables and secrets will be retained.');
if(!origin||!key)console.log('::warning::Radio audio connection is incomplete: Account 8 needs MEDIA_PUBLIC_ORIGIN and RADIO_PUBLIC_API_KEY matching Account 2. This deployment installs the listener application only.');
