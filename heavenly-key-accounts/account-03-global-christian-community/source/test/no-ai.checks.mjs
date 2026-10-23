import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import vm from 'node:vm';

const base=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(join(base,p),'utf8');
function files(path){return readdirSync(join(base,path),{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path+'/'+x.name):[path+'/'+x.name]);}

test('all community runtime source is free of AI widgets, model clients and inference calls',()=>{
 const patterns=[/\/v1\/assistant\b/,/api\.openai\.com/i,/api\.anthropic\.com/i,/generativelanguage\.googleapis/i,/api\.groq\.com/i,/env\s*\.\s*AI\b/,/hkem-public-assistant/,/hk-ai-(?:composer|dialog|search)/,/heavenly-key-ai/];
 const paths=['public','src','scripts','migrations'].flatMap(files).filter(p=>/\.(?:js|ts|html|css|mjs|sql)$/.test(p));
 for(const path of paths){const source=read(path);for(const pattern of patterns)assert(!pattern.test(source),path+' contains '+pattern);}
 assert(!read('wrangler.toml').includes('[ai]'));assert(!/\bAI\s*\??:/.test(read('src/types.ts')));
 assert(read('public/app.js').includes('DC.FEATURED_CARD_PRESETS'));
 assert(read('src/moderation.ts').includes('export function moderateText'));
});

class Element {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.textContent='';this.attributes={};this.classList={add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);}
 prepend(n){this.children.unshift(n);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;}
 getAttribute(k){return this.attributes[k]||null;}
 addEventListener(){}
}
async function runtime(editing=false){
 const body=new Element('body'),main=new Element('main'),footer=new Element('footer'),timers=[],requests=[],messages=[];
 const href='https://global.heavenlykey.org/index.html'+(editing?'?hkem-cms=edit&hkem-session=test-nonce':'');
 const context={window:{opener:editing?{postMessage:(data,origin)=>messages.push({data,origin}),focus(){}}:null,addEventListener(){}},
  document:{body,readyState:'complete',createElement:t=>new Element(t),createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:()=>[],querySelector:s=>s==='main'?main:s==='footer'?footer:null,addEventListener(){},title:'Community'},
  NodeFilter:{SHOW_TEXT:4},location:{href,hostname:'global.heavenlykey.org',pathname:'/index.html'},URL,Map,Set,Math,
  setTimeout:fn=>timers.push(fn),navigator:{},
  fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({content:{fields:[]}})};}
 };
 vm.runInNewContext(read('public/cms-runtime-20261015.js'),context);await timers[0]();
 return{body,footer,requests,messages};
}

test('public CMS runtime loads published content and sharing without creating a chat or making AI calls',async()=>{
 const f=await runtime();assert.equal(f.requests.length,1);
 assert(f.requests[0].url.startsWith('https://heavenlykey-cms-public.emmanuel2026miracle.workers.dev/v1/content?'));
 assert.equal(f.requests[0].options.credentials,'omit');assert.equal(f.body.children.length,0);
 assert.equal(f.footer.children[0].className,'hkem-share-tools');
});

test('visual editor retains authenticated handoff and draft/publish controls after chat removal',async()=>{
 const f=await runtime(true),bar=f.body.children[0];
 assert(bar);assert.equal(f.messages[0].data.type,'hkem-ready');assert.equal(f.messages[0].data.site,'account3');assert.equal(f.messages[0].data.nonce,'test-nonce');
 const save=bar.children.find(n=>n.textContent==='Save draft');assert(save);save.onclick();
 assert.equal(f.messages.at(-1).data.type,'hkem-save');assert.equal(f.messages.at(-1).origin,'https://heavenlykey-control-room.emmanuel2026miracle.workers.dev');
 assert(bar.children.some(n=>n.textContent==='Publish'));assert.equal(f.requests.length,1);
});

test('every page uses the cleaned local footer and external connections allow content but not assistant inference',()=>{
 const pages=files('public').filter(p=>p.endsWith('.html'));let footers=0;
 for(const path of pages){const html=read(path);if(html.includes('hk-standard-footer.js')){footers++;assert(html.includes('hk-standard-footer.js?v=20261021-noai1'),path);}
  for(const [,src]of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)/gi))assert(!/^https?:/i.test(src),path+' executes unpinned external code');
 }
 assert(footers>=10);assert(read('public/index.html').includes('hk-footer-app-promo-20261015.js?v=20261021-noai1'));
 assert(read('public/hk-standard-footer.js').includes('cms-runtime-20261015.js?v=20261021-noai1'));
 const policy=read('public/_headers');assert(policy.includes("connect-src 'self' https://heavenlykey-cms-public.emmanuel2026miracle.workers.dev/v1/content;"));
 assert(!read('public/cms-runtime-20261015.css').includes('hkem-public-assistant'));
});

test('the actual Worker rejects the retired community AI endpoint for every action without invoking a model',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'community-no-ai-'));
 try{
  for(const file of readdirSync(join(base,'src')).filter(p=>p.endsWith('.ts'))){
   const source=stripTypeScriptTypes(read('src/'+file)).replace(/from (["'])\.\/([a-z-]+)\1/g,(_,q,n)=>'from '+q+'./'+n+'.mjs'+q).replace(/from (["'])\.\.\/public\/([a-z-]+\.js)\1/g,(_,q,n)=>'from '+q+pathToFileURL(join(base,'public',n)).href+q);
   writeFileSync(join(directory,file.replace('.ts','.mjs')),source);
  }
  const worker=(await import(pathToFileURL(join(directory,'index.mjs')).href)).default;
  const env={SESSIONS:{get:async()=>null},get AI(){throw Error('A model must never be invoked');}};
  for(const method of ['GET','POST','PATCH','DELETE']){
   const response=await worker.fetch(new Request('https://community.example/api/community-ai',{method}),env);
   assert.equal(response.status,404,method);assert.equal((await response.json()).error.message,'AI features are disabled.');
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
