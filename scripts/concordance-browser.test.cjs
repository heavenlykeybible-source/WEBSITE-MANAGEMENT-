/* Local Chromium integration checks. Requires Playwright; never accesses production. */
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve('apps/heavenly-key-bible/heavenly-key-website');
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 let target=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(!target.startsWith(root+path.sep)&&target!==root){res.writeHead(403).end();return}
 if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
 if(!fs.existsSync(target)){res.writeHead(404).end();return}
 res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.json')?'application/json':'text/html');
 fs.createReadStream(target).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true}),context=await browser.newContext();
 const page=await context.newPage(),errors=[],tests=[],timings=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.testCopied='';window.testShared=null;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>window.testCopied=text},configurable:true});
  Object.defineProperty(navigator,'share',{value:async data=>{window.testShared=data},configurable:true});
 });
 const base=`http://127.0.0.1:${server.address().port}/bible/concordance/`;
 async function open(ch,v,book='GEN'){
  const t=Date.now();await page.goto(`${base}?book=${book}&chapter=${ch}&verse=${v}`);
  await page.waitForFunction(()=>document.querySelector('#passage').textContent.length>10);
  timings.push(Date.now()-t);
 }
 async function check(name,fn){await fn();tests.push(name)}
 try{
 await open(46,1);
 await check('KJV deep link and pending draft display',async()=>{assert.equal(await page.locator('#ref').innerText(),'Genesis 46:1');assert.match(await page.locator('#passage').innerText(),/Beer-sheba/);assert.match(await page.locator('#detail').innerText(),/pending human doctrinal review/);assert.match(await page.locator('#detail').innerText(),/major decisions/)});
 await check('historical context display',async()=>{await page.locator('[data-tab=context]').click();assert.match(await page.locator('#detail').innerText(),/Historical or cultural context:.*Genesis 26/s)});
 await check('first related reference remains clickable beside separate draft warning',async()=>{await page.locator('[data-tab=references]').click();await page.waitForSelector('#detail a');assert.match(await page.locator('#detail a').first().getAttribute('href'),/chapter=26&verse=24/);await page.locator('#detail a').first().click();await page.waitForFunction(()=>document.querySelector('#ref').textContent==='Genesis 26:24')});
 await check('previous/next chapter navigation',async()=>{await open(46,34);await page.locator('#next').click();assert.equal(await page.locator('#ref').innerText(),'Genesis 47:1');await page.locator('#prev').click();assert.equal(await page.locator('#ref').innerText(),'Genesis 46:34')});
 await check('cross-book forward and backward navigation',async()=>{await open(50,26);await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#ref').textContent==='Exodus 1:1');await page.locator('#prev').click();await page.waitForFunction(()=>document.querySelector('#ref').textContent==='Genesis 50:26')});
 await check('new flagged drafts withheld in all tabs and copied text',async()=>{await open(46,27);for(const tab of ['explanation','context','references']){await page.locator(`[data-tab=${tab}]`).click();assert.match(await page.locator('#detail').innerText(),/withheld/)}await page.locator('#copy').click();assert.match(await page.evaluate(()=>window.testCopied),/withheld/);assert.doesNotMatch(await page.evaluate(()=>window.testCopied),/household total reaches seventy/)});
 await check('needs_revision cannot fall back to legacy commentary',async()=>{await open(46,1);await page.evaluate(()=>{window.registerConcordanceStudyNotes({'Genesis 46:1':{explanation:'SHOULD NOT SHOW',context:'HIDDEN',references:'John 3:16',reviewStatus:'needs_revision'}});document.querySelector('[data-tab=explanation]').click()});assert.match(await page.locator('#detail').innerText(),/withheld/);assert.doesNotMatch(await page.locator('#detail').innerText(),/SHOULD NOT SHOW/)});
 await check('legacy Genesis entry preserved and labelled unreviewed',async()=>{await open(1,1);assert.match(await page.locator('#detail').innerText(),/Creator of heaven and earth/);assert.match(await page.locator('#detail').innerText(),/pending human doctrinal review/)});
 await check('Matthew legacy study bundle preserved and unreviewed',async()=>{await open(5,3,'MAT');assert.match(await page.locator('#detail').innerText(),/spiritual need/);assert.match(await page.locator('#detail').innerText(),/pending human doctrinal review/)});
 await check('missing commentary honest fallback and KJV chapter context',async()=>{await open(40,1,'EXO');assert.match(await page.locator('#detail').innerText(),/not yet published/);await page.locator('[data-tab=context]').click();assert.match(await page.locator('#detail').innerText(),/Selected/)});
 await check('selected-book concordance search and result deep link',async()=>{await open(46,1);await page.locator('#search-scope').selectOption('current');await page.locator('#search-term').fill('Beer-sheba');await page.locator('#concordance-search button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#search-progress').textContent.includes('matching verses found'));assert.ok(await page.locator('#search-results a').count());await page.locator('#search-results a').first().click();await page.waitForFunction(()=>document.querySelector('#passage').textContent.includes('Beer-sheba'))});
 await check('full-canon search traverses 66 books and reports no results honestly',async()=>{await page.locator('#search-scope').selectOption('all');await page.locator('#search-term').fill('nonexistenttestword987654');await page.locator('#concordance-search button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#search-progress').textContent.includes('matching verses found'));assert.equal(await page.locator('#search-progress').innerText(),'0 matching verses found');assert.equal(await page.locator('#search-results a').count(),0)});
 await check('topical concordance filter and links',async()=>{await page.locator('#topic-filter').fill('holiness');assert.ok(await page.locator('#topic-results a').count())});
 await check('copy and native sharing retain scripture, draft warning and link',async()=>{await open(46,1);await page.locator('#copy').click();assert.match(await page.evaluate(()=>window.testCopied),/Genesis 46:1 \(KJV\)/);assert.match(await page.evaluate(()=>window.testCopied),/pending human doctrinal review/);await page.locator('#share').click();assert.match(await page.evaluate(()=>window.testShared.text),/Study link:/)});
 await check('share fallback copies when native share unavailable',async()=>{await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:undefined}));await page.locator('#share').click();assert.match(await page.locator('#status').innerText(),/Study copied/)});
 await check('mobile 375px and 390px have no horizontal page overflow',async()=>{for(const width of [375,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}});
 await check('scripture request failure is visible and clears previous content',async()=>{await page.route('**/data/kjv/EXO.json',route=>route.fulfill({status:503,body:'unavailable'}));await page.locator('#book').selectOption('EXO');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('unavailable'));assert.equal(await page.locator('#passage').innerText(),'')});
 assert.deepEqual(errors,[]);tests.push('no uncaught browser errors');
 console.log(JSON.stringify({passed:tests.length,failed:0,tests,localLoadMilliseconds:{max:Math.max(...timings),samples:timings.length},limitations:'Desktop Chromium and emulated mobile viewport only. Not real iPhone/Android, production latency, device installability, native share sheet or clipboard permissions.'},null,2));
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
