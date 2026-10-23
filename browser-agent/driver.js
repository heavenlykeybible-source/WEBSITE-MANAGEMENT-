import {allowedUrl, publicAddress, validateAction} from './policy.js';

// This service is private: only the authenticated control plane holds its binding.
export function createDriver(puppeteer, resolvePublic) {
 return async function run(binding, job, action) {
  validateAction(action);
  if (Date.now()>job.expires) throw Error('Browser task expired');
  let browser, page;
  try {
   browser=job.session?await puppeteer.connect(binding,job.session):await puppeteer.launch(binding,{keep_alive:30000});
   const pages=await browser.pages();page=pages[0]||await browser.newPage();
   await page.setViewport({width:1280,height:800});page.setDefaultTimeout(8000);
   await page.setRequestInterception(true);
   page.on('request',async request=>{try{const u=allowedUrl(request.url(),job.hosts);if(!await resolvePublic(u.hostname))throw Error('Private destination');await request.continue();}catch{await request.abort().catch(()=>{});}});
   page.on('popup',p=>{p.close().catch(()=>{});});
   if(action.type==='close'){await browser.close();browser=null;return {closed:true};}
   if(action.type==='navigate'){allowedUrl(action.url,job.hosts);await page.goto(action.url,{waitUntil:'domcontentloaded',timeout:15000});}
   else if(action.type!=='observe'){
    allowedUrl(page.url(),job.hosts);
    if(await page.evaluate(()=>document.documentElement.dataset.hkSnapshot)!==action.snapshot)throw Error('Page changed; observe again');
    if(action.type==='press')await page.keyboard.press(action.key);
    else {
     const el=await page.$('[data-hk-element="'+action.element+'"]');if(!el)throw Error('Element changed; observe again');
     const sensitive=await el.evaluate(e=>e.matches('input[type=password],input[type=email],input[autocomplete*=password],input[autocomplete=one-time-code]')||/password|verification|captcha|otp|secret|token|credit|cardnumber/i.test([e.id,e.name,e.autocomplete].join(' ')));
     if(sensitive&&!action.ownerInput)throw Error('Owner input is required for this field');
     if(action.type==='click')await el.click();
     if(action.type==='fill'){await el.evaluate(e=>{e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));});await el.type(action.value);}
     if(action.type==='select')await el.select(action.value);
    }
   }
   // Never return page text, input values, cookies, or storage to an AI.
   const snapshot=crypto.randomUUID();
   const state=await page.evaluate(id=>{
    document.documentElement.dataset.hkSnapshot=id;
    const old=document.getElementById('hk-private-mask');if(old)old.remove();
    const style=document.createElement('style');style.id='hk-private-mask';style.textContent='input,textarea,[contenteditable=true]{color:transparent!important;text-shadow:none!important;-webkit-text-security:disc!important}';document.head.append(style);
    return [...document.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).slice(0,200).map((e,i)=>{e.dataset.hkElement=i;return {id:i,tag:e.tagName.toLowerCase(),type:e.type||'',label:(e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.name||e.id||(['A','BUTTON'].includes(e.tagName)?e.innerText:'')||'').slice(0,120)};});
   },snapshot);
   const raw=page.url(),url=new URL(raw);url.search='';url.hash='';
   const shot=await page.screenshot({type:'jpeg',quality:60,encoding:'base64'});
   return {session:browser.sessionId(),snapshot,url:url.href,elements:state,screenshot:shot,notice:'Screenshot may include private page content. Share only with the owner; field values are masked.'};
  } finally { if(browser)await browser.disconnect(); }
 };
}

export async function resolvePublic(host) {
 const answers=await Promise.all(['A','AAAA'].map(async type=>{
  const response=await fetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type,{headers:{accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Cannot verify destination');const d=await response.json();return (d.Answer||[]).filter(a=>a.type===1||a.type===28).map(a=>a.data);
 }));const addresses=answers.flat();return addresses.length>0&&addresses.every(publicAddress);
}
