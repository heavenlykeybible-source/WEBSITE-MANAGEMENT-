import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
class Element {
 constructor(tag,text='',className=''){this.tag=tag;this.textContent=text;this.className=className;this.children=[];this.attributes={};this.parentElement=null;this.dataset={};const classes=new Set();this.classList={toggle:(k,on)=>on?classes.add(k):classes.delete(k),remove:(...ks)=>ks.forEach(k=>classes.delete(k)),contains:k=>classes.has(k)};}
 append(...items){for(const n of items){n.remove();n.parentElement=this;this.children.push(n);}}
 after(n){n.remove();const p=this.parentElement;n.parentElement=p;p.children.splice(p.children.indexOf(this)+1,0,n);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children=p.children.filter(n=>n!==this);this.parentElement=null;}}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];}
 querySelectorAll(selector){return this.children.flatMap(n=>[...((selector.startsWith('.')?n.className.split(' ').includes(selector.slice(1)):n.tag===selector)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
function welcome(session,page='home'){
 const start=source.indexOf('function communityWelcome('),end=source.indexOf('function mountReferenceFrame(',start);
 return vm.runInNewContext(source.slice(start,end)+'\ncommunityWelcome();',{session,page,el:(...args)=>new Element(...args.map(x=>x??''))});
}
function fixture(){
 const listeners={},body=new Element('body');body.dataset.page='home';
 const stream=new Element('main'),heading=new Element('header','','stream-heading'),active=new Element('section','','gc-active-section');
 const banner=welcome(null);stream.append(heading,banner,active);
 const document={body,querySelector:s=>s==='.social-stream'?stream:null};
 vm.runInNewContext(readFileSync(new URL('../public/approved-home-layout.js',import.meta.url),'utf8'),{document,window:{addEventListener:(k,f)=>listeners[k]=f}});
 return {emit:(name,detail)=>listeners[name]({detail}),body,stream,heading,active,banner};
}

test('every guest receives the approved banner, encouraging cards and real registration/sign-in destinations',()=>{
 for(let i=0;i<2;i++){
  const banner=welcome(null),image=banner.children[0],copy=banner.children[1];
  assert.equal(image.src,'assets/global-christian-community-approved-banner.jpeg');
  assert.equal(image.width,1536);assert.equal(image.height,614);assert.equal(image.fetchPriority,'high');
  assert.equal(banner.attributes['aria-labelledby'],copy.querySelector('h2').id);
  assert.equal(copy.querySelectorAll('.gc-welcome-feature').length,3);
  assert.match(copy.querySelector('.gc-welcome-intro').textContent,/grow together in Christ/);
  const [join,login]=copy.querySelectorAll('a');
  assert.equal(join.textContent,'Join the Community');assert.equal(join.href,'account.html#register');
  assert.equal(login.textContent,'Sign In');assert.equal(login.href,'account.html');
  assert.equal(copy.children.at(-1).className,'gc-welcome-invitation');
 }
});

test('authenticated members never construct the visitor banner or its image',()=>{
 assert.equal(welcome({user:{userId:7}}),null);
 assert.notEqual(welcome({user:{}}),null,'Only an actual authenticated user hides the invitation');
});

test('other public views preserve their compact invitation and working registration link',()=>{
 const banner=welcome(null,'groups');
 assert.equal(banner.children.length,3);assert.equal(banner.attributes['aria-labelledby'],undefined);
 assert.equal(banner.children[1].children[0].href,'account.html#register');
 assert.equal(banner.querySelectorAll('.gc-welcome-features').length,0);
});

test('guest render is repeatable and does not duplicate or rearrange the welcome content',()=>{
 const f=fixture(),copy=f.banner.children[1],children=[...copy.children];
 for(let i=0;i<2;i++)f.emit('hk-community-view-ready',{page:'home',session:null});
 assert(f.body.classList.contains('gc-approved-guest'));assert.equal(f.stream.children[1],f.banner);
 assert.deepEqual(copy.children,children);assert.equal(copy.querySelectorAll('h2').length,1);
});

test('sign-in hides welcome immediately, member render retains ACTIVE, and sign-out restores the invitation',()=>{
 const f=fixture(),session={user:{userId:7}};
 f.emit('hk-community-view-ready',{page:'home',session:null});
 f.emit('hk-care-session',session);
 assert(f.body.classList.contains('gc-approved-member'));assert(!f.body.classList.contains('gc-approved-guest'));
 f.emit('hk-community-view-ready',{page:'home',session});
 assert.equal(f.stream.querySelector('.gc-visitor-banner'),null);assert.equal(f.stream.children[1],f.active);
 f.emit('hk-care-session',null);f.stream.append(welcome(null));
 f.emit('hk-community-view-ready',{page:'home',session:null});
 assert(f.body.classList.contains('gc-approved-guest'));assert.equal(f.stream.children[1].className,'gc-visitor-banner');
 f.emit('hk-community-view-ready',{page:'groups',session:null});
 assert(!f.body.classList.contains('gc-approved-guest'));assert(!f.body.classList.contains('gc-approved-member'));
});

test('home loads current welcome assets and CSS makes guest/member sections mutually exclusive',()=>{
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert(html.includes('app.js?v=20261021-noai1'));
 for(const file of ['approved-home-layout.js','approved-home-layout.css'])assert(html.includes(file+'?v=20261021-welcome3'));
 const css=readFileSync(new URL('../public/approved-home-layout.css',import.meta.url),'utf8');
 assert(css.includes('.gc-approved-member .gc-visitor-banner{display:none!important}'));
 assert(css.includes('.gc-approved-guest .gc-active-section{display:none!important}'));
 assert(css.includes('@media(max-width:420px)'));
 assert(source.includes("location.hash==='#register'?'register':'login'"));
 assert(source.includes("navigate(me.user.status==='restricted'?'safety.html':'index.html')"));
});
