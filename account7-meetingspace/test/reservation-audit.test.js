import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectOpenMeetingReservations} from '../src/reservation-audit.js';
const now=Date.UTC(2026,9,25,15);
test('read-only audit reports stale reservations without changing accounts',async()=>{
 let queries=0,writes=0;
 const db={prepare(sql){queries++;assert.match(sql,/^SELECT/);return {bind(...params){assert.equal(params[0],now-3600000);assert.equal(params[1],100);return {all:async()=>({results:[{roomId:'room123',ownerId:'account-1',reservedAt:now-7200000}]})}}}},run(){writes++}};
 const result=await inspectOpenMeetingReservations(db,{now});
 assert.equal(result.requiresReview,true);
 assert.equal(result.reservations.length,1);
 assert.equal(queries,1);
 assert.equal(writes,0);
});
test('audit rejects unreasonable scanning limits and age parameters',async()=>{
 const db={prepare(){throw Error('Should not query')}};
 await assert.rejects(inspectOpenMeetingReservations(db,{now,limit:200}),/Invalid inspection limit/);
 await assert.rejects(inspectOpenMeetingReservations(db,{now,olderThanMinutes:0}),/Invalid inspection period/);
});
