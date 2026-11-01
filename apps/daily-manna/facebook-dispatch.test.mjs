import assert from 'node:assert/strict';
import {dispatchFacebook} from './worker.mjs';
let state='pending',attempts=0,postId=null;
const one={delivery_id:'delivery-1',entry_id:'entry-1',publish_date:'2026-11-01',title:'The Word',scripture:'John 1:1',body:'Message',prayer:'Prayer',picture_object_key:null,picture_content_type:null};
const DB={prepare(sql){
 let args=[];return {bind(...v){args=v;return this},async all(){
  if(sql.includes("d.destination='facebook'"))return {results:state==='pending'?[one]:[]};
  throw Error('Unexpected query')
 },async run(){
  if(sql.includes("status='skipped'")&&sql.includes("status='pending'")){
   if(state!=='pending')return {meta:{changes:0}};
   state='skipped';attempts++;return {meta:{changes:1}};
  }
  if(sql.includes("status='sent'")){postId=args[0];state='sent';return {meta:{changes:1}}}
  if(sql.includes("status='failed'")){state='failed';return {meta:{changes:1}}}
  throw Error('Unexpected update '+sql)
 }};
}};
const env={DB,FACEBOOK_PAGE_ID:'123',FACEBOOK_PAGE_TOKEN:'secret',MANNA_PUBLIC_ORIGIN:'https://dailyword.heavenlykey.org',FACEBOOK_FIRST_POST_DATE:'2026-11-01'};
let sendCount=0;
const fake=async()=>{sendCount++;return new Response(JSON.stringify({id:'123_456'}),{status:200})};
let result=await dispatchFacebook(env,fake);
assert.deepEqual(result,{configured:true,processed:1,sent:1,failed:0});
assert.equal(postId,'123_456');
assert.equal(attempts,1);
await dispatchFacebook(env,fake);
assert.equal(sendCount,1,'Never duplicate an already sent post');
state='pending';
result=await dispatchFacebook(env,async()=>new Response(JSON.stringify({error:'denied'}),{status:403}));
assert.equal(result.failed,1);
assert.equal(state,'failed');
assert.equal((await dispatchFacebook(env,fake)).processed,0,'Do not auto retry uncertain failures');
assert.equal((await dispatchFacebook({DB},fake)).configured,false,'Requires Page credentials');
const disabled=await dispatchFacebook({...env,FACEBOOK_FIRST_POST_DATE:''},fake);
assert.equal(disabled.enabled,false,'Unapproved historic backlog cannot post');
assert.equal(sendCount,1,'Historic backlog gate prevents further posts');
console.log('PASS Facebook social outbox: atomic claim, success, no duplicates, failure hold');
