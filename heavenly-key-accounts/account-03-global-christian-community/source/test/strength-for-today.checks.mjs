import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');test('Strength for Today is linked from homepage and sidebar',()=>{assert.match(read('index.html'),/href="strength-for-today\.html"/);assert.match(read('global-social-sidebar.js'),/strength-for-today\.html/)});test('devotional has 12 categories and required actions',()=>{const html=read('strength-for-today.html');for(const topic of ['Revival & Spiritual Fire','Holiness & Righteousness','Hope & Encouragement','Prayer & Intercession','Faith & God’s Promises','Salvation & Eternity','Evangelism & Missions','Marriage & Family','Youth & Purpose','Christian Growth','Wisdom & Decisions','End-time & Rapture Readiness'])assert.ok(html.includes(topic),topic);for(const id of ['surprise','save','copy','download','feed','external','members'])assert.ok(html.includes('id="'+id+'"'),id);assert.match(html,/Together we take Christ to the Nations of the World/)});
import vm from 'node:vm';
test('inline devotional script parses as valid JavaScript',()=>{const html=read('strength-for-today.html');const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];assert.ok(scripts.length>0,'inline script exists');for(const [,script] of scripts)new vm.Script(script,{filename:'strength-for-today.html'});});
test('premium feed publishing uses a single supported posting handler',()=>{const html=read('strength-for-today.html'),studio=read('strength-share-studio.js');assert.equal((html.match(/\$\('feed'\)\.onclick/g)||[]).length,0);assert.equal((studio.match(/\$\('feed'\)\.onclick/g)||[]).length,1);for(const token of ["request('/api/posts','POST'","postFormat:format","visibility:'public'"])assert.ok(studio.includes(token),token);});
test('member messages require an accepted request',()=>{const html=read('strength-for-today.html');for(const token of ["request('/api/discover?q='","request('/api/messages/requests','POST'","convo.status==='accepted'","convo.status==='requested'","clientRequestId:crypto.randomUUID()","id===selfId"])assert.ok(html.includes(token),token);});
test('single image studio preserves archive and favorites and avoids upload',()=>{const html=read('strength-for-today.html'),studio=read('strength-share-studio.js');for(const token of ['Devotional Topic Library','archiveList.append','id="favorite"','function readFavorites()'])assert.ok(html.includes(token),token);for(const token of ['canvas.toBlob','URL.createObjectURL','URL.revokeObjectURL','navigator.share'])assert.ok(studio.includes(token),token);assert.ok(!studio.includes("fetch('/api/media/upload'"));assert.equal((html.match(/\$\('download'\)\.onclick/g)||[]).length,0);assert.equal((studio.match(/\$\('download'\)\.onclick/g)||[]).length,1);});
test('past daily selections are date-addressable and honestly labeled as rotating content',()=>{const html=read('strength-for-today.html');for(const token of ['Past Daily Selections','These are repeated selections','historyDate.type=\'date\'','historyOpen.onclick=','date.getUTCFullYear()'])assert.ok(html.includes(token),token);});

test('on-device audio narration offers accessible playback without microphone or upload',()=>{const html=read('strength-for-today.html');for(const id of ['listen-strength','pause-strength','stop-strength','audio-status'])assert.ok(html.includes('id="'+id+'"'),id);for(const token of ['SpeechSynthesisUtterance','speechSynthesis.speak','speechSynthesis.cancel','speechSynthesis.pause','speechSynthesis.resume','selected[1]','selected[2]'])assert.ok(html.includes(token),token);});

test('Daily Manna has both premium image sizes and branded social sharing',()=>{
 const page=read('strength-for-today.html'),script=read('strength-share-studio.js');
 for(const id of ['manna-image-size','manna-image-preview','manna-download-image','manna-share-image','manna-copy-caption','manna-network-format'])assert.ok(page.includes('id="'+id+'"'),id);
 for(const expected of ['1080 × 1920','1080 × 1440','design_card','premium_text'])assert.ok(page.includes(expected),expected);
 for(const expected of ['GLOBAL CHRISTIAN SOCIAL NETWORK','www.global.heavenlykey.org','Join the Global Christian Social Network www.global.heavenlykey.org','navigator.share','navigator.canShare','canvas.toBlob','URL.revokeObjectURL',"'image/png'", "postFormat:format"])assert.ok(script.includes(expected),expected);
 new vm.Script(script,{filename:'strength-share-studio.js'});
});

test('premium Daily Manna studio includes four usable portrait themes and both image layouts',()=>{const page=read('strength-for-today.html'),script=read('strength-share-studio.js');for(const theme of ['royal','crimson','midnight','ivory']){assert.ok(page.includes('value="'+theme+'"'),theme);assert.ok(script.includes(theme+':{'),theme)}assert.ok(page.includes('id="manna-theme"'));assert.ok(script.includes("themeSelect?.addEventListener('change',refresh)"));new vm.Script(script,{filename:'strength-share-studio.js'});});

