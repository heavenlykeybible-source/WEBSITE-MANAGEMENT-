import assert from 'node:assert/strict';
import {dispatchStudio} from './worker.mjs';
let state='pending',attempts=0,postId=null;
const one={delivery_id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',entry_id:'entry-1',publish_date:'2026-11-01',title:'The Word',scripture:'John 1:1',body:'Message',prayer:'Prayer',picture_object_key:null,picture_content_type:null};
const DB={prepare(sql){
 let args=[];return {bind(...v){args=v;return this},async all(){
  if(sql.includes("d.destination='studio'"))return {results:state==='pending'?[one]:[]};
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
const env={DB,STUDIO_BRIDGE_ORIGIN:'https://studio.heavenlykey.org/',STUDIO_BRIDGE_SECRET:'test-secret',MANNA_PUBLIC_ORIGIN:'https://dailyword.heavenlykey.org',STUDIO_FIRST_POST_DATE:'2026-11-01'};
let sendCount=0;
const fake=async()=>{sendCount++;return new Response(JSON.stringify({ok:true,job_ids:[456]}),{status:200})};
let result=await dispatchStudio(env,fake);
assert.deepEqual(result,{configured:true,processed:1,sent:1,failed:0,blocked:0});
assert.equal(postId,'[456]');
assert.equal(attempts,1);
await dispatchStudio(env,fake);
assert.equal(sendCount,1,'Never duplicate an already sent post');
state='pending';
result=await dispatchStudio(env,async()=>new Response(JSON.stringify({error:'denied'}),{status:403}));
assert.equal(result.failed,1);
assert.equal(state,'failed');
assert.equal((await dispatchStudio(env,fake)).processed,0,'Do not auto retry uncertain failures');
assert.equal((await dispatchStudio({DB},fake)).configured,false,'Requires Studio credentials');
const disabled=await dispatchStudio({...env,STUDIO_FIRST_POST_DATE:''},fake);
assert.equal(disabled.configured,false,'Unapproved historic backlog cannot post');
assert.equal(sendCount,1,'Historic backlog gate prevents further posts');
state='pending';
one.picture_object_key='post-banners/approved-owner-image';
one.studio_media_id=null;
result=await dispatchStudio(env,fake);
assert.equal(result.blocked,1,'An unlinked owner picture must block Studio posting');
assert.equal(result.processed,0);
assert.equal(state,'pending','Owner can link image later without losing the delivery');
one.studio_media_id=88;
result=await dispatchStudio(env,fake);
assert.equal(result.sent,1,'Posting resumes after an existing Studio image is linked');
assert.equal(sendCount,2);

console.log('PASS Studio social outbox: atomic claim, success, no duplicates, failure hold');
