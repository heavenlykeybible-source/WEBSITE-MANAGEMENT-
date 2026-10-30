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
console.log('Owner login client security and recovery checks passed');
