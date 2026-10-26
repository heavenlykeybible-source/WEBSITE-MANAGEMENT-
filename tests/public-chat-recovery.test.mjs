import test from 'node:test';import assert from 'node:assert/strict';import worker from '../public-assistant/chat-worker.mjs';
const req=(body,origin='https://apps.heavenlykey.org')=>new Request('https://assistant.example/v1/assistant',{method:'POST',headers:{Origin:origin},body});
const limits=(blocked=false)=>({prepare:()=>({run:async()=>({success:true}),bind(){return this}}),batch:async()=>[{results:blocked?[]:[{count:1}]},{results:[{count:1}]}]});
test('Public chat returns frontend-compatible replies with KJV policy and official knowledge',async()=>{let called=0;const r=await worker.fetch(req('{"message":"What do we believe?"}'),{LIMITS:limits(),AI:{run:async(model,input)=>{called++;assert.match(input.messages[0].content,/King James/);assert.match(input.messages[0].content,/Heavenly Key/);assert.equal(input.messages[1].content,'What do we believe?');return {response:'Test reply'}}}});assert.equal(r.status,200);assert.equal((await r.json()).response,'Test reply');assert.equal(called,1);assert.equal(r.headers.get('access-control-allow-origin'),'https://apps.heavenlykey.org')});
test('Quota prevents inference',async()=>{const r=await worker.fetch(req('{"message":"Hello"}'),{LIMITS:limits(true),AI:{run:()=>{throw Error('must not run')}}});assert.equal(r.status,429)});
test('Untrusted origins, invalid JSON and oversize payloads never reach inference',async()=>{for(const [body,origin,status] of [['{}','https://evil.example',403],['null',undefined,400],['[]',undefined,400],['broken',undefined,400],['x'.repeat(8193),undefined,413]])assert.equal((await worker.fetch(req(body,origin),{})).status,status)});
test('Provider and missing configuration failures are readable and do not leak secrets',async()=>{for(const env of [{},{LIMITS:limits(),AI:{run:async()=>{throw Error('SECRET')}}}]){const r=await worker.fetch(req('{"message":"Hello"}'),env);assert.equal(r.status,503);assert.ok(!(await r.text()).includes('SECRET'))}});
import {PublicChatLimits} from '../public-assistant/quota-object.mjs';
test('Durable quota persists across instances, enforces client and global caps, resets on new day',async()=>{
 let stored;const storage={transaction:async fn=>fn({get:async()=>structuredClone(stored),put:async(_,value)=>{stored=structuredClone(value)}})};
 const originalNow=Date.now;let now=1800000000000;Date.now=()=>now;
 try{
  let object=new PublicChatLimits({storage});
  const check=hash=>object.fetch(new Request('https://limits.internal/check',{method:'POST',body:JSON.stringify({hash})}));
  const hash=n=>n.toString(16).padStart(64,'0');
  for(let i=0;i<30;i++)assert.equal((await check(hash(1))).status,204);
  object=new PublicChatLimits({storage});assert.equal((await check(hash(1))).status,429);
  for(let i=0;i<170;i++)assert.equal((await check(hash(i+2))).status,204);
  assert.equal((await check(hash(999))).status,429);assert.equal(Object.keys(stored.clients).length,171);
  now+=86400000;assert.equal((await check(hash(1))).status,204);assert.equal(stored.count,1);assert.equal(Object.keys(stored.clients).length,1);
 }finally{Date.now=originalNow}
});
test('Durable quota denial prevents Workers AI inference',async()=>{
 let calls=0;const env={LIMITS:{idFromName:()=>1,get:()=>({fetch:async()=>new Response(null,{status:429})})},AI:{run:async()=>{calls++;return {response:'Should not run'}}}};
 assert.equal((await worker.fetch(req('{"message":"Hello"}'),env)).status,429);assert.equal(calls,0);
});
