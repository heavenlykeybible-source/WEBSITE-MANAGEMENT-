// Homepage structural checks — built-in Node only, no outside dependencies.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(resolve(dir,'index.html'),'utf8');
const sharedJs=readFileSync(resolve(dir,'js/main.js'),'utf8');
const sw=readFileSync(resolve(dir,'service-worker.js'),'utf8');
assert.ok(sw.includes('url.origin !== self.location.origin'), 'PWA must not intercept cross-origin app or sign-in traffic');
assert.ok(!sw.includes('"/css/homepage-polish.css?v=20261026"'), 'Unused global style must not be precached');
assert.ok(!sharedJs.includes('/pages/legal-requests.html'), 'Broken Legal Requests link must not recur');
assert.ok(sharedJs.includes('/pages/contact'), 'Legal Requests must lead to the verified Contact page');
assert.ok(!sharedJs.includes('/pages/terms.html'), 'Terms URL should use the verified clean route');
const attrs=[...html.matchAll(/\b(?:href|src)=(["'])(.*?)\1/g)].map(m=>m[2]);
const missing=[];
for(const value of new Set(attrs)){
 if(/^(https?:|mailto:|tel:|#|data:|javascript:)/i.test(value))continue;
 const pathname=decodeURIComponent(value.split(/[?#]/)[0]);if(!pathname)continue;
 const candidate=resolve(dir,pathname.replace(/^\//,''));
 const htmlCandidate=candidate+'.html';
 if(!existsSync(candidate)&&!existsSync(htmlCandidate)&&!existsSync(resolve(candidate,'index.html')))missing.push(pathname);
}
assert.deepEqual(missing,[],'Missing local links: '+missing.join(', '));
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML IDs');
for(const [img] of html.matchAll(/<img\b[^>]*>/g))assert.match(img,/\balt=/,'Missing alt attribute');
for(const [anchor] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g))assert.match(anchor,/rel="[^"]*noopener/,'Unsafe new tab');
assert.ok(!html.includes('css/homepage-polish.css'),'Do not alter existing homepage-wide design');
assert.doesNotMatch(html, /href=["']pages\/[a-z0-9-]+\.html/gi, 'Public homepage links must use extensionless routes');
const ecosystem=html.indexOf('data-cms-section="ecosystem"');
assert.ok(ecosystem>html.indexOf('data-cms-section="welcome"')&&ecosystem<html.indexOf('data-cms-section="assignment"'),'Ecosystem position changed');
const globe=readFileSync(resolve(dir,'css/heavenly-ecosystem.css'),'utf8');
assert.match(globe,/@keyframes hk-land-drift/);

// All public pages use the shared unobtrusive finish without changing ministry content.
const publicPages=['about','contact','grdpc','i-said-yes','meet-the-pastor','ministries','partner','privacy','radio','resources','social-handles','steps-to-salvation','terms','the-ministry','what-we-believe'];
const finish=readFileSync(resolve(dir,'css/global-clean-finish.css'),'utf8');
assert.ok(finish.includes('background-image:'),'Premium backdrop must remain available');
assert.ok(html.includes('css/global-clean-finish.css'),'Homepage must include shared finish');
assert.ok(html.includes('https://radio.heavenlykey.org/'),'Homepage radio must point to verified current service');
assert.doesNotMatch(html,/href=["']pages\/radio(?:\.html)?["']/i,'Old homepage radio links must not recur');
for(const page of publicPages){
 const pageHtml=readFileSync(resolve(dir,'pages',page+'.html'),'utf8');
 assert.ok(pageHtml.includes('/css/global-clean-finish.css'), 'Missing shared background on '+page);
 assert.doesNotMatch(pageHtml,/href=["'](?:\/pages\/radio(?:\.html)?|\.\/radio\.html)["']/i,'Old radio link found on '+page);
 assert.doesNotMatch(pageHtml,/href=["'](?:https:\/\/heavenlykey\.org)?\/pages\/[a-z0-9-]+\.html(?:[?#][^"']*)?["']/i,'Public links must not expose .html on '+page);
 assert.doesNotMatch(pageHtml,/href=["'](?:\.\/)?[a-z0-9-]+\.html(?:[?#][^"']*)?["']/i,'Relative .html navigation must not recur on '+page);
}


const menuCss=readFileSync(resolve(dir,'css/premium-menus-shared.css'),'utf8');
const menuState=readFileSync(resolve(dir,'js/premium-menu-state.js'),'utf8');
assert.ok(menuState.includes("aria-current"), 'Navigation must identify the actual current page');
assert.ok(menuCss.includes('hk-nav-current'), 'Active dropdown needs visible indication');
assert.ok(menuCss.includes('nav#main-nav[data-open="false"]'), 'Closed mobile navigation must be hidden');
assert.ok(menuCss.includes('prefers-reduced-motion'), 'Menu motion accessibility must be preserved');
for(const [name,pageHtml] of [['homepage',html],...publicPages.map(page=>[page,readFileSync(resolve(dir,'pages',page+'.html'),'utf8')])]){
 assert.ok(pageHtml.includes('premium-menus-shared.css'), 'Missing common navigation design on '+name);
 assert.ok(pageHtml.includes('premium-menu-state.js'), 'Missing active-page menu script on '+name);
 assert.ok(!pageHtml.includes('class="main-nav" style="display:block!important"'), 'Inline style prevents mobile navigation closing on '+name);
 if(pageHtml.includes('class="main-nav"')){
   assert.match(pageHtml, /aria-controls="main-nav"/, 'Mobile menu control is missing on '+name);
   assert.match(pageHtml, /id="main-nav" data-open="false"/, 'Mobile menu initial state missing on '+name);
 }
}


const pageThemes=readFileSync(resolve(dir,'css/distinctive-pages.css'),'utf8');
const homeFinish=readFileSync(resolve(dir,'css/homepage-distinctive.css'),'utf8');
assert.ok(html.includes('homepage-distinctive.css')&&html.includes('hk-home-premium'),'Homepage must use the approved original design with premium finishing');
assert.match(homeFinish,/\.welcome\b/,'Homepage hero finishing is missing');
assert.ok(pageThemes.includes('data-hk-page="contact"'),'Contact benchmark page theme is missing');
for(const page of publicPages.filter(p=>p!=='radio')){
 const pageHtml=readFileSync(resolve(dir,'pages',page+'.html'),'utf8');
 assert.ok(pageHtml.includes('data-hk-page="'+page+'"'), 'Missing distinct theme identity on '+page);
 assert.ok(pageHtml.includes('/css/distinctive-pages.css'), 'Distinctive theme stylesheet missing from '+page);
 assert.ok(pageThemes.includes('data-hk-page="'+page+'"'), 'No page-specific visual theme for '+page);
}


const notFound=readFileSync(resolve(dir,'404.html'),'utf8');
const serverError=readFileSync(resolve(dir,'500.html'),'utf8');
for(const [name,page] of [['404',notFound],['500',serverError]]){
 assert.match(page,/<meta name="robots" content="noindex/, 'Error pages must not be indexed: '+name);
 for(const destination of ['/', 'https://global.heavenlykey.org/', 'https://app.heavenlykey.org/', 'https://bible.heavenlykey.org/', 'https://radio.heavenlykey.org/', '/pages/contact']){
  assert.ok(page.includes('href="'+destination+'"'), 'Error page '+name+' is missing recovery destination '+destination);
 }
 assert.ok(!/stack trace|exception at|internal server error/i.test(page), 'Public error page must not expose technical error details: '+name);
}
assert.ok(sw.includes('"/404.html"')&&sw.includes('"/500.html"'), 'Branded recovery pages must be available offline');
assert.ok(sw.includes('status: res.status'), 'Public error recovery must preserve correct HTTP error status');
assert.ok(sw.includes('res.status === 404 || res.status >= 500'), 'HTML navigation errors must be handled explicitly');


const appDock=readFileSync(resolve(dir,'js/president-app-dock.js'),'utf8');
const appDockCss=readFileSync(resolve(dir,'css/president-app-dock.css'),'utf8');
assert.ok(html.includes('president-app-dock.js')&&html.includes('president-app-dock.css'),'Homepage must load approved president app dock');
for(const id of ['radio','assistant','bible','social','walk','study','eternity'])assert.ok(appDock.includes("id:'"+id+"'"),'Missing ministry app: '+id);
assert.ok(appDock.includes("url:'/eternity-in-view/'"),'Eternity in View must use its actual site route');
assert.ok(appDock.includes('target="_blank"')&&appDock.includes('noopener noreferrer'),'App page must open safely in new tab');
assert.ok(appDock.includes("function minimize()")&&appDock.includes("function close()"),'Popup minimize/close behavior missing');
assert.ok(appDockCss.includes('.hk-dock-pole')&&appDockCss.includes('right:'),'Red pole must be anchored to right');
assert.ok(appDock.includes('app.native'),'Unverified integrations must not masquerade as working apps');
assert.ok(appDock.includes("id!=='radio'")&&appDock.includes('frames.delete(id)'), 'Inactive apps should not persist after switching; radio alone may remain active');
assert.ok(appDock.includes("aria-controls','hk-app-window'"),'Launcher buttons must identify their panel');
assert.ok(appDock.includes("aria-pressed','false'"),'Launcher buttons must expose their selected state');
assert.ok(appDock.includes("url:'https://bible.heavenlykey.org/study-extensions.html'"),'Bible Study must route to the dedicated study extension, not the general Bible homepage');
assert.ok(appDock.includes("new URL(active.url,location.href).href"),'Share URL must be absolute for international visitors');
assert.ok(appDock.includes('navigator.share')&&appDock.includes('navigator.clipboard'),'Share and copy fallback must remain supported');
assert.ok(appDock.includes("if(app.id==='assistant')"),'Assistant launch must prefer the approved first-party widget');
assert.ok(appDock.includes('iframe')&&appDock.includes("referrerPolicy='strict-origin-when-cross-origin'"),'External app frames must keep the privacy policy');
assert.ok(appDockCss.includes('.hk-app-minimized[hidden]'),'Minimized app restore control must honor hidden state');



assert.equal((appDock.match(/[{]id:'(?:radio|assistant|bible|social|walk|study|eternity)'/g)||[]).length,7,'Dock must have exactly seven approved apps');
assert.ok(appDock.includes("id:'assistant'")&&appDock.includes("launcher.click()"),'Assistant tab must open the existing approved assistant');
assert.ok(appDock.includes("window.open('https://wa.me/")||appDock.includes("navigator.share"),'App-specific sharing is required');
assert.ok(appDock.includes("frame.allow='autoplay; clipboard-write'"),'Radio embedding needs media support');
assert.ok(appDock.includes("bar.setPointerCapture"),'Popup drag must support pointer input');
assert.ok(!/googlesyndication|doubleclick\\.net|adsbygoogle|adservice\\.google/.test(appDock+appDockCss),'The dock must not contain ad integrations');
assert.ok(appDockCss.includes('@media(max-width:720px)'),'Dock must support mobile viewports');

console.log('Homepage QA passed: internal links, unique IDs, image alt, safe tabs, section order, globe and finishing CSS.');
