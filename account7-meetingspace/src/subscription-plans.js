// Subscription entitlements. Prices and payment collection are configured separately.
// Limits above 12 require an SFU; this P2P implementation cannot safely host them.
export const PLANS=Object.freeze({
 free:Object.freeze({id:'free',name:'Free',participants:3,meetingMinutes:40,monthlyMeetingMinutes:120,monthlyPrice:null}),
 starter:Object.freeze({id:'starter',name:'Starter',participants:6,meetingMinutes:120,monthlyMeetingMinutes:1200,monthlyPrice:null}),
 pro:Object.freeze({id:'pro',name:'Pro',participants:12,meetingMinutes:240,monthlyMeetingMinutes:6000,monthlyPrice:null})
});
export function getPlan(id){return PLANS[id]||null}
export function activeEntitlement(subscription,now=Date.now()){
 if(!subscription||!['active','trialing'].includes(subscription.status)||!Number.isFinite(subscription.currentPeriodEnd)||subscription.currentPeriodEnd<=now)return PLANS.free;
 return getPlan(subscription.planId)||PLANS.free;
}
export function canStartMeeting({subscription,minutesUsed=0,now=Date.now()}){
 const plan=activeEntitlement(subscription,now);
 if(!Number.isFinite(minutesUsed)||minutesUsed<0)throw Error('Invalid usage');
 return {allowed:minutesUsed<plan.monthlyMeetingMinutes,plan,remainingMinutes:Math.max(0,plan.monthlyMeetingMinutes-minutesUsed)};
}
export function canJoinMeeting({plan,connected=0,pending=0}){
 if(!plan||!Number.isInteger(connected)||!Number.isInteger(pending)||connected<0||pending<0)throw Error('Invalid capacity');
 return connected+pending<plan.participants;
}
export function effectiveMeetingMinutes({plan,minutesUsed=0}){
 if(!plan||!Number.isFinite(minutesUsed)||minutesUsed<0)throw Error('Invalid meeting usage');
 return Math.max(0,Math.min(plan.meetingMinutes,plan.monthlyMeetingMinutes-minutesUsed));
}
