import {resolveMeetingAllowance} from './subscription-store.js';
import {issueMeetingTicket} from './session-tokens.js';

// This service must be called only AFTER verifying the session on the trusted server.
// Never take userId, role or planId from an unauthenticated JSON request.
export async function issueOwnerTicketForAccount({db,verifiedPrincipal,roomId,signingSecret,now=Date.now()}){
 if(!verifiedPrincipal?.authenticated||typeof verifiedPrincipal.userId!=='string'||!verifiedPrincipal.userId)
  throw Error('Verified account session required');
 if(typeof signingSecret!=='string'||signingSecret.length<32)throw Error('Ticket signing not configured');
 const ownerId=verifiedPrincipal.userId;
 const allowance=await resolveMeetingAllowance(db,ownerId,{now});
 if(!allowance.allowed)return {allowed:false,reason:'Monthly meeting allowance exhausted',plan:allowance.plan.id};
 const existing=await db.prepare('SELECT owner_user_id AS ownerId FROM meeting_sessions WHERE room_id=? LIMIT 1').bind(roomId).first();
 if(existing&&existing.ownerId!==ownerId)return {allowed:false,reason:'Room is owned by another account'};
 if(!existing){
  const result=await db.prepare('INSERT OR IGNORE INTO meeting_sessions (id,owner_user_id,room_id,started_at,billed_minutes) VALUES (?,?,?,?,0)')
    .bind(crypto.randomUUID(),ownerId,roomId,now).run();
  if(result.meta?.changes!==1){
   const winner=await db.prepare('SELECT owner_user_id AS ownerId FROM meeting_sessions WHERE room_id=? LIMIT 1').bind(roomId).first();
   if(winner?.ownerId!==ownerId)return {allowed:false,reason:'Room could not be reserved'};
  }
 }
 const meetingMinutes=Math.max(1,Math.floor(Math.min(allowance.plan.meetingMinutes,allowance.remainingMinutes)));
 const ticket=await issueMeetingTicket({roomId,userId:ownerId,role:'owner',planId:allowance.plan.id,meetingMinutes,secret:signingSecret});
 return {allowed:true,ticket,plan:allowance.plan.id,participants:allowance.plan.participants,
  meetingMinutes};
}
