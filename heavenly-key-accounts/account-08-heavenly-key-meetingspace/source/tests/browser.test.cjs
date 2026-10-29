// UI smoke test using a real local Worker/D1 backend and Chromium fake camera.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const { DatabaseSync } = require('node:sqlite');
const { spawnSync } = require('child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'), db=new DatabaseSync(':memory:');
 db.exec(fs.readFileSync(path.join(root,'server/schema.sql'),'utf8'));
 const secret='browser-test-secret-'.repeat(3);
 db.exec(spawnSync(process.execPath,[path.join(root,'server/setup-accounts.mjs')],{env:{...process.env,AUTH_SECRET:secret,STUDIO_INITIAL_PASSWORD:'TestFixture123!'},encoding:'utf8'}).stdout);
 const wrapper={prepare(sql){const mk=args=>({bind:(...a)=>mk(a),first:async()=>db.prepare(sql).get(...args)||null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});return mk([])},async batch(ss){for(const s of ss)await s.run();return []}};
 const temp=path.join(__dirname,'_browser_worker.mjs');fs.copyFileSync(path.join(root,'site/_worker.js'),temp);
 const worker=(await import('file://'+temp)).default;
 const env={TEAMDB:wrapper,AUTH_SECRET:secret,STUDIO_INITIAL_PASSWORD:'TestFixture123!',ASSETS:{fetch:async()=>new Response('asset')}};
 const errors=[];let server,browser;
 try{
 server=http.createServer(async(req,res)=>{try{
  const origin='http://127.0.0.1:8751',url=new URL(req.url,origin);
  if(url.pathname.startsWith('/api/')){const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const r=await worker.fetch(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})}),env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return}
  const f=path.join(root,'site',url.pathname==='/'?'index.html':url.pathname);const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/manifest+json'};
  if(!fs.existsSync(f)){res.writeHead(404);return res.end()};res.setHeader('content-type',types[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));
 }catch(e){res.writeHead(500);res.end(String(e));errors.push(String(e))}});
 await new Promise(r=>server.listen(8751,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const ctx=await browser.newContext({permissions:['camera','microphone']});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto('http://127.0.0.1:8751/');await page.locator('#acb').click();
 await page.locator('#aem').fill('owner');await page.locator('#apw').fill('TestFixture123!');await page.locator('#ali').click();
 await page.waitForFunction(()=>document.querySelector('#acs').textContent.includes('owner (owner)'));
 await page.locator('[data-t="9"]').click();
 await page.locator('#newuser').fill('browseruser');await page.locator('#userpw').fill('Browser123');await page.locator('#createuser').click();
 await page.waitForFunction(()=>document.querySelector('#admsg').textContent.includes('Account created'));
 await page.locator('#resetuser').fill('browseruser');await page.locator('#resetpw').fill('NewBrowser123');await page.locator('#resetuserpw').click();
 await page.waitForFunction(()=>document.querySelector('#admsg').textContent.includes('Password set'));
 await page.locator('[data-t="8"]').click();await page.locator('#alo').click();
 await page.locator('#aem').fill('browseruser');await page.locator('#apw').fill('NewBrowser123');await page.locator('#ali').click();
 await page.waitForFunction(()=>document.querySelector('#acs').textContent.includes('browseruser (user)'));
 if(await page.locator('[data-t="9"]').isVisible())throw Error('Admin tab visible for ordinary user');
 await page.locator('#mdb').click();await page.locator('[data-t="2"]').click();await page.locator('#nrs').uncheck();
 await page.locator('[data-a="acam"]').click();
 await page.waitForFunction(()=>document.querySelector('#ul').textContent.includes('Camera'));
 const shape=await page.locator('[data-m="radio"]').isDisabled();if(!shape)throw Error('Radio is not on hold');
 await page.setViewportSize({width:390,height:844});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+5);if(overflow)throw Error('Mobile horizontal overflow');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('Browser passed: owner login, create user, reset password, user login, admin visibility, camera, radio hold, mobile width; no page errors.');
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));fs.unlinkSync(temp)}
})().catch(e=>{console.error(e);process.exitCode=1});
