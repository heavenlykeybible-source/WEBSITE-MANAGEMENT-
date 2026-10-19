const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/v1/assistant'){const body=route.request().postDataJSON();assert.deepEqual(Object.keys(body),['message']);return route.fulfill({json:{response:'Please contact the ministry through our official WhatsApp contact.'}});}
   if(u.pathname==='/v1/content')return route.fulfill({json:{content:null,menu:null,footer:null}});
   if(u.hostname!=='heavenlykey.org')return route.fulfill({body:''});
   const p=path.resolve(__dirname,'../heavenly-key-website','.'+(u.pathname==='/'?'/index.html':u.pathname));
   if(!p.startsWith(path.resolve(__dirname,'../heavenly-key-website')+path.sep)||!fs.existsSync(p))return route.fulfill({status:404,body:''});
   const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
   return route.fulfill({body:fs.readFileSync(p),contentType:types[path.extname(p)]||'application/octet-stream'});
  });
  await page.goto('https://heavenlykey.org/');
  const toggle=page.getByRole('button',{name:'Open Online Assistant chat',exact:true});
  await toggle.waitFor();
  await toggle.click();
  const suggestion=page.getByRole('button',{name:'I want to talk to Evangelist Emmanuel Ogheneochuko Adiohwo',exact:true});
  await suggestion.waitFor();
  const frame=await page.locator('.hkem-iphone-chat').boundingBox();
  assert.ok(frame.x>=0&&frame.y>=0&&frame.x+frame.width<=viewport.width+1&&frame.y+frame.height<=viewport.height+1,'Chat stays in viewport');
  const portrait=page.locator('.hkem-chat-header .hkem-ai-avatar img');
  assert.ok(await portrait.evaluate(img=>img.complete&&img.naturalWidth>0),'Approved portrait loads in header');
  if(viewport.width<600){assert.ok(frame.width<=320&&frame.height<=440,'Mobile chat is compact');assert.ok(frame.y>150,'Mobile chat sits lower');}
  assert.match(await page.locator('.hkem-chat-header').textContent(),/HEAVENLY KEY EVANGELISTIC MOVEMENT AI ASSISTANT/);
  await suggestion.click();
  await page.locator('.hkem-chat-bot').filter({hasText:'Please contact'}).waitFor();
  assert.equal(await page.locator('.hkem-chat-welcome').count(),0);
  assert.equal(await page.locator('.hkem-chat-visitor').textContent(),'I want to talk to Evangelist Emmanuel Ogheneochuko Adiohwo');
  assert.equal(await page.locator('.hkem-chat-bot').evaluate(el=>getComputedStyle(el).alignSelf),'flex-start');
  assert.equal(await page.locator('.hkem-chat-visitor').evaluate(el=>getComputedStyle(el).alignSelf),'flex-end');
  await page.screenshot({path:path.join(process.cwd(),`native-chat-${viewport.width}.png`),fullPage:true});
  await page.close();
 }
 await browser.close();console.log('Desktop and mobile: original prompt, phone frame, disappearing suggestions and left/right bubbles passed');
})().catch(e=>{console.error(e);process.exit(1)});
