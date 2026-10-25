import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
test('Login returns members to their intended internal page without allowing external redirects',()=>{const a=source.indexOf('function authDestination('),b=source.indexOf('async function mountAccount()',a);const destination=vm.runInNewContext(source.slice(a,b)+'\nauthDestination;',{URL,URLSearchParams,location:{href:'https://global.heavenlykey.org/account.html',origin:'https://global.heavenlykey.org',search:''}});
for(const path of ['messages.html?conversation=12','groups.html?id=4','spaces.html?slug=church','/profile?id=9'])assert.equal(destination('?next='+encodeURIComponent(path)),'/'+path.replace(/^\//,''));
for(const path of ['https://attacker.example/','//attacker.example/messages','javascript:alert(1)','/api/auth/logout','account.html','https://name:pass@global.heavenlykey.org/messages','/bad/messages.html','\\attacker.example\\messages'])assert.equal(destination('?next='+encodeURIComponent(path)),'index.html');assert.equal(destination(''),'index.html');});

// Exercise the actual composer function with a small DOM adapter. These checks
// cover field movement/focus and draft preservation rather than source strings.
class ComposerNode {
 constructor(tag,text='',className=''){this.tagName=tag;this.textContent=text||'';this.className=className;this.children=[];this.dataset={};this.listeners={};this.value='';this.moves=0;this.hidden=false;}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;n.moves++;this.children.push(n);}}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
 after(n){const p=this.parentElement;n.remove();n.parentElement=p;n.moves++;p.children.splice(p.children.indexOf(this)+1,0,n);}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.append(...nodes);}
 setAttribute(k,v){(this.attrs??={})[k]=v;}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 async emit(k){const event={preventDefault(){}};for(const fn of this.listeners[k]||[])await fn(event);if(this['on'+k])await this['on'+k](event);}
 focus(){this.focused=true;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 all(){return [this,...this.children.flatMap(n=>n.all())];}
 setRangeText(value,a,b){this.value=this.value.slice(0,a)+value+this.value.slice(b);}
}
async function composerFixture(){
 const DC=await import('../public/design-cards.js'),store=new Map(),avatars=[];
 const el=(...args)=>new ComposerNode(...args);
 const field=(host,label,name,type='text',opts={})=>{const l=el('label',label),input=el(type==='select'?'select':type==='textarea'?'textarea':'input');input.name=name;input.required=!!opts.required;input.value=opts.options?.[0]?.[0]||'';input.selectionStart=input.selectionEnd=0;l.append(input);host.append(l);return input;};
 const context={DC,el,field,Math,JSON,session:{user:{userId:7},profile:{displayName:'Member',profilePhotoKey:'member-photo'}},memberAvatar:(name,key)=>{avatars.push(key);return el('img');},communityRules:()=>el('aside'),designCard:()=>el('section'),expandableText:()=>el('p'),premiumStudioText:()=>el('section'),videoPost:()=>el('section'),STUDIO_THEMES:[['Default']],studioTheme:()=>0,studioBody:s=>s.replace(/^\[theme=\d\]\n/,''),status:(n,t)=>n.textContent=t,requireSignIn:()=>true,confirm:()=>false,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},queueMicrotask(){}};
 const start=source.indexOf('function composeCard('),end=source.indexOf('async function discoverProfiles',start);
 const compose=vm.runInNewContext(source.slice(start,end)+'\ncomposeCard;',context),card=compose(),nodes=()=>card.all();
 return {card,store,avatars,nodes,field:name=>nodes().find(n=>n.name===name),form:nodes().find(n=>n.tagName==='form'),button:label=>nodes().find(n=>n.tagName==='button'&&n.textContent===label)};
}
test('Composer keeps optional fields collapsed and preserves title focus while typing an article',async()=>{
 const f=await composerFixture(),format=f.field('postFormat'),title=f.field('title'),category=f.field('designCategory');
 assert.equal(category.parentElement.parentElement.tagName,'details');assert.equal(category.required,false);assert.equal(title.parentElement.hidden,true);assert.equal(f.avatars[0],'member-photo');
 format.value='article';await f.form.emit('change');assert.equal(title.required,true);assert.equal(title.parentElement.hidden,false);
 title.focus();const moves=title.parentElement.moves;title.value='My article';await f.form.emit('input');await f.form.emit('input');assert.equal(title.parentElement.moves,moves,'Typing must not detach/reinsert the focused field');
 format.value='video_link';await f.form.emit('change');assert.equal(title.required,false);assert.equal(f.field('videoUrl').required,true);
 format.value='premium_text';await f.form.emit('change');assert.equal(f.field('videoUrl').required,false);assert.equal(f.nodes().find(n=>n.className==='premium-studio-toolbar').hidden,false);
});
test('Cancelling a writing guide preserves the current text and optional controls',async()=>{
 const f=await composerFixture();f.field('body').value='Keep my own message';f.field('postGuide').value='reviver-card';const extras=f.nodes().find(n=>n.className==='composer-extras');await f.field('postGuide').emit('change');assert.equal(f.field('body').value,'Keep my own message');assert.equal(f.field('postGuide').value,'blank');assert.equal(f.nodes().filter(n=>n.className==='composer-extras').length,1);assert.equal(f.field('designCategory').parentElement.parentElement,extras);
});
test('Formatting buttons persist the changed draft without requiring another keystroke',async()=>{
 const f=await composerFixture();f.field('postFormat').value='premium_text';f.field('body').value='Faith';f.field('body').selectionEnd=5;await f.button('Bold').emit('click');const saved=JSON.parse([...f.store.values()][0]);assert.equal(saved.body,'[bold]Faith[/bold]');assert.equal(saved.postFormat,'premium_text');assert.equal(saved.designCategory,'faith');
});
