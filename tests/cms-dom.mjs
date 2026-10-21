import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{DOMParser,parseHTML}=require(process.env.CMS_DOM_MODULE||'linkedom');
const runtime=fs.readFileSync(new URL('../cms/frame.js',import.meta.url),'utf8'),client=fs.readFileSync(new URL('../cms/editor.js',import.meta.url),'utf8');
const parentContext={DOMParser,URL,crypto,CMS_FRAME:runtime};vm.createContext(parentContext);vm.runInContext(client,parentContext);
const input='<!doctype html><html><head><title>Original title</title><meta http-equiv="refresh" content="600"><base href="https://example.org/"></head><body><header>Community</header><main><h1 onclick="window.originalHandler=true">Welcome</h1><p>Original paragraph</p><a href="/join">Join</a><img src="/old.png" alt="Old"><section><h2>Second section</h2></section></main><footer>Old footer</footer><script>window.applicationStarted=true;</script></body></html>';
const html=parentContext.cmsDocument(input,'https://control.example/s/demo/','test-channel');const {document}=parseHTML(html);
assert.equal(document.querySelector('h1').getAttribute('onclick'),null);assert.equal(document.querySelectorAll('script:not([data-cr-editor])').length,0);assert.equal(document.querySelector('img').getAttribute('src'),'/s/demo/old.png');assert.equal(document.querySelector('meta[http-equiv="refresh"]'),null);
Object.defineProperty(document,'baseURI',{value:'https://control.example/s/demo/'});
const messages=[],handlers={},parent={postMessage:m=>messages.push(m)},window={addEventListener:(event,fn)=>handlers[event]=fn};
const context={document,parent,window,URL,console};vm.createContext(context);vm.runInContext(runtime,context);
function command(action,more={}){handlers.message({source:parent,data:{cms:'test-channel',action,...more}});}
function select(selector){document.querySelector(selector).dispatchEvent(new document.defaultView.Event('click',{bubbles:true,cancelable:true}));}
function output(){command('serialize',{request:1});return messages.filter(m=>m.type==='html').at(-1).html;}
select('h1');assert.equal(messages.at(-1).type,'selection');command('text',{value:'A welcoming community'});assert.equal(document.querySelector('h1').textContent,'A welcoming community');command('add',{kind:'hero'});assert.equal(document.querySelectorAll('section').length,2);command('undo');assert.equal(document.querySelectorAll('section').length,1);command('redo');assert.equal(document.querySelectorAll('section').length,2);
select('footer');command('text',{value:'Updated footer'});select('img');command('image',{src:'https://images.example/new.png',alt:'New image'});select('main > a');command('link',{value:'javascript:alert(1)'});assert.equal(messages.at(-1).type,'error');assert.equal(document.querySelector('main > a').getAttribute('href'),'/s/demo/join');
command('metadata',{title:'Updated SEO title',description:'A new description'});let exported=output();assert.match(exported,/A welcoming community/);assert.match(exported,/Updated footer/);assert.match(exported,/Updated SEO title/);assert.match(exported,/A new description/);assert.match(exported,/originalHandler/);assert.match(exported,/applicationStarted/);assert.match(exported,/http-equiv="refresh"/);assert.match(exported,/href="\/join"/);assert.match(exported,/new.png/);assert.doesNotMatch(exported,/data-cr-editor|data-cr-selected|data-cr-channel|data-cr-urls|data-cr-events|data-cr-script/);
const oldCount=messages.length;handlers.message({source:{},data:{cms:'test-channel',action:'delete'}});assert.equal(messages.length,oldCount);
console.log('PASS visual CMS DOM: document isolation, asset resolution, text, footer, image and metadata edits, section insertion, undo/redo, URL rejection, clean export and message source validation');
