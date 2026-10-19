import assert from 'node:assert/strict';
import {aiPost} from './worker-test.mjs';
const original=globalThis.fetch,headers={authorization:'Bearer sk-test-secret-value'};let count=0;
async function check(name,fn){await fn();count++;console.log('PASS '+name)}
const response=(status,obj)=>async()=>new Response(JSON.stringify(obj),{status});
try{
await check('AI network failures become a safe actionable error',async()=>{globalThis.fetch=async()=>{throw new TypeError('connection failed with sk-test-secret-value')};await assert.rejects(aiPost('https://api.openai.com/v1/chat/completions',headers,{}),e=>e.status===502&&e.message.includes('could not be reached')&&!e.message.includes('sk-test'))});
await check('AI requests have a timeout and refuse redirects',async()=>{globalThis.fetch=async(u,init)=>{assert.equal(init.redirect,'error');assert.ok(init.signal);return new Response('{"choices":[]}')};assert.deepEqual(await aiPost('https://api.openai.com/v1/chat/completions',headers,{}),{choices:[]})});
await check('invalid AI keys show a credential error without returning keys',async()=>{globalThis.fetch=response(401,{error:{message:'Incorrect key sk-test-secret-value'}});await assert.rejects(aiPost('https://api.openai.com/v1/chat/completions',headers,{}),e=>e.status===502&&e.message.includes('rejected the API key')&&!e.message.includes('sk-test'))});
await check('AI quota and permission failures have distinct guidance',async()=>{for(const [status,code,expected]of[[403,'insufficient_permissions','permission'],[429,'insufficient_quota','billing'],[429,'rate_limit_exceeded','rate limit'],[404,'model_not_found','model']]){globalThis.fetch=response(status,{error:{code}});await assert.rejects(aiPost('https://api.openai.com/v1/chat/completions',headers,{}),e=>e.status===502&&e.message.includes(expected))}});
await check('provider errors redact credential values before returning details',async()=>{globalThis.fetch=response(400,{error:{message:'Bad request for sk-test-secret-value and sk-another-secret'}});await assert.rejects(aiPost('https://api.openai.com/v1/chat/completions',headers,{}),e=>e.status===502&&!e.message.includes('sk-')&&e.message.includes('[redacted]'))});
await check('AI unreadable and invalid successful responses are rejected clearly',async()=>{for(const value of ['<html>oops</html>','null','[]','"text"']){globalThis.fetch=async()=>new Response(value);await assert.rejects(aiPost('https://api.openai.com/v1/chat/completions',headers,{}),e=>e.status===502)}});
}finally{globalThis.fetch=original}
console.log(count+' AI connection checks passed');
