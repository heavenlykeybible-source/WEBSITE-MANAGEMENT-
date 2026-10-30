import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const html=readFileSync(resolve(root,'public/login.html'),'utf8');
const js=readFileSync(resolve(root,'public/owner-login.js'),'utf8');
assert.match(html,/autocomplete="current-password"/);
assert.match(html,/autocomplete="username"/);
assert.match(html,/aria-live="polite"/);
assert.doesNotMatch(js,/Apostolic|password\s*:\s*['"][^'"]{8,}/i,'Never commit actual credentials into login script');
const handlers={};
const username={value:'owner'};
const password={value:'testpassword',type:'password',focus(){}};
const submit={disabled:false};
const status={textContent:''};
const toggle={checked:false,addEventListener(event,handler){handlers['toggle:'+event]=handler}};
const form={addEventListener(event,handler){handlers[event]=handler},querySelector(){return submit}};
const nodes={'#owner-login':form,'#login-status':status,'#password':password,'#username':username,'#show-password':toggle};
let request;
let response={ok:true,status:200,json:async()=>({ok:true})};
const location={assigned:null,assign(path){this.assigned=path}};
runInNewContext(js,{
 document:{querySelector:q=>nodes[q]??null},fetch:async(url,options)=>{request={url,options};return response},
 location,AbortController,clearTimeout,setTimeout,JSON,Error
});
assert.equal(typeof handlers.submit,'function');
handlers['toggle:change']();assert.equal(password.type,'password');
toggle.checked=true;handlers['toggle:change']();assert.equal(password.type,'text');
await handlers.submit({preventDefault(){}});
assert.equal(request.url,'/api/owner/login');
assert.equal(request.options.credentials,'same-origin');
assert.equal(request.options.cache,'no-store');
assert.equal(request.options.redirect,'error');
assert.equal(location.assigned,'/');
password.value='wrong';
location.assigned=null;
response={ok:false,status:401,json:async()=>({error:'Sign-in failed'})};
await handlers.submit({preventDefault(){}});
assert.equal(location.assigned,null);
assert.equal(password.value,'');
assert.match(status.textContent,/Sign-in failed/);
const server=readFileSync(resolve(root,'src/owner-auth.ts'),'utf8');
assert.match(server,/DELETE FROM cms_ai_limits WHERE bucket_key=\?/,'Successful login must clear rate-limit counter');
assert.match(server,/Max-Age=43200/,'Server must issue a 12-hour secure owner cookie');
assert.match(server,/now\+43200/,'Server session lifetime must match cookie lifetime');
assert.match(server,/Secure; HttpOnly; SameSite=Strict/,'Owner session cookies must be protected');
assert.match(server,/DELETE FROM cms_owner_sessions/,'Password resets must revoke existing sessions');
const activeRoot=resolve(root,'../source');
const activeIndex=readFileSync(resolve(activeRoot,'public/index.html'),'utf8');
const activeServer=readFileSync(resolve(activeRoot,'src/index.ts'),'utf8');
const ownerHost='heavenlykey-owner-dashboard.emmanuel2026miracle.workers.dev';
assert.ok(activeIndex.includes('https://'+ownerHost+'/login.html'),'Owner link must use the supported authentication hostname');
assert.ok(activeServer.includes("u.hostname==='"+ownerHost+"'"),'Owner auth host must match the public sign-in link');
for(const file of ['public/login.html','public/owner-login.js','public/control.css','src/owner-auth.ts']){
 assert.ok(readFileSync(resolve(activeRoot,file),'utf8').length>200,'Active Control Room missing '+file);
}
assert.equal(readFileSync(resolve(activeRoot,'src/owner-auth.ts'),'utf8'),server,'Active owner authentication must match tested implementation');
console.log('Owner login client and server security checks passed');
