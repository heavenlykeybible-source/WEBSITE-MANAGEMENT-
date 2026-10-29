import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/app-device-guide.js', import.meta.url), 'utf8');
const sha = 'a'.repeat(64);

async function simulate({device='android',userAgent='Mozilla/5.0 (Linux; Android 12)',available=true,app='all-in-one'}={}) {
 const downloads=[],statuses=[],requests=[],links=[],listeners={};
 const open={href:null,textContent:'',insertAdjacentElement(_position,link){links.push(link)}};
 const heading={textContent:''};
 const info={textContent:'',setAttribute(_name,_value){},get innerText(){return this.textContent}};
 const install={hidden:true,addEventListener(){}};
 const document={
  title:'',
  getElementById(id){return id==='open'?open:id==='install'?install:null},
  querySelector(selector){return selector==='.small'?info:selector==='h1'?heading:null},
  createElement(tag){return {
    tag,hidden:false,setAttribute(){},href:'',textContent:'',
  }},
  head:{append(){}}
 };
 const origin='https://apps.heavenlykey.org';
 const location={origin,protocol:'https:',search:'?app='+app,pathname:'/download/'+device+'/',assign(url){downloads.push(url)}};
 const window={location,addEventListener(event,callback){listeners[event]=callback}};
 const navigator={userAgent,maxTouchPoints:0};
 const fetch=async (url,options={})=>{
  requests.push({url,method:options.method||'GET'});
  if(url==='/app-downloads.json')return {
   ok:true,async json(){return {'all-in-one':{name:'All-in-One',url:origin+'/experience.html'},'walk-with-god':{name:'Walk With God',url:origin+'/walk-offline.html'}}}
  };
  if(url==='/api/native-download/'+app+'/'+device){
   return {ok:available,headers:new Headers(available?{
    'content-type':device==='android'?'application/vnd.android.package-archive':device==='mac'?'application/x-apple-diskimage':'application/msix',
    'content-length':'12345','x-release-sha256':sha
   }:{})};
  }
  throw Error('Unexpected fetch: '+url);
 };
 vm.runInNewContext(script,{document,window,location,navigator,fetch,URL,URLSearchParams,Headers,console});
 // initialize is async; allow both awaited network stages to settle.
 for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));
 return {downloads,status:info.textContent,open,links,requests,heading};
}

test('verified Android APK starts automatically on Android and links to correct app',async()=>{
 const r=await simulate();
 assert.deepEqual(r.downloads,['/api/native-download/all-in-one/android']);
 assert.equal(r.open.href,'https://apps.heavenlykey.org/experience.html');
 assert.equal(r.links.find(x=>x.href===r.downloads[0])?.hidden,false);
});
test('verified app-specific APK downloads the selected app only',async()=>{
 const r=await simulate({app:'walk-with-god'});
 assert.deepEqual(r.downloads,['/api/native-download/walk-with-god/android']);
 assert.equal(r.open.href,'https://apps.heavenlykey.org/walk-offline.html');
});
test('the same Android QR on iPhone never triggers an Android installer',async()=>{
 const r=await simulate({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'});
 assert.equal(r.downloads.length,0);
 assert.match(r.status,/different device/i);
});
test('unpublished or unverified package never initiates a native download',async()=>{
 const r=await simulate({available:false});
 assert.equal(r.downloads.length,0);
 assert.equal(r.links[0]?.hidden,true);
});
test('iPhone guide offers web app rather than pretending an IPA download exists',async()=>{
 const r=await simulate({device:'iphone',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'});
 assert.equal(r.downloads.length,0);
 assert.match(r.status,/Safari/i);
 assert.equal(r.open.href,'https://apps.heavenlykey.org/experience.html');
});
