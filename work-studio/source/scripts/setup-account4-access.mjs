/* Owner-only Access bootstrap. Never bypasses authentication or alters live sites.
 * Only Account 4 Cloudflare account members may sign in. */
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN;
if(!account||!token)throw Error('Account 4 credentials missing.');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
async function call(path,method='GET',data){
 const response=await fetch(root+path,{method,headers,body:data?JSON.stringify(data):undefined});
 const json=await response.json();
 if(!response.ok||json.success!==true){
  console.error('Cloudflare Access',method,path,'HTTP',response.status,'error codes',(json.errors||[]).map(e=>e.code).join(','));
  return null;
 }
 return json.result;
}
const hostname='heavenlykey-recovery-control.emmanuel2026miracle.workers.dev';
const idps=await call('/access/identity_providers?per_page=100');
if(!idps){
 console.error('Cloudflare API token cannot inspect Access identity providers. Access Organizations / Identity Providers permission is required.');
 process.exit(2);
}
let cloudflareProvider=idps.find(p=>p.type==='cloudflare');
if(!cloudflareProvider){
 console.log('Creating Cloudflare account-member identity provider (no open/public login).');
 cloudflareProvider=await call('/access/identity_providers','POST',{name:'Cloudflare Account 4 Members',type:'cloudflare',config:{restrict_to_account_members:true}});
 if(!cloudflareProvider){
  console.error('Enable Zero Trust and Cloudflare account authentication in Account 4, then grant Access Organizations / Identity Providers permission to the existing API token.');
  process.exit(2);
 }
}
const existing=await call('/access/apps?per_page=100');
if(!existing){console.error('Access Apps / Policies permission is required.');process.exit(2);}
const match=existing.find(p=>p.domain===hostname||(p.destinations||[]).some(d=>d.uri===hostname));
if(match){
 console.log('Existing Access application found for Account 4 dashboard:',match.name,'audConfigured',Boolean(match.aud));
 process.exit(0);
}
console.log('Creating Access application protecting ONLY the Account 4 control dashboard.');
const app=await call('/access/apps','POST',{
 type:'self_hosted',
 name:'HKEM Website Update Centre - Account 4',
 destinations:[{type:'public',uri:hostname}],
 policies:[{decision:'allow',include:[{cloudflare_account_member:{account_id:account}}]}],
 session_duration:'8h',
 app_launcher_visible:false
});
if(!app){
 console.error('The current Account 4 API token cannot create the secured Access application. Grant Access Apps and Policies Write, and ensure Zero Trust is enabled.');
 process.exit(2);
}
console.log('Created account-member protected dashboard:',app.name,'audConfigured',Boolean(app.aud));
const check=await fetch('https://'+hostname+'/',{redirect:'manual',signal:AbortSignal.timeout(15000)});
console.log('Unauthenticated browser status:',check.status,'(sign-in redirect expected)');
if(check.status===200)throw Error('Dashboard unexpectedly public - verify Access routing before use.');
