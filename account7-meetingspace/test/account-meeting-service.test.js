import test from 'node:test';
import assert from 'node:assert/strict';
import {issueOwnerTicketForAccount} from '../src/account-meeting-service.js';
import {verifyMeetingTicket} from '../src/session-tokens.js';
const secret='account-test-signing-key-do-not-use-in-production-123';
const now=Date.UTC(2026,9,25,12);
const principal={authenticated:true,emailVerified:true,userId:'account-1'};
function mockDb({owner=null,used=0,subscription=null}={}){
 let savedOwner=owner;
 return {prepare(sql){return {bind(...args){return {
  first:async()=>sql.includes('FROM subscriptions')?subscription:sql.includes('SUM(billed_minutes)')?{used}:sql.includes('FROM meeting_sessions')?savedOwner?{ownerId:savedOwner}:null:null,
  run:async()=>{if(!savedOwner){savedOwner=args[1];return {meta:{changes:1}}}return {meta:{changes:0}}}
 }}}}};
}
test('refuses to issue meeting tickets without a verified principal',async()=>{
 await assert.rejects(issueOwnerTicketForAccount({db:mockDb(),verifiedPrincipal:{userId:'account-1'},roomId:'room123',signingSecret:secret,now}),/Verified account/);
});
test('signed ticket carries verified principal and active subscription tier',async()=>{
 const db=mockDb({subscription:{planId:'pro',status:'active',currentPeriodEnd:now+86400000}});
 const result=await issueOwnerTicketForAccount({db,verifiedPrincipal:principal,roomId:'room123',signingSecret:secret,now});
 assert.equal(result.allowed,true);
 assert.equal(result.participants,12);
 const claims=await verifyMeetingTicket({ticket:result.ticket,roomId:'room123',secret});
 assert.equal(claims.userId,'account-1');
 assert.equal(claims.planId,'pro');
});
test('existing room owner cannot be replaced by another account',async()=>{
 const result=await issueOwnerTicketForAccount({db:mockDb({owner:'account-2'}),verifiedPrincipal:principal,roomId:'room123',signingSecret:secret,now});
 assert.equal(result.allowed,false);
});
test('monthly usage cap prevents new meeting issuance',async()=>{
 const result=await issueOwnerTicketForAccount({db:mockDb({used:120}),verifiedPrincipal:principal,roomId:'room123',signingSecret:secret,now});
 assert.equal(result.allowed,false);
});

test('rejects invalid room IDs before performing subscription writes',async()=>{
 await assert.rejects(issueOwnerTicketForAccount({db:mockDb(),verifiedPrincipal:principal,roomId:'bad id',signingSecret:secret,now}),/Invalid meeting ID/);
});
test('fractional remaining quota cannot issue one whole meeting minute',async()=>{
 const result=await issueOwnerTicketForAccount({db:mockDb({used:119.5}),verifiedPrincipal:principal,roomId:'room123',signingSecret:secret,now});
 assert.equal(result.allowed,false);
});

test('meeting ticket issuance requires verified email',async()=>{
 await assert.rejects(issueOwnerTicketForAccount({db:mockDb(),verifiedPrincipal:{...principal,emailVerified:false},roomId:'room123',signingSecret:secret,now}),/Verified account/);
});
