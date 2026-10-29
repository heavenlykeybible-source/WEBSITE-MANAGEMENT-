const {chromium}=require('playwright');
const origin=process.env.HK_NATIVE_TEST_ORIGIN||'http://127.0.0.1:8765';
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const viewport of [{width:390,height:844},{width:768,height:1024},{width:1440,height:1000}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/downloads.html');
 await page.locator('[data-download-app="all-in-one"]').first().click();
 await page.locator('dialog').waitFor();
 if(await page.locator('dialog .downloadcard').count()!==5)throw Error('Device chooser does not contain exactly five device options');
 const text=await page.locator('dialog').innerText();if(/Add to Home Screen|Open in Safari/.test(text))throw Error('Browser installation masquerading as download');
 await page.locator('.dialog-close').click();
 if(await page.locator('#download-options .downloadcard').count()!==5)throw Error('Duplicate device cards');
 if(errors.length)throw Error(errors.join('\n'));console.log('Native chooser passed at '+viewport.width+'px');await page.close();
}
const page=await browser.newPage();await page.route('**/api/native-download/**',route=>route.fulfill({status:404,body:'Not published'}));
await page.goto(origin+'/download/android/?app=all-in-one');await page.waitForFunction(()=>document.querySelector('.small').textContent.includes('not published'));
if(await page.locator('a[download]:visible').count())throw Error('Unavailable Android download visible');
await page.goto(origin+'/download/iphone/?app=all-in-one');await page.waitForFunction(()=>document.querySelector('.small').textContent.includes('not published'));
if(await page.locator('a[download]:visible').count())throw Error('Unavailable iPhone download visible');console.log('Unpublished Android/iPhone installers stay unavailable');
await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
