import fs from 'node:fs';import assert from 'node:assert/strict';
const fixture=new URL('./worker-size-fixture.mjs',import.meta.url);fs.writeFileSync(fixture,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {body,coreProposeWorker,WORKER_CODE_LIMIT,LARGE_JSON_LIMIT};');
try{const {body,coreProposeWorker,WORKER_CODE_LIMIT,LARGE_JSON_LIMIT}=await import(fixture.href);assert.equal(WORKER_CODE_LIMIT,1_400_000*5);assert.equal(LARGE_JSON_LIMIT,6*1024*1024*5);
const code='x'.repeat(WORKER_CODE_LIMIT);for(const path of ['/mcp','/api/owner/propose-worker','/api/agent/propose-worker'])assert.equal((await body(new Request('https://room'+path,{method:'POST',body:JSON.stringify({code})}))).code.length,WORKER_CODE_LIMIT);
await assert.rejects(body(new Request('https://room/api/login',{method:'POST',body:JSON.stringify({code})})),e=>e.status===413);
const env={DB:{prepare(sql){let args;return{bind(...a){args=a;return this},async first(){if(sql.includes('cf_connections'))return{id:8,label:'Account 9'};if(sql.includes('COUNT(*)'))return{n:0};return null;},async run(){return{meta:{last_row_id:99,changes:1}}}}}},FILES:{async put(key,value){assert.equal(key,'worker/99/worker.js');assert.equal(Buffer.byteLength(value),WORKER_CODE_LIMIT);}}};
const actor={kind:'agent',agentId:1,a:{can_read:1,can_propose:1}};assert.equal((await coreProposeWorker(env,actor,{connection:'Account 9',name:'existing-worker',code})).status,'waiting');
for(const oversized of [code+'x','é'.repeat(WORKER_CODE_LIMIT/2+1)])await assert.rejects(coreProposeWorker(env,actor,{connection:'Account 9',name:'existing-worker',code:oversized}),e=>e.status===400);
console.log('PASS 5x Worker code/envelope limits, agent and owner routes, UTF-8 byte bounds and unchanged small authentication request limit');
}finally{fs.unlinkSync(fixture);}
