import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes(readFileSync(new URL('../src/heavenly-key-ai.ts',import.meta.url),'utf8'),{mode:'transform'});
const ai=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('confidential writing never reaches the AI provider',async()=>{
 let calls=0;
 const env={AI:{run:async()=>{calls++;return {response:'draft'};}}};
 for(const content of ['Email me at person@example.com','Call +234 803 123 4567','password: private-value','4111 1111 1111 1111']){
  await assert.rejects(ai.communityAiDraft(env,{action:'caption',content}),/Remove/);
 }
 assert.equal(calls,0);
});
test('missing, failing and empty providers return an unavailable result',async()=>{
 const input={action:'caption',topic:'Prayer and faith'};
 for(const env of [{},{AI:{run:async()=>{throw Error('private provider error');}}},{AI:{run:async()=>({response:''})}}]){
  const result=await ai.communityAiDraft(env,input);
  assert.equal(result.available,false);
  assert.ok(!JSON.stringify(result).includes('private provider error'));
 }
});
test('successful generation remains a bounded draft requiring member review',async()=>{
 const result=await ai.communityAiDraft({AI:{run:async()=>({response:'x'.repeat(6000)})}},{action:'caption',topic:'Prayer'});
 assert.equal(result.available,true);
 assert.equal(result.requiresReview,true);
 assert.equal(result.draft.length,5200);
});
