import test from 'node:test';
import assert from 'node:assert/strict';
import {PLANS,getPlan,activeEntitlement,canStartMeeting,canJoinMeeting,effectiveMeetingMinutes} from '../src/subscription-plans.js';
test('plans define increasing capacity without exceeding P2P safety cap',()=>{
 assert.equal(PLANS.free.participants,3);
 assert.equal(PLANS.starter.participants,6);
 assert.equal(PLANS.pro.participants,12);
 assert.equal(getPlan('unknown'),null);
});
test('expired or inactive subscriptions fall back to free',()=>{
 const now=1_800_000_000_000;
 assert.equal(activeEntitlement({status:'active',planId:'pro',currentPeriodEnd:now-1},now).id,'free');
 assert.equal(activeEntitlement({status:'past_due',planId:'pro',currentPeriodEnd:now+1000},now).id,'free');
 assert.equal(activeEntitlement({status:'active',planId:'pro',currentPeriodEnd:now+1000},now).id,'pro');
});
test('usage and participant caps are enforced at boundaries',()=>{
 assert.equal(canStartMeeting({minutesUsed:120}).allowed,false);
 assert.equal(canStartMeeting({minutesUsed:119}).remainingMinutes,1);
 assert.equal(canJoinMeeting({plan:PLANS.free,connected:2,pending:1}),false);
 assert.equal(canJoinMeeting({plan:PLANS.pro,connected:10,pending:1}),true);
 assert.equal(effectiveMeetingMinutes({plan:PLANS.free,minutesUsed:115}),5);
 assert.throws(()=>canJoinMeeting({plan:PLANS.free,connected:-1}),/Invalid/);
});
