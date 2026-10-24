import {activeEntitlement,canStartMeeting} from './subscription-plans.js';

// These queries must run on a trusted server using a D1 binding.
// Provider webhooks must be signature-verified before subscription writes.
export async function readSubscription(db,userId){
 if(!db?.prepare||typeof userId!=='string'||!userId)throw Error('Subscription database or user missing');
 return (await db.prepare("SELECT plan_id AS planId,status,current_period_end AS currentPeriodEnd FROM subscriptions WHERE user_id=? AND status IN ('active','trialing') ORDER BY current_period_end DESC LIMIT 1").bind(userId).first())||null;
}
export async function readMonthlyUsage(db,userId,{now=Date.now()}={}){
 if(!db?.prepare||typeof userId!=='string'||!userId)throw Error('Usage database or user missing');
 const date=new Date(now);
 if(!Number.isFinite(date.getTime()))throw Error('Invalid time');
 const periodStart=Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1);
 const row=await db.prepare('SELECT COALESCE(SUM(billed_minutes),0) AS used FROM meeting_sessions WHERE owner_user_id=? AND started_at>=? AND started_at<?').bind(userId,periodStart,now).first();
 const used=Number(row?.used??0);
 if(!Number.isFinite(used)||used<0)throw Error('Invalid stored usage');
 return used;
}
export async function resolveMeetingAllowance(db,userId,{now=Date.now()}={}){
 const [subscription,minutesUsed]=await Promise.all([readSubscription(db,userId),readMonthlyUsage(db,userId,{now})]);
 const result=canStartMeeting({subscription,minutesUsed,now});
 return {...result,minutesUsed,plan:activeEntitlement(subscription,now)};
}
