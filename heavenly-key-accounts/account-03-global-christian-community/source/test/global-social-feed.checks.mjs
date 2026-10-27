import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
test('feed pagination prefetches once per button while preserving manual loading',()=>{
 let callback,scan;const watched=[],unwatched=[];
 class IO{constructor(cb){callback=cb}observe(x){watched.push(x)}unobserve(x){unwatched.push(x)}}
 class MO{constructor(cb){scan=cb}observe(){}}
 const root={};let buttons=[];const document={querySelector:s=>s==='#page-root'?root:null,querySelectorAll:()=>buttons};
 const button=()=>({isConnected:true,disabled:false,clicks:0,click(){this.clicks++}});
 const first=button();buttons=[first];vm.runInNewContext(readFileSync('public/global-social-feed.js','utf8'),{window:{IntersectionObserver:IO},IntersectionObserver:IO,MutationObserver:MO,document,WeakSet});
 scan();assert.deepEqual(watched,[first]);callback([{target:first,isIntersecting:true}]);assert.equal(first.clicks,1);assert.deepEqual(unwatched,[first]);
 scan();assert.deepEqual(watched,[first]);const next=button();buttons=[next];scan();assert.deepEqual(watched,[first,next]);
 next.disabled=true;callback([{target:next,isIntersecting:true}]);assert.equal(next.clicks,0);next.disabled=false;next.click();assert.equal(next.clicks,1);
});
