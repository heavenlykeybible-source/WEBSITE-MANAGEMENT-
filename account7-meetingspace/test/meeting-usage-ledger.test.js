import test from 'node:test';
import assert from 'node:assert/strict';
import {measuredMeetingMinutes,finalizeMeetingUsage} from '../src/meeting-usage-ledger.js';
test('server measurement rounds partial minutes up',()=>{
 assert.equal(measuredMeetingMinutes(1000,1000),0);
 assert.equal(measuredMeetingMinutes(1000,1001),1);
 assert.equal(measuredMeetingMinutes(1000,61001),2);
 assert.throws(()=>measuredMeetingMinutes(5000,4000),/Invalid timestamps/);
});
test('meeting finalization records time only once',async()=>{
 const row={startedAt:1000,endedAt:null,minutes:0};
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
