import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/app-device-guide.js',import.meta.url),'utf8');
const origin='https://apps.heavenlykey.org';
const releaseDigest='a'.repeat(64);

function createHarness(search,headStatus=200,headType='application/vnd.android.package-archive'){
 const calls=[];
 const open={href:'',textContent:'',nativeLink:null,insertAdjacentElement(_where,element){this.nativeLink=element;}};
 const status={textContent:'',setAttribute(){}};
 const heading={textContent:''};
 const document={
  title:'',
  getElementById(id){return id==='open'?open:null;},
  querySelector(selector){return selector==='.small'?status:selector==='h1'?heading:null;},
  createElement(tag){return {tag,hidden:false,setAttribute(){},className:'',textContent:'',href:''};},
 };
 const location={search,origin,hostname:'apps.heavenlykey.org',pathname:'/download/android/',protocol:'https:'};
 const navigator={userAgent:'Mozilla/5.0 (Linux; Android 15)',maxTouchPoints:0};
 const window={addEventListener(){}};
 const fetch=async (url,options={})=>{
  calls.push({url,options});
  if(url==='/app-downloads.json')return {ok:true,json:async()=>({'all-in-one':{name:'Heavenly Key All-in-One',url:origin+'/experience.html'}})};
  return {ok:true,status:headStatus,headers:{
   get:key=>({'content-type':headType,'content-length':'4096','x-release-sha256':releaseDigest})[key]??null,
   has:key=>key==='content-range'&&headStatus===206,
  }};
 };
 runInNewContext(source,{document,location,navigator,window,fetch,URL,URLSearchParams});
 return {calls,open,status,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('explicitly empty or duplicate app identifiers fail closed before catalogue requests',async()=>{
 for(const query of ['?app=','?app=all-in-one&app=all-in-one','?app=../downloads']){
  const h=createHarness(query);
  await h.flush();
  assert.equal(h.calls.length,0,query);
  assert.equal(h.open.href,'/downloads.html',query);
  assert.match(h.status.textContent,/cannot be verified/);
 }
});

test('missing app query safely selects the approved all-in-one app',async()=>{
 const h=createHarness('');
 await h.flush();
 assert.equal(h.open.href,origin+'/experience.html');
 assert.equal(h.calls.filter(x=>x.options.method==='HEAD').length,1);
});

test('native package requires complete HTTP 200 response and approved metadata',async()=>{
 for(const response of [206,204]){
  const h=createHarness('?app=all-in-one',response);
  await h.flush();
  assert.equal(h.open.nativeLink?.hidden,true,String(response));
 }
 const success=createHarness('?app=all-in-one');
 await success.flush();
 assert.equal(success.open.nativeLink?.hidden,false);
 const head=success.calls.find(x=>x.options.method==='HEAD');
 assert.equal(head.options.redirect,'error');
 assert.equal(head.options.credentials,'omit');
});

test('native download remains hidden for wrong package MIME type',async()=>{
 const h=createHarness('?app=all-in-one',200,'text/html');
 await h.flush();
 assert.equal(h.open.nativeLink?.hidden,true);
});
