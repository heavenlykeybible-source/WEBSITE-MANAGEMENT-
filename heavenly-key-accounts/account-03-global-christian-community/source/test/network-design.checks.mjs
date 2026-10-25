import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

const source=readFileSync(new URL('../public/network-design.js',import.meta.url),'utf8');
function fixture(){
 const {document,window}=parseHTML('<html><body data-page="home"><header class="top"><nav class="nav"><a class="brand"><span class="brand-name">Global Christian Social Network</span></a><div class="authbar"></div></nav></header><main id="page-root"><div class="social-layout"><nav class="social-rail"><a class="rail-link" href="groups.html">Groups</a></nav><section class="social-stream"><section class="gc-visitor-banner"><img src="assets/global-christian-social-network-approved-banner.jpeg"><div class="gc-visitor-copy"><div class="gc-welcome-features"><p>Real existing welcome copy</p></div><div class="gc-welcome-invitation"><a href="account.html#register">Join</a></div></div></section><button class="composer-prompt">Post</button></section><aside class="social-sidebar"></aside></div></main><footer class="community-footer"><aside aria-label="Eternity in View">I say yes to Jesus</aside></footer></body></html>');
 const listeners={},microtasks=[];let opened=0;document.querySelector('.composer-prompt').addEventListener('click',()=>opened++);
 const context={document,URLSearchParams,location:{href:'https://global.heavenlykey.org/index.html',search:''},queueMicrotask:fn=>microtasks.push(fn),matchMedia:()=>({matches:false,addEventListener(){}}),window:{addEventListener:(name,fn)=>listeners[name]=fn}};
 vm.runInNewContext(source,context);
 const emit=detail=>{listeners['hk-community-view-ready']({detail});while(microtasks.length)microtasks.shift()();};
 return {document,context,listeners,microtasks,emit,opened:()=>opened};
}
test('guest composition preserves the approved image, welcome copy and sign-in route',()=>{
 const f=fixture(),banner=f.document.querySelector('.gc-visitor-banner'),image=banner.querySelector('img');
 f.emit({page:'home',session:null});
 assert.equal(banner.parentElement.className,'social-layout');assert.equal(banner.querySelector('img'),image);assert.match(image.src,/approved-banner\.jpeg$/);
 assert.ok(banner.querySelector('.network-welcome-details .gc-welcome-features'));assert.match(banner.textContent,/Real existing welcome copy/);
 assert.equal(banner.querySelector('a').getAttribute('href'),'account.html#register');assert.equal(f.document.querySelector('.network-member-welcome'),null);
 assert.equal(f.document.querySelector('.network-header-create').getAttribute('href'),'/account.html#register');
});
test('member header and hero use actual identity, forward creating posts and retain ACTIVE ownership',()=>{
 const f=fixture();f.document.querySelector('.gc-visitor-banner').remove();const active=f.document.createElement('section');active.className='gc-active-section';f.document.querySelector('.social-stream').prepend(active);
 const session={user:{userId:5},profile:{displayName:'Emmanuel <script>safe text</script>',profilePhotoKey:'https://untrusted.invalid/image'}};
 f.emit({page:'home',session});assert.equal(active.parentElement.className,'social-layout');assert.equal(f.document.querySelector('.network-wide-active'),active);
 assert.match(f.document.querySelector('.network-member-welcome').textContent,/Emmanuel <script>safe text<\/script>/);assert.equal(f.document.querySelector('.network-member-welcome script'),null);
 assert.ok(f.document.querySelector('.reference-member img').src.endsWith('/assets/default-human-avatar.svg'));
 f.document.querySelector('.network-header-create').click();f.document.querySelector('.network-hero-create').click();assert.equal(f.opened(),2);
});
test('repeated views retain one shell, one footer, existing navigation and the salvation invitation',()=>{
 const f=fixture();for(let i=0;i<3;i++)f.emit({page:'home',session:null});
 for(const name of ['network-search','network-header-create','network-rail-mission','network-footer-top','network-welcome-details'])assert.equal(f.document.querySelectorAll('.'+name).length,1,name);
 assert.equal(f.document.querySelector('.social-rail .rail-link').textContent,'Groups');assert.match(f.document.querySelector('.community-footer [aria-label="Eternity in View"]').textContent,/I say yes/);
 f.emit({page:'groups',session:null});assert.equal(f.document.body.classList.contains('network-home'),false);assert.equal(f.document.querySelectorAll('.network-search').length,1);
});
test('a session change invalidates a queued render',()=>{
 const f=fixture();f.listeners['hk-community-view-ready']({detail:{page:'home',session:{user:{userId:4},profile:{displayName:'Old session'}}}});f.listeners['hk-care-session']();while(f.microtasks.length)f.microtasks.shift()();assert.equal(f.document.querySelector('.network-member-welcome'),null);
});
test('every public HTML page loads the shared design and the new module is part of frontend validation',()=>{
 for(const name of readdirSync(new URL('../public/',import.meta.url)).filter(x=>x.endsWith('.html'))){const html=readFileSync(new URL('../public/'+name,import.meta.url),'utf8');assert.ok(html.includes('/network-design.css?v=20261025-royal1'),name);assert.ok(html.includes('/network-design.js?v=20261025-royal1'),name);}
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));assert.ok(pkg.scripts.frontend.includes('node --check public/network-design.js'));
});
