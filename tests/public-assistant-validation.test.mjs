import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../public-assistant/worker.mjs';
for(const body of ['null','[]','true','42','"hello"'])test('Assistant rejects non-object JSON: '+body,async()=>{
 const response=await worker.fetch(new Request('https://assistant.example/v1/assistant',{method:'POST',headers:{Origin:'https://apps.heavenlykey.org','Content-Type':'application/json'},body}),{});
 assert.equal(response.status,400);
 assert.equal(response.headers.get('access-control-allow-origin'),'https://apps.heavenlykey.org');
 assert.deepEqual(await response.json(),{error:'Enter a message'});
});
test('Valid requests retain a readable missing-provider response',async()=>{
 const response=await worker.fetch(new Request('https://assistant.example/v1/assistant',{method:'POST',headers:{Origin:'https://apps.heavenlykey.org','Content-Type':'application/json'},body:JSON.stringify({message:'Hello'})}),{});
 assert.equal(response.status,503);assert.match((await response.json()).error,/configuration/);
});
