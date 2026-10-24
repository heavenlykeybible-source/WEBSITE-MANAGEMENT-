// Read-only release gate. Never log the token, account ID, or API response body.
const token=process.env.CLOUDFLARE_API_TOKEN,account=process.env.CLOUDFLARE_ACCOUNT_ID;
if(!token||!/^[a-f0-9]{32}$/.test(account||''))throw Error('Set valid ACCOUNT9_CF_API_TOKEN and ACCOUNT9_CF_ACCOUNT_ID secrets in account9-staging.');
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/pages/projects/heavenlykey-studio',{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(20000)});
const data=await response.json().catch(()=>null);
if(!response.ok||data?.success!==true){
 const code=data?.errors?.[0]?.code;
 throw Error('Account 9 Pages access denied (HTTP '+response.status+(Number.isInteger(code)?', code '+code:'')+'). Update ACCOUNT9_CF_API_TOKEN with Cloudflare Pages Edit access scoped to Account 9. Confirm ACCOUNT9_CF_ACCOUNT_ID and existing heavenlykey-studio project. No deployment was attempted.');
}
if(data.result?.name!=='heavenlykey-studio')throw Error('Unexpected Pages project. No deployment was attempted.');
console.log('Existing Account 9 Pages project is readable. Deployment still requires Pages Edit access.');
