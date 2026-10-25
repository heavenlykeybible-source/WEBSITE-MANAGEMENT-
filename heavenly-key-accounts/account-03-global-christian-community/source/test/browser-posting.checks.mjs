// Opt-in end-to-end QA against disposable local D1/KV/R2, never production.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const dir=mkdtempSync(tmpdir()+'/account3-browser-qa-');
const output=process.env.QA_OUTPUT||dir+'/screenshots';mkdirSync(output,{recursive:true});
const cli=cwd+'node_modules/wrangler/bin/wrangler.js',config=dir+'/wrangler.toml';
const environment={...process.env,WRANGLER_SEND_METRICS:'false'};
delete environment.CLOUDFLARE_API_TOKEN;delete environment.CLOUDFLARE_ACCOUNT_ID;
const base='http://127.0.0.1:8791';
writeFileSync(config,`name="account3-browser-qa"\nmain="${cwd}src/index.ts"\ncompatibility_date="2025-01-01"\n[assets]\ndirectory="${cwd}public"\nrun_worker_first=["/api/*"]\n[[d1_databases]]\nbinding="DB"\ndatabase_name="account3-browser-qa-db"\ndatabase_id="00000000-0000-0000-0000-000000000003"\nmigrations_dir="${cwd}migrations"\n[[kv_namespaces]]\nbinding="SESSIONS"\nid="00000000000000000000000000000003"\n[[r2_buckets]]\nbinding="MEDIA"\nbucket_name="account3-browser-qa-local-only"\n[vars]\nPASSWORD_PEPPER="disposable-browser-qa-only"\n`);
let server,browser,logs='';const results=[],errors=[];
const check=async(label,fn)=>{await fn();results.push(label);console.log('PASS '+label);};
try{
 const migrated=spawnSync(process.execPath,[cli,'d1','migrations','apply','account3-browser-qa-db','--local','--config',config,'--persist-to',dir+'/state'],{cwd,env:environment,encoding:'utf8'});assert.equal(migrated.status,0,migrated.stderr);
 server=spawn(process.execPath,[cli,'dev','--local','--config',config,'--persist-to',dir+'/state','--port','8791','--ip','127.0.0.1'],{cwd,env:environment,stdio:['ignore','pipe','pipe']});server.stdout.on('data',x=>logs+=x);server.stderr.on('data',x=>logs+=x);
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/health')).ok;}catch{}if(ready)break;if(server.exitCode!==null)throw Error(logs);await new Promise(r=>setTimeout(r,200));}assert.ok(ready,logs);
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:JSON.parse(process.env.CHROMIUM_ARGS||'[]').filter(x=>x!=='--disable-web-security'&&x!=='--allow-running-insecure-content')});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 // External media/providers are outside this local application test.
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 const account={name:'Local Browser QA',email:'browser-'+Date.now()+'@example.invalid',password:'A long local testing passphrase 2026'};
 await check('registration through the real phone-width form',async()=>{
  await page.goto(base+'/account.html#register');const form=page.locator('.account-form:not([hidden])');await form.locator('[name=fullName]').fill(account.name);await form.locator('[name=email]').fill(account.email);await form.locator('[name=password]').fill(account.password);await form.locator('[name=ageConfirmed]').check();await form.locator('[name=standardsAccepted]').check();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/register'));await form.getByRole('button',{name:'Create account',exact:true}).click();assert.equal((await response).status(),201);await page.locator('.composer-prompt').waitFor({state:'visible'});
 });
 let postId;const message='Hope in Christ 🙏\nTogether we build faith.';
 const open=async()=>{await page.locator('.composer-prompt').first().click();await page.locator('dialog[open] .easy-card-write').waitFor({state:'visible'});};
 const editor=()=>page.locator('dialog[open] .easy-card-write');
 await check('direct typing keeps native focus, selection and text when colour changes',async()=>{
  await open();await editor().fill(message);await editor().evaluate(n=>{window.qaEditor=n;n.setSelectionRange(5,5);});await page.keyboard.type(' alive');assert.equal(await editor().inputValue(),message.slice(0,5)+' alive'+message.slice(5));assert.ok(await editor().evaluate(n=>n===window.qaEditor&&document.activeElement===n));
  await editor().fill(message);await editor().evaluate(n=>n.setSelectionRange(5,9));await page.locator('dialog[open] .easy-design-swatch').nth(4).click();assert.equal(await editor().inputValue(),message);assert.deepEqual(await editor().evaluate(n=>[n.selectionStart,n.selectionEnd]),[5,9]);
  assert.equal(await page.locator('dialog[open] .easy-card-extras').getAttribute('open'),null);assert.equal(await page.locator('dialog[open] [name=title]').isVisible(),false);assert.equal(await page.locator('dialog[open] [name=designCategory]').isVisible(),false);
 });
 for(const width of [320,390,768,1440])await check('composer fits '+width+'px viewport',async()=>{
  await page.setViewportSize({width,height:width>700?1000:844});const boxes=await page.locator('dialog[open]').evaluate(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,scroll:n.scrollWidth,client:n.clientWidth,textarea:n.querySelector('.easy-card-write').getBoundingClientRect().toJSON(),view:innerWidth}));assert.ok(boxes.left>=-1&&boxes.right<=width+1,JSON.stringify(boxes));assert.ok(boxes.scroll<=boxes.client+1,JSON.stringify(boxes));assert.ok(boxes.textarea.left>=boxes.left&&boxes.textarea.right<=boxes.right,JSON.stringify(boxes));const publish=await page.locator('dialog[open] button[type=submit]').evaluate(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom,height:innerHeight,colour:getComputedStyle(n).backgroundColor}));assert.ok(publish.top>=0&&publish.bottom<=publish.height,JSON.stringify(publish));assert.equal(publish.colour,'rgb(23, 79, 152)');await page.locator('dialog[open]').screenshot({path:output+'/composer-'+width+'.png',timeout:12000});
 });
 await check('autosaved draft restores after a reload with its selected colour',async()=>{
  await page.setViewportSize({width:390,height:844});await page.reload();await open();assert.equal(await editor().inputValue(),message);assert.equal(await page.locator('dialog[open] [name=palette]').inputValue(),'4');
 });
 await check('publish without title or category persists through the actual backend',async()=>{
  const response=page.waitForResponse(r=>r.url().endsWith('/api/posts')&&r.request().method()==='POST');await page.locator('dialog[open]').getByRole('button',{name:'Publish',exact:true}).click();const r=await response;assert.equal(r.status(),201,await r.text());postId=(await r.json()).postId;await page.locator(`.post[data-post-id="${postId}"]`).waitFor({state:'visible'});const record=await (await context.request.get(base+'/api/feed?postId='+postId)).json();assert.equal(record.items[0].body,message);assert.equal(record.items[0].title||'', '');assert.equal(record.items[0].design_category||'','');assert.equal(JSON.parse(record.items[0].design_settings).templateId,'card-192');
 });
 await check('editing loads saved text/colour and saves without requiring a title',async()=>{
  const post=page.locator(`.post[data-post-id="${postId}"]`);await post.locator('.post-menu summary').click();await post.getByRole('button',{name:'Edit',exact:true}).click();assert.equal(await editor().inputValue(),message);assert.equal(await page.locator('dialog[open] [name=palette]').inputValue(),'4');await editor().fill(message+'\nEdited with care.');await page.locator('dialog[open] .easy-design-swatch').nth(6).click();const response=page.waitForResponse(r=>r.url().endsWith('/api/posts/'+postId)&&r.request().method()==='PATCH');await page.locator('dialog[open]').getByRole('button',{name:'Save changes',exact:true}).click();assert.equal((await response).status(),200);await page.locator('dialog[open]').waitFor({state:'detached'});const record=await (await context.request.get(base+'/api/feed?postId='+postId)).json();assert.equal(record.items[0].body,message+'\nEdited with care.');assert.equal(JSON.parse(record.items[0].design_settings).templateId,'card-288');
 });
 await check('discarding a draft removes its stored copy',async()=>{
  await open();await editor().fill('A discardable draft');await page.locator('dialog[open] .composer-drafts summary').click();await page.locator('dialog[open]').getByRole('button',{name:'Discard draft',exact:true}).click();assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(x=>x.startsWith('hk-design-draft:')).length),0);await page.reload();await open();assert.equal(await editor().inputValue(),'');await page.locator('dialog[open] .dialog-close').click();
 });
 await check('Groups, Spaces, messages and profile views load for the signed-in member',async()=>{
  for(const path of ['groups.html','spaces.html','messages.html','profile.html']){await page.goto(base+'/'+path);await page.locator('#page-root').waitFor();await page.waitForFunction(()=>!document.querySelector('.community-loading'));assert.equal(await page.getByText('Unable to load',{exact:true}).count(),0,path);assert.equal((await page.evaluate(async()=>await(await fetch('/api/me')).json())).user.status,'active');assert.match(await page.locator('.brand').innerText(),/Global Christian\s+Social Network/);assert.equal(await page.locator('.community-advert').count(),0);await page.screenshot({path:output+'/'+path.replace('.html','.png'),fullPage:false,timeout:12000});}
 });
 await check('sign out and email sign in restore the intended messages destination',async()=>{
  const signedOut=page.waitForResponse(r=>r.url().endsWith('/api/auth/logout'));await page.getByRole('button',{name:'Sign out',exact:true}).click();assert.equal((await signedOut).status(),200);await page.locator('.account-form:not([hidden])').waitFor({state:'visible'});await page.goto(base+'/account.html?next=messages.html');const form=page.locator('.account-form:not([hidden])');await form.locator('[name=email]').fill(account.email);await form.locator('[name=password]').fill(account.password);const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/login'));await form.getByRole('button',{name:'Sign in',exact:true}).click();assert.equal((await response).status(),200);await page.waitForURL(/\/messages(?:\.html)?$/);await page.waitForFunction(()=>document.querySelector('.messages-layout,.chat-layout')||!document.querySelector('.community-loading'));assert.equal(await page.getByText('Unable to load',{exact:true}).count(),0);
 });
 assert.deepEqual(errors,[],'Uncaught browser exceptions');console.log('PASS no uncaught browser errors');writeFileSync(output+'/results.json',JSON.stringify({checks:results,errors,productionTouched:false},null,2));
}catch(error){if(browser){for(const c of browser.contexts())for(const p of c.pages()){const text=await Promise.race([p.locator('body').innerText(),new Promise(r=>setTimeout(()=>r('Page did not respond'),3000))]).catch(e=>e.message);writeFileSync(output+'/failure-details.json',JSON.stringify({error:error.message,text,errors},null,2));} }if(browser){for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:output+'/failure.png',fullPage:false,timeout:12000}).catch(()=>{});}throw error;
}finally{await browser?.close();if(server&&server.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await exited;}rmSync(dir,{recursive:true,force:true});}
