/**
 * Account 5 browser acceptance: source-controlled pages, phone/tablet/desktop.
 * Never claim off-origin services are verified by a local static fixture.
 */
import {chromium} from 'playwright';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const catalogue=JSON.parse(readFileSync(path.join(root,'app-downloads.json'),'utf8'));
const origin='https://apps.heavenlykey.org';
const base=process.env.HKEM_TEST_BASE || 'http://127.0.0.1:8765';
const widths=[{name:'small-phone',width:320,height:690},{name:'phone',width:390,height:844},{name:'tablet',width:768,height:1024},{name:'desktop',width:1366,height:768}];
const failures=[];
const screenshots=path.resolve(process.env.HKEM_SCREENSHOT_DIR||'/tmp/account5-ui-screenshots');
mkdirSync(screenshots,{recursive:true});
const localRoutes=new Map([['directory','/downloads.html'],['app-home','/index.html'],['all-in-one','/experience.html']]);
for(const [id,app] of Object.entries(catalogue)){
 const url=new URL(app.url);
 if(url.origin!==origin){
  console.log('EXTERNAL NOT BROWSER-VERIFIED:',id,url.href);
  continue;
 }
 const route=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
 const disk=path.join(root,route.slice(1));
 if(!existsSync(disk)){
  console.log('WORKER-ROUTED NOT VERIFIED BY STATIC SERVER:',id,url.href);
  continue;
 }
 localRoutes.set(id,route);
}
for(const device of ['android','iphone','ipad','windows','mac']){
 localRoutes.set('install-'+device,'/download/'+device+'/index.html?app=all-in-one');
}
console.log('Local pages for layout acceptance:',[...localRoutes.entries()]);
const browser=await chromium.launch({headless:true});
try{
 for(const size of widths){
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,isMobile:size.width<=390,hasTouch:size.width<=390,serviceWorkers:'block'});
  for(const [id,route] of localRoutes){
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err.message).slice(0,180)));
   const location=base+route;
   try{
    const response=await page.goto(location,{waitUntil:'domcontentloaded',timeout:25000});
    await page.waitForTimeout(200);
    const state=await page.evaluate(()=>{
     const body=document.body;
     const title=document.title.trim();
     const main=document.querySelector('main')||body;
     const viewport=document.documentElement.clientWidth;
     const width=Math.max(document.documentElement.scrollWidth,body.scrollWidth);
     const rect=main.getBoundingClientRect();
     const links=[...document.querySelectorAll('a[href]')].filter(a=>a.getAttribute('href')==='javascript:void(0)');
     return {title,viewport,width,mainWidth:rect.width,height:rect.height,unsafeLinks:links.length,text:body.innerText.trim().length};
    });
    if(!response?.ok())throw Error('HTTP '+response?.status());
    if(!state.title || state.text<30)throw Error('Blank page/title: '+JSON.stringify(state));
    if(state.mainWidth<50||state.height<40)throw Error('Main content missing: '+JSON.stringify(state));
    if(state.width>state.viewport+12)throw Error('Horizontal overflow: '+JSON.stringify(state));
    if(state.unsafeLinks)throw Error('Inert javascript links: '+state.unsafeLinks);
    if(errors.length)throw Error('Browser JavaScript errors: '+errors.join(' | '));
    if(id==='directory' && size.name==='phone'){
     // Every advertised app must open its correct chooser and five device links.
     // Catch buttons that look correct but cannot be clicked on a small phone.
     for(const appId of Object.keys(catalogue)){
      const button=page.locator('[data-download-app="'+appId+'"]');
      if(await button.count()<1)throw Error('Missing app chooser: '+appId);
      // All-in-One appears in both the hero and device section by design.
      // Test the visible primary control without treating the second entry as an error.
      await button.first().click({timeout:5000});
      const dialog=page.locator('dialog.hk-install-dialog');
      await dialog.waitFor({state:'visible',timeout:5000});
      const expectedName=catalogue[appId].name;
      const actualName=(await dialog.locator('h2').innerText()).trim();
      if(actualName!==expectedName)throw Error('Wrong app chooser heading '+appId+': '+actualName);
      for(const device of ['android','iphone','ipad','windows','mac']){
       const guide='/download/'+device+'/?app='+encodeURIComponent(appId);
       if(await dialog.locator('a[href="'+guide+'"]').count()<1)throw Error('Missing device '+device+' for '+appId);
       if(await dialog.locator('img[src="/qr/app-'+appId+'-'+device+'.svg"]').count()!==1)throw Error('Missing matching QR image '+device+' for '+appId);
      }
      await dialog.locator('button.dialog-close').click();
      await dialog.waitFor({state:'detached',timeout:5000});
     }
     console.log('PASS all',Object.keys(catalogue).length,'app selection dialogs on small phone');
    }
    if(id==='all-in-one' && size.name==='phone'){
     // Run actual all-in-one app navigation, not merely static page rendering.
     for(const screen of ['grow','community','live']){
       const choice=page.locator('#home [data-screen="'+screen+'"]');
       await page.locator('#home').evaluate(el=>{el.hidden=false;el.classList.add('active');});
       // Navigate from the original home tile after restoring its view via the tab bar.
       await page.locator('.tabbar [data-screen="home"]').click({timeout:5000});
       await choice.click({timeout:5000});
       const view=page.locator('#'+screen);
       if(await view.isHidden())throw Error('All-in-one screen is hidden after click: '+screen);
       if(!page.url().endsWith('#'+screen))throw Error('All-in-one history not updated for '+screen);
       await page.goBack({waitUntil:'domcontentloaded',timeout:8000});
       if(await page.locator('#home').isHidden())throw Error('Back did not restore home from '+screen);
     }
     console.log('PASS all-in-one interactive mobile navigation and browser Back');
    }
    if(id==='all-in-one' && size.name==='small-phone'){
      const screens=['home','grow','community','live','bible','prayer','settings','messages','groups','profile'];
      for(const screen of screens){
        await page.goto(base+'/experience.html#'+screen,{waitUntil:'domcontentloaded',timeout:10000});
        const state=await page.evaluate(()=>{
          const views=[...document.querySelectorAll('main .view')];
          return {visible:views.filter(el=>!el.hidden).map(el=>el.id),
            headings:views.filter(el=>!el.hidden).map(el=>el.querySelector('h1')?.textContent?.trim()||''),
            navigation:document.querySelector('.tabbar button[aria-current="page"]')?.dataset.screen};
        });
        if(state.visible.length!==1 || state.visible[0]!==screen || !state.headings[0]){
          throw Error('All-in-one deep link renders wrong screen '+screen+': '+JSON.stringify(state));
        }
        console.log('PASS all-in-one screen',screen,'on small phone');
      }
      await page.goto(base+'/experience.html',{waitUntil:'domcontentloaded'});
    }
    if(['directory','all-in-one'].includes(id)){
     await page.screenshot({path:path.join(screenshots,id+'-'+size.name+'.png'),fullPage:true,timeout:20000});
    }
    console.log('PASS',size.name,id,'viewport',state.viewport,'scrollWidth',state.width);
   }catch(error){
    failures.push({device:size.name,app:id,route,error:String(error)});
    console.error('FAIL',size.name,id,String(error));
    try{await page.screenshot({path:path.join(screenshots,'FAILED-'+id+'-'+size.name+'.png'),fullPage:true,timeout:10000})}catch{}
   }finally{await page.close()}
  }
  await context.close();
 }
}finally{await browser.close()}
console.log('ACCOUNT 5 RESPONSIVE TEST SUMMARY',JSON.stringify({tested:[...localRoutes.keys()],widths:widths.map(x=>x.name),failures},null,2));
if(failures.length)process.exitCode=1;
