import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as DC from '../public/design-cards.js';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const take=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function fixture(existing=null){
 const {document,window}=parseHTML('<html><body><main id="root"></main></body></html>');
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this._value??this.querySelector('option')?.value??'';},set(v){this._value=String(v);}});
 window.HTMLTextAreaElement.prototype.setSelectionRange=function(a,b){this.selectionStart=a;this.selectionEnd=b;};
 const root=document.querySelector('main'),saved=new Map(),requests=[];
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
 const context={viewDirty:false,DC,document,window,el,session:{user:{userId:1,status:'active'}},root,requireSignIn:()=>true,status:(n,v)=>n.textContent=v,localStorage:{setItem:(k,v)=>saved.set(k,v),getItem:k=>saved.get(k),removeItem:k=>saved.delete(k)},queueMicrotask,confirm:()=>true,api:async(path,method,data)=>{requests.push({path,method,data});if(context.fail)throw Error('Connection failed');return {status:context.held?'held':'active'};},mountFeed:async()=>{}};
 vm.createContext(context);
 vm.runInContext(take('function field(','function requireSignIn(')+take('function memberAvatar(','function communityWelcome(')+take('function communityRules(','async function mountFeed(')+take('function composeCard(','async function discoverProfiles(')+'\nthis.composeCard=composeCard;',context);
 root.append(context.composeCard('fellowship',{},existing));
 const form=root.querySelector('form'),dialog=root.querySelector('dialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
 form.reset=()=>{for(const n of form.querySelectorAll('input,textarea,select'))n.value=n.tagName==='SELECT'?n.querySelector('option')?.value||'':'';};
 const event=(node,type)=>node.dispatchEvent(new window.Event(type,{bubbles:true,cancelable:true}));
 const click=node=>event(node,'click');const write=value=>{const n=root.querySelector('.easy-card-write');n.value=value;event(n,'input');return n;};
 return {root,form,dialog,context,saved,requests,event,click,write,async submit(){event(form,'submit');await new Promise(r=>setImmediate(r));},button(label){return [...root.querySelectorAll('button')].find(n=>n.textContent===label);}};
}
test('direct writing preserves node, Unicode, line breaks and cursor across input/change',()=>{
 const f=fixture(),text='Faith 🙏\nHope and love <script>safe text</script>',node=f.write(text),card=node.parentElement;
 node.selectionStart=7;f.event(node,'input');f.event(node,'change');assert.equal(node.parentElement,card);assert.equal(node.selectionStart,7);assert.equal(f.form.querySelector('[name=body]').value,text);assert.equal(f.root.querySelector('script'),null);
});
test('colour, category and advanced options preserve writing and selected design',async()=>{
 const f=fixture(),text='A message of hope';f.write(text);const colour=f.root.querySelectorAll('.easy-design-swatch')[4];f.click(colour);
 assert.equal(f.root.querySelector('.easy-card-write').value,text);assert.equal(colour.getAttribute('aria-pressed'),'true');
 const category=f.form.querySelector('[name=designCategory]');category.value='prayer';f.event(category,'change');assert.equal(f.form.querySelector('[name=palette]').value,'4');
 assert.equal(f.root.querySelector('.composer-customise').hidden,false);assert.equal(f.root.querySelector('.easy-card-extras').open,undefined);
 await f.submit();assert.equal(f.requests[0].data.design.templateId,'card-192');assert.equal(f.requests[0].data.body,text);
});
test('publish without title/category uses existing POST contract; failure keeps writing and draft',async()=>{
 const f=fixture();f.write('Jesus gives hope');f.click(f.button('Save draft'));f.context.fail=true;await f.submit();assert.equal(f.saved.size,1);assert.equal(f.root.querySelector('.easy-card-write').value,'Jesus gives hope');assert.equal(f.button('Publish').disabled,false);
 f.context.fail=false;await f.submit();const r=f.requests[1];assert.equal(r.method,'POST');assert.equal(r.path,'/api/posts');assert.equal(r.data.title,'');assert.equal(r.data.designCategory||null,null);assert.equal(DC.validatePostPresentation(r.data).body,'Jesus gives hope');assert.equal(f.saved.size,0);
});
test('draft autosave/restore/discard preserves the latest message and colour',()=>{
 const f=fixture();f.write('Saved faith');f.click(f.root.querySelectorAll('.easy-design-swatch')[6]);f.click(f.button('Save draft'));f.write('Unsaved');f.click(f.root.querySelectorAll('.easy-design-swatch')[2]);f.click(f.button('Restore draft'));assert.equal(f.root.querySelector('.easy-card-write').value,'Unsaved');assert.equal(f.form.querySelector('[name=palette]').value,'2');f.click(f.button('Discard draft'));assert.equal(f.saved.size,0);assert.equal(f.root.querySelector('.easy-card-write').value,'Unsaved');
});
test('edit loads existing title, scripture and premium colour and saves without destructive changes',async()=>{
 const f=fixture({post_id:42,title:'Existing title',body:'Original message',scripture:'John 3:16',post_format:'design_card',design_settings:JSON.stringify({templateId:'card-1001',alignment:'left',fontSize:'large',size:'portrait',decoration:'bold'})});
 assert.equal(f.root.querySelector('.easy-card-write').value,'Original message');assert.match(f.root.querySelector('.easy-design-label').textContent,/Colour/);f.write('Updated message');await f.submit();const r=f.requests[0];assert.equal(r.path,'/api/posts/42');assert.equal(r.method,'PATCH');assert.equal(r.data.title,'Existing title');assert.equal(r.data.scripture,'John 3:16');assert.equal(r.data.design.templateId,'card-1001');assert.equal(r.data.body,'Updated message');
});
test('all posting methods stay available and format switching retains writing',()=>{
 const f=fixture();f.write('Shared message');for(const format of ['article','video_link','premium_text','design_card']){f.click(f.root.querySelector('.shortcut-'+format));assert.equal(f.form.querySelector('[name=body]').value,'Shared message');assert.equal(f.form.querySelector('[name=postFormat]').value,format);}assert.equal(f.form.querySelector('[name=title]').required,false);
});
