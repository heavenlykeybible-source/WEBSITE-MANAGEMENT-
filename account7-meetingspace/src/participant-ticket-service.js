import {issueMeetingTicket} from './session-tokens.js';
import {readSubscription} from './subscription-store.js';
import {activeEntitlement} from './subscription-plans.js';

// Invoked only after a trusted identity provider authenticates the caller.
// Invitation links are identifiers, never authentication or authorization.
export async function issueParticipantTicket({db,verifiedPrincipal,roomId,signingSecret,now=Date.now()}){
 if(verifiedPrincipal?.authenticated!==true||verifiedPrincipal.emailVerified!==true||
    typeof verifiedPrincipal.userId!=='string'||!verifiedPrincipal.userId)throw Error('Verified participant identity required');
 if(!db?.prepare)throw Error('Meeting database unavailable');
 if(typeof roomId!=='string'||!/^[A-Za-z0-9_-]{6,80}$/.test(roomId))throw Error('Invalid meeting ID');
 if(typeof signingSecret!=='string'||signingSecret.length<32)throw Error('Ticket signer unavailable');
 if(!Number.isSafeInteger(now)||now<=0)throw Error('Invalid request timestamp');

 const participant=await db.prepare('SELECT id,disabled_at AS disabledAt FROM users WHERE id=? LIMIT 1')
  .bind(verifiedPrincipal.userId).first();
 if(!participant||participant.disabledAt!=null)return {allowed:false,reason:'Registered account required'};
 const session=await db.prepare('SELECT owner_user_id AS ownerId,ended_at AS endedAt FROM meeting_sessions WHERE room_id=? LIMIT 1').bind(roomId).first();
 if(!session||session.endedAt!=null)return {allowed:false,reason:'Meeting unavailable'};
 // The host's paid plan is looked up from D1, not copied from a guest's request.
 const subscription=await readSubscription(db,session.ownerId);
 const plan=activeEntitlement(subscription,now);
 const ticket=await issueMeetingTicket({roomId,userId:verifiedPrincipal.userId,role:'participant',planId:plan.id,secret:signingSecret});
 return {allowed:true,ticket,roomId,role:'participant'};
}
