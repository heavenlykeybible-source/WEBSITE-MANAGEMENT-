import test from 'node:test';
import assert from 'node:assert/strict';
import {measuredMeetingMinutes,finalizeMeetingUsage,markVerifiedHostJoined} from '../src/meeting-usage-ledger.js';
test('server measurement rounds partial minutes up',()=>{
 assert.equal(measuredMeetingMinutes(1000,1000),0);
 assert.equal(measuredMeetingMinutes(1000,1001),1);
 assert.equal(measuredMeetingMinutes(1000,61001),2);
 assert.throws(()=>measuredMeetingMinutes(5000,4000),/Invalid timestamps/);
});
test('meeting finalization records time only once',async()=>{
 const row={joinedAt:1000,endedAt:null,minutes:0};
 let writes=0;
 const db={prepare(sql){return {bind(...args){return {
  first:async()=>({...row}),
  run:async()=>{if(row.endedAt!==null)return {meta:{changes:0}};row.endedAt=args[0];row.minutes=args[1];writes++;return {meta:{changes:1}}}
 }}}}};
 const first=await finalizeMeetingUsage(db,'room123','owner',61001);
 assert.deepEqual(first,{changed:true,minutes:2});
 assert.deepEqual(await finalizeMeetingUsage(db,'room123','owner',999999),{changed:false,minutes:2});
 assert.equal(writes,1);
});

test('ledger rejects invalid meeting identifiers',async()=>{
 await assert.rejects(finalizeMeetingUsage({prepare(){}},'bad room','owner',61000),/Missing trusted meeting context/);
});

test('billing finalization refuses invalid end timestamps',async()=>{
 const db={prepare(){throw Error('Unexpected database access')}};
 await assert.rejects(finalizeMeetingUsage(db,'room123','owner',Number.NaN),/Invalid meeting end time/);
 await assert.rejects(finalizeMeetingUsage(db,'room123','owner',-2),/Invalid meeting end time/);
});

test('rejects invalid usage finalization timestamp before storage access',async()=>{
 let queried=false;
 const db={prepare(){queried=true;throw Error('Unexpected database query')}};
 await assert.rejects(finalizeMeetingUsage(db,'room123','owner',NaN),/Invalid meeting end time/);
 assert.equal(queried,false);
});

test('unstarted reservation ends with zero minutes',async()=>{
 const state={joinedAt:null,endedAt:null,minutes:0};
 const db={prepare(sql){return {bind(...args){return {
  first:async()=>({...state}),
  run:async()=>{state.endedAt=args[0];state.minutes=args[1];return {meta:{changes:1}}}
 }}}}};
 assert.deepEqual(await finalizeMeetingUsage(db,'room123','owner',61001),{changed:true,minutes:0});
});
test('first verified host join is recorded only once',async()=>{
 const state={joinedAt:null,endedAt:null};
 let writes=0;
 const db={prepare(sql){return {bind(...args){return {
  first:async()=>({...state}),
  run:async()=>{if(state.joinedAt!=null)return {meta:{changes:0}};state.joinedAt=args[0];writes++;return {meta:{changes:1}}}
 }}}}};
 assert.deepEqual(await markVerifiedHostJoined(db,'room123','owner',1000),{started:true,joinedAt:1000});
 assert.deepEqual(await markVerifiedHostJoined(db,'room123','owner',2000),{started:false,joinedAt:1000});
 assert.equal(writes,1);
});

test('rejects corrupt persisted host join time without billing',async()=>{
 const db={prepare(sql){return {bind(){return {first:async()=>({joinedAt:-2,endedAt:null,minutes:0}),run:async()=>{throw Error('Must not bill')}}}}}};
 await assert.rejects(finalizeMeetingUsage(db,'room123','owner',61001),/Invalid stored host join time/);
});