test('every Daily Manna topic has a unique automatic premium colour design',()=>{const page=read('strength-for-today.html'),studio=read('strength-share-studio.js');const m=page.match(/const DAILY_MANNA_THEMES=(\[[^;]+\]);window/);assert.ok(m,'topic themes');const themes=JSON.parse(m[1]);assert.equal(themes.length,12);assert.equal(new Set(themes.map(t=>t.middle)).size,12);assert.ok(page.includes('value="topic"'));assert.ok(page.includes("document.documentElement.style.setProperty"));assert.ok(studio.includes("window.DAILY_MANNA_THEMES?.[current]"));new vm.Script(studio,{filename:'strength-share-studio.js'});});

test('every selection refreshes the premium card and stops active audio',()=>{const html=read('strength-for-today.html'),studio=read('strength-share-studio.js');assert.ok(html.includes("document.dispatchEvent(new CustomEvent('daily-manna-topic-changed'"));assert.ok(html.includes("document.addEventListener('daily-manna-topic-changed',()=>{stopStrengthAudio()"));assert.ok(studio.includes("document.addEventListener('daily-manna-topic-changed',()=>{refresh()"));});

test('all 24 topic and portrait-size combinations generate branded PNGs',async()=>{
 const html=read('strength-for-today.html'),src=read('strength-share-studio.js');
 const items=JSON.parse(html.match(/const items=(\[[\s\S]*?\]);const DAILY_MANNA_THEMES=/)[1]);
 const themes=JSON.parse(html.match(/const DAILY_MANNA_THEMES=(\[[^;]+\]);window/)[1]);
 assert.equal(items.length,12);
 for(let i=0;i<items.length;i++)for(const shape of ['vertical','facebook']){
  const elements=new Map(),paint=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{value:id==='manna-image-size'?shape:id==='manna-theme'?'topic':'design_card',style:{},addEventListener(){},textContent:''});return elements.get(id)};
  const context={font:'20px Arial',createLinearGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},arc(){},stroke(){},fillText(value){paint.push(value)},measureText(value){const size=Number(this.font.match(/(\d+)px/)?.[1]||20);return {width:value.length*size*.48}}};
  const document={getElementById:element,createElement(tag){return tag==='canvas'?{getContext:()=>context,toBlob:cb=>cb({type:'image/png'})}:{click(){},remove(){}}},body:{append(){}},addEventListener(){}};
  const sandbox={document,window:{DAILY_MANNA_THEMES:themes,addEventListener(){}},items,current:i,navigator:{},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},File:class{},confirm:()=>true,authenticated:async()=>true,request:async()=>({}),setTimeout};
  const instrumented=src.replace(/\}\)\(\);\s*$/,'return {renderImage};})();');
  const module=vm.runInNewContext(instrumented,sandbox,{timeout:2000});
  const rendered=await module.renderImage();
  assert.equal(rendered.w,1080,items[i][0]);
  assert.equal(rendered.h,shape==='vertical'?1920:1440,items[i][0]);
  assert.ok(paint.includes('www.global.heavenlykey.org'),items[i][0]);
  assert.ok(paint.some(x=>x.includes(items[i][1])),items[i][0]);
 }
});

test('right-sidebar authorised KJV Bible has premium inline reading, reference styling and share controls',()=>{
 const sidebar=read('global-social-sidebar.js'),reader=read('social-mini-bible.js'),css=read('global-social-current.css');
 assert.ok(sidebar.includes("aside.append(bible)"));
 assert.ok(sidebar.includes("import('./social-mini-bible.js')"));
 for(const value of ['Authorised King James Version','Psalms', 'loadBook(23,1)','Bible Dictionary','Concordance','Copy Verse','Other Networks','Post to Network','Send to Member','/api/posts','/api/me'])assert.ok(reader.includes(value),value);
 assert.ok(css.includes('gc-bible-reference')&&css.includes('#791c39'));
 new vm.Script(reader.replace('export function mountMiniBible','function mountMiniBible'),{filename:'social-mini-bible.js'});
});

test('right-sidebar Bible provides all 66 valid book selectors and fetches verses on demand',()=>{const source=read('social-mini-bible.js');const books=JSON.parse(source.match(/const BOOKS=(\[[^;]+\]);/)[1]);assert.equal(books.length,66);assert.equal(new Set(books.map(item=>item[1])).size,66);for(const token of ['loadBook(23,1)','fillVerses','isPlaceholder','cache:',"'/api/posts'",'navigator.share'])assert.ok(source.includes(token),token);});
