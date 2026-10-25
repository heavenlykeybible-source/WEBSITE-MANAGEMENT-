import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('Login returns members to their intended internal page without allowing external redirects',()=>{const a=source.indexOf('function authDestination('),b=source.indexOf('async function mountAccount()',a);const destination=vm.runInNewContext(source.slice(a,b)+'\nauthDestination;',{URL,URLSearchParams,location:{href:'https://global.heavenlykey.org/account.html',origin:'https://global.heavenlykey.org',search:''}});
for(const path of ['messages.html?conversation=12','groups.html?id=4','spaces.html?slug=church','/profile?id=9'])assert.equal(destination('?next='+encodeURIComponent(path)),'/'+path.replace(/^\//,''));
for(const path of ['https://attacker.example/','//attacker.example/messages','javascript:alert(1)','/api/auth/logout','account.html','https://name:pass@global.heavenlykey.org/messages','/bad/messages.html','\\attacker.example\\messages'])assert.equal(destination('?next='+encodeURIComponent(path)),'index.html');assert.equal(destination(''),'index.html');});

// Exercise the actual composer function with a small DOM adapter. These checks
// cover field movement/focus and draft preservation rather than source strings.
class ComposerNode {
 constructor(tag,text='',className=''){this.tagName=tag;this.textContent=text||'';this.className=className;this.children=[];this.dataset={};this.listeners={};this.value='';this.moves=0;this.hidden=false;this.style={};this.classList={add(){},remove(){}};}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;n.moves++;this.children.push(n);}}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
 after(n){const p=this.parentElement;n.remove();n.parentElement=p;n.moves++;p.children.splice(p.children.indexOf(this)+1,0,n);}
 insertBefore(n,reference){n.remove();n.parentElement=this;n.moves++;const i=this.children.indexOf(reference);this.children.splice(i<0?this.children.length:i,0,n);return n;}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
 setAttribute(k,v){(this.attrs??={})[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 async emit(k){const event={preventDefault(){},stopPropagation(){}};for(const fn of this.listeners[k]||[])await fn(event);if(this['on'+k])await this['on'+k](event);}
 focus(){this.focused=true;}
 closest(){return null;}
 reset(){for(const n of this.all())if(n.name||n.tagName==='textarea')n.value=n.defaultValue||'';}
 contains(n){return this.all().includes(n);}
 querySelectorAll(selector){return this.all().filter(n=>n.className.split(' ').includes(selector.slice(1)));}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 all(){return [this,...this.children.flatMap(n=>n.all())];}
 setRangeText(value,a,b){this.value=this.value.slice(0,a)+value+this.value.slice(b);}
}
async function composerFixture(existing=null){
 const DC=await import('../public/design-cards.js'),store=new Map(),avatars=[];
 const el=(...args)=>new ComposerNode(...args);
 const field=(host,label,name,type='text',opts={})=>{const l=el('label',label),input=el(type==='select'?'select':type==='textarea'?'textarea':'input');input.name=name;input.required=!!opts.required;input.value=opts.options?.[0]?.[0]||'';input.defaultValue=input.value;input.selectionStart=input.selectionEnd=0;l.append(input);host.append(l);return input;};
 const context={DC,el,field,Math,JSON,viewDirty:false,session:{user:{userId:7},profile:{displayName:'Member',profilePhotoKey:'member-photo'}},memberAvatar:(name,key)=>{avatars.push(key);return el('img');},communityRules:()=>el('aside'),designCard:()=>{const card=el('section'),inner=el('div','','dc-inner');card.append(inner);return card;},expandableText:()=>el('p'),premiumStudioText:()=>el('section'),videoPost:()=>el('section'),STUDIO_THEMES:[['Default']],studioTheme:()=>0,studioBody:s=>s.replace(/^\[theme=\d\]\n/,''),status:(n,t)=>n.textContent=t,requireSignIn:()=>true,confirm:()=>false,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},queueMicrotask(){}};
 const start=source.indexOf('function composeCard('),end=source.indexOf('async function discoverProfiles',start);
 const compose=vm.runInNewContext(source.slice(start,end)+'\ncomposeCard;',context),card=compose('fellowship',{},existing),nodes=()=>card.all();
 context.root=el('section');context.mountFeed=async()=>{};return {context,card,store,avatars,nodes,field:name=>nodes().find(n=>n.name===name),form:nodes().find(n=>n.tagName==='form'),button:label=>nodes().find(n=>n.tagName==='button'&&n.textContent===label)};
}
test('Composer keeps optional fields collapsed and preserves title focus while typing an article',async()=>{
 const f=await composerFixture(),format=f.field('postFormat'),title=f.field('title'),category=f.field('designCategory');
 assert.equal(category.parentElement.parentElement.tagName,'details');assert.equal(category.required,false);assert.equal(title.parentElement.parentElement.tagName,'details');assert.equal(f.avatars[0],'member-photo');
 format.value='article';await f.form.emit('change');assert.equal(title.required,true);assert.equal(title.parentElement.hidden,false);
 title.focus();const moves=title.parentElement.moves;title.value='My article';await f.form.emit('input');await f.form.emit('input');assert.equal(title.parentElement.moves,moves,'Typing must not detach/reinsert the focused field');
 format.value='video_link';await f.form.emit('change');assert.equal(title.required,false);assert.equal(f.field('videoUrl').required,true);
 format.value='premium_text';await f.form.emit('change');assert.equal(f.field('videoUrl').required,false);assert.equal(f.nodes().find(n=>n.className==='premium-studio-toolbar').hidden,false);
});
test('Cancelling a writing guide preserves the current text and optional controls',async()=>{
 const f=await composerFixture();f.field('body').value='Keep my own message';f.field('postGuide').value='reviver-card';const extras=f.nodes().find(n=>n.className==='easy-card-extras');await f.field('postGuide').emit('change');assert.equal(f.field('body').value,'Keep my own message');assert.equal(f.field('postGuide').value,'blank');assert.equal(f.nodes().filter(n=>n.className==='easy-card-extras').length,1);assert.equal(f.field('designCategory').parentElement.parentElement,extras);
});
test('Formatting buttons persist the changed draft without requiring another keystroke',async()=>{
 const f=await composerFixture();f.field('postFormat').value='premium_text';f.field('body').value='Faith';f.field('body').selectionEnd=5;await f.button('Bold').emit('click');const saved=JSON.parse([...f.store.values()][0]);assert.equal(saved.body,'[bold]Faith[/bold]');assert.equal(saved.postFormat,'premium_text');assert.equal(saved.designCategory,'');
});

test('Direct writing and colour changes preserve the text, selection and draft',async()=>{
 const f=await composerFixture(),direct=f.nodes().find(n=>n.className==='easy-card-write');
 direct.value='Faith, hope and love\nA second line';direct.setSelectionRange(5,9);const moves=direct.moves;await direct.emit('input');
 assert.equal(f.field('body').value,direct.value);assert.equal(direct.moves,moves,'Input must not rebuild the editor');assert.equal(JSON.parse([...f.store.values()][0]).body,direct.value);
 const colour=f.nodes().filter(n=>n.className==='easy-design-swatch')[3];await colour.emit('click');
 assert.equal(direct.value,'Faith, hope and love\nA second line');assert.equal(direct.selectionStart,5);assert.equal(direct.selectionEnd,9);assert.equal(JSON.parse([...f.store.values()][0]).design.templateId,'card-144');
 const afterColour=direct.moves;await f.form.emit('change');assert.equal(direct.moves,afterColour,'Unrelated changes must not detach the text editor');
});
test('Restore and discard preserve the distinction between saved draft and live text',async()=>{
 const f=await composerFixture(),direct=f.nodes().find(n=>n.className==='easy-card-write');direct.value='My saved draft';await direct.emit('input');direct.value='Temporary change';await f.button('Restore draft').emit('click');assert.equal(direct.value,'My saved draft');await f.button('Discard draft').emit('click');assert.equal(f.store.size,0);assert.equal(direct.value,'My saved draft');
});

test('Editing a legacy Design Card loads its message, title, Scripture and exact saved theme',async()=>{const f=await composerFixture({post_id:12,post_format:'design_card',title:'Legacy title',body:'Saved message',scripture:'John 3:16',design_category:'faith',design_settings:JSON.stringify({templateId:'card-768',alignment:'left',fontSize:'large',size:'portrait',decoration:'subtle'})});assert.equal(f.nodes().find(n=>n.className==='easy-card-write').value,'Saved message');assert.equal(f.field('title').value,'Legacy title');assert.equal(f.field('scripture').value,'John 3:16');assert.equal(f.field('palette').value,'16');assert.equal(f.field('alignment').value,'left');assert.equal(f.field('size').value,'portrait');});

test('Publish sends the direct text once without a title/category and clears the successful draft',async()=>{
 const f=await composerFixture(),direct=f.nodes().find(n=>n.className==='easy-card-write');direct.value='Hope in Christ';await direct.emit('input');let resolve;const calls=[];f.context.api=(...args)=>{calls.push(args);return new Promise(r=>resolve=r);};const submitting=f.form.emit('submit');await f.form.emit('submit');assert.equal(calls.length,1);assert.equal(calls[0][0],'/api/posts');assert.equal(calls[0][2].body,'Hope in Christ');assert.equal(calls[0][2].title,'');assert.equal(calls[0][2].designCategory,'');resolve({status:'active',postId:1});await submitting;assert.equal(f.store.size,0);assert.equal(direct.value,'');assert.equal(f.button('Publish').disabled,false);
});
test('A failed publication keeps the current message and saved draft for retry',async()=>{
 const f=await composerFixture(),direct=f.nodes().find(n=>n.className==='easy-card-write');direct.value='Keep this draft';await direct.emit('input');f.context.api=async()=>{throw Error('Offline');};await f.form.emit('submit');assert.equal(direct.value,'Keep this draft');assert.equal(JSON.parse([...f.store.values()][0]).body,'Keep this draft');assert.equal(f.button('Publish').disabled,false);
});
