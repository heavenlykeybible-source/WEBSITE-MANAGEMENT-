import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../site/_worker.js',import.meta.url),'utf8');
const app=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;
const config=async(vars={})=>{
 const response=await app.fetch(new Request('https://meeting.test/api/plans'),{TEAMDB:{},AUTH_SECRET:'fixture-secret-'.repeat(4),...vars},{});
 assert.equal(response.status,200);return response.json();
};
test('registration stays closed by default and the public UI receives that setting',async()=>{
 assert.equal((await config()).registrationOpen,false);
 assert.equal((await config({MEETINGSPACE_PRIVATE_PREVIEW:'1'})).registrationOpen,false);
});
test('only explicit public mode enables registration controls',async()=>{
 const result=await config({MEETINGSPACE_PRIVATE_PREVIEW:'0'});
 assert.equal(result.registrationOpen,true);assert.ok(result.plans.length);assert.equal(result.currency,'NGN');
 assert.equal(JSON.stringify(result).includes('fixture-secret'),false);
});
