import test from 'node:test';
import assert from 'node:assert/strict';
import {readSubscription,readMonthlyUsage,resolveMeetingAllowance} from '../src/subscription-store.js';
const now=Date.UTC(2026,9,24,12);
function dbFor({subscription=null,used=0}={}){
 const calls=[];
 const db={prepare(sql){return {bind(...args){calls.push({sql,args});return {first:async()=>sql.includes('FROM subscriptions')?subscription:{used}}}}}};
 return {db,calls};
}
test('active subscription and monthly usage resolve a pro allowance',async()=>{
 const {db,calls}=dbFor({subscription:{planId:'pro',status:'active',currentPeriodEnd:now+86400000},used:200});
 const allowance=await resolveMeetingAllowance(db,'owner1',{now});
 assert.equal(allowance.plan.id,'pro');
 assert.equal(allowance.allowed,true);
 assert.equal(allowance.remainingMinutes,5800);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.args[0]==='owner1'));
});
test('expired subscription falls back to free and quota is enforced',async()=>{
 const {db}=dbFor({subscription:{planId:'pro',status:'active',currentPeriodEnd:now-1},used:120});
 const allowance=await resolveMeetingAllowance(db,'owner1',{now});
 assert.equal(allowance.plan.id,'free');
 assert.equal(allowance.allowed,false);
});
test('subscription store requires trusted database and user',async()=>{
 await assert.rejects(readSubscription(null,'owner'),/missing/);
 await assert.rejects(readMonthlyUsage({prepare(){}},''),/missing/);
});

test('corrupt usage does not silently grant a new quota',async()=>{
 const {db}=dbFor({used:'not-a-number'});
 await assert.rejects(readMonthlyUsage(db,'owner1',{now}),/Invalid stored usage/);
});
