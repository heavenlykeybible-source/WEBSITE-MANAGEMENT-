import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app-device-guide.js',import.meta.url),'utf8');
class Element{constructor(){this.children=[];this.hidden=false;this.textContent='';}append(...items){this.children.push(...items);}setAttribute(){}insertAdjacentElement(_position,item){this.children.push(item);}}
async function guide({platform='android',packageStatus=200,store,headers={}}={}){
 const open=new Element(),info=new Element(),heading=new Element(),details=new Element(),calls=[];
 const document={title:'',getElementById:id=>({open,'release-details':details}[id]),querySelector:()=>info,createElement:()=>new Element()};
 const fetch=async (path,options)=>{calls.push({path,options});return path==='/app-downloads.json'?new Response(JSON.stringify({'all-in-one':{name:'Heavenly Key',url:'https://apps.heavenlykey.org/experience.html',...(store?{stores:{apple:store}}:{})}})):new Response(null,{status:packageStatus,headers:{'content-type':'application/vnd.android.package-archive','content-length':'100','x-release-sha256':'b'.repeat(64),'x-release-version':'1.0.0','x-release-date':'2026-01-01T00:00:00Z','x-release-min-os':'Android 7.0','x-release-architecture':'universal',...headers}});};
 await vm.runInNewContext(source,{document,fetch,URL,URLSearchParams,location:{search:'?app=all-in-one',pathname:'/download/'+platform+'/',origin:'https://apps.heavenlykey.org'}});
 return {open,info,details,calls};
}
test('verified installer is a native package link with date and requirements',async()=>{
 const {open,details,calls}=await guide();const link=open.children[0];assert.equal(link.hidden,false);assert.match(link.href,/^\/api\/native-download\/all-in-one\/android$/);assert.equal(calls[1].options.method,'HEAD');assert.ok(details.children.some(p=>p.textContent==='Version: 1.0.0'));assert.ok(details.children.some(p=>p.textContent==='Minimum system: Android 7.0'));
});
test('missing, rejected and unavailable packages never become download buttons',async()=>{
 for(const packageStatus of [403,404,503]){const {open}=await guide({packageStatus});assert.equal(open.children[0].hidden,true);}
});
test('iPhone without approved store listing has no fake download or browser shortcut',async()=>{
 const {open,info,calls}=await guide({platform:'iphone'});assert.equal(open.children.length,0);assert.match(info.textContent,/not published/);assert.doesNotMatch(info.textContent,/Add to Home Screen/);assert.equal(calls.length,1);
});
test('only exact official Apple store URL may produce an installation link',async()=>{
 const good='https://apps.apple.com/ng/app/heavenly-key/id123456789';const result=await guide({platform:'iphone',store:good});assert.equal(result.open.children[0].href,good);
 for(const store of ['https://apps.apple.com.evil.test/ng/app/app/id123','http://apps.apple.com/ng/app/app/id123','javascript:alert(1)','https://evil.test/app'])assert.equal((await guide({platform:'iphone',store})).open.children.length,0);
});
