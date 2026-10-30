import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/app-device-guide.js', import.meta.url), 'utf8');
const sha = 'a'.repeat(64);

async function simulate({device='android',userAgent='Mozilla/5.0 (Linux; Android 12)',available=true,app='all-in-one',maxTouchPoints=0}={}) {
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
 const navigator={userAgent,maxTouchPoints};
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

test('verified Android APK requires user click and links to correct app',async()=>{
 const r=await simulate();
 assert.deepEqual(r.downloads,[]);
 assert.equal(r.open.href,'https://apps.heavenlykey.org/experience.html');
 assert.equal(r.links.find(x=>x.href==='/api/native-download/all-in-one/android')?.hidden,false);
});
test('verified app-specific APK link targets only the selected app',async()=>{
 const r=await simulate({app:'walk-with-god'});
 assert.deepEqual(r.downloads,[]);
 assert.equal(r.links.find(x=>x.href==='/api/native-download/walk-with-god/android')?.hidden,false);
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

test('verified Windows MSIX is available without automatic download',async()=>{
 const r=await simulate({device:'windows',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',app:'walk-with-god'});
 assert.deepEqual(r.downloads,[]);
 assert.equal(r.links.find(x=>x.href==='/api/native-download/walk-with-god/windows')?.hidden,false);
 assert.equal(r.open.href,'https://apps.heavenlykey.org/walk-offline.html');
 assert.equal(r.links[0]?.hidden,false);
});
test('verified macOS DMG is available without automatic download',async()=>{
 const r=await simulate({device:'mac',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)'});
 assert.deepEqual(r.downloads,[]);
 assert.equal(r.links.find(x=>x.href==='/api/native-download/all-in-one/mac')?.hidden,false);
});
test('Windows native package cannot auto-start from Android QR scan',async()=>{
 const r=await simulate({device:'windows',userAgent:'Mozilla/5.0 (Linux; Android 13)'});
 assert.deepEqual(r.downloads,[]);
 assert.match(r.status,/different device/i);
});
test('macOS package cannot auto-start on a phone',async()=>{
 const r=await simulate({device:'mac',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'});
 assert.deepEqual(r.downloads,[]);
 assert.match(r.status,/different device/i);
});
test('iPad installation guide never triggers Android or desktop package',async()=>{
 const r=await simulate({device:'ipad',userAgent:'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X)'});
 assert.deepEqual(r.downloads,[]);
 assert.match(r.status,/Safari/i);
});
test('an unavailable Windows MSIX keeps its download button hidden',async()=>{
 const r=await simulate({device:'windows',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',available:false});
 assert.deepEqual(r.downloads,[]);
 assert.equal(r.links[0]?.hidden,true);
});

test('desktop-class iPad browser cannot auto-download a Mac DMG',async()=>{
 const r=await simulate({device:'mac',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)',maxTouchPoints:5});
 assert.deepEqual(r.downloads,[]);
 assert.match(r.status,/different device/i);
});
test('desktop-class iPad browser still receives iPad Safari instructions',async()=>{
 const r=await simulate({device:'ipad',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)',maxTouchPoints:5});
 assert.deepEqual(r.downloads,[]);
 assert.match(r.status,/Safari/i);
});
