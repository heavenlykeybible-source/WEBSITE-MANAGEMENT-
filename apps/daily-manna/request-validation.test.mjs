import assert from 'node:assert/strict';
import worker from './worker.mjs';
const env={EDITOR_TOKEN:'test-only'};
const send=body=>worker.fetch(new Request('https://manna.test/api/entries',{method:'POST',headers:{authorization:'Bearer test-only','content-type':'application/json'},body}),env);
let r=await send('{not-json');assert.equal(r.status,400,'Malformed JSON must be rejected before database access');
r=await send(JSON.stringify({title:'x'.repeat(60000)}));assert.equal(r.status,400,'Oversized JSON must be rejected before database access');
r=await worker.fetch(new Request('https://manna.test/api/entries'),env);assert.equal(r.status,401,'Private API must reject missing authorization');
console.log('PASS malformed JSON, oversized request, private endpoint authentication');
