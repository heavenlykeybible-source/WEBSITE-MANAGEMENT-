// Access policy helpers for the forthcoming authenticated meeting API.
// Do not rely on caller-provided role claims: roles must be established server-side.
export const ROLES=Object.freeze(['owner','host','cohost','participant']);
export const ACTIONS=Object.freeze(['admit','deny','remove','mute-all','lock','start-broadcast','end-meeting']);
const grants=Object.freeze({
 owner:ACTIONS,
 host:ACTIONS,
 cohost:['admit','deny','remove','mute-all'],
 participant:[]
});
export function canPerform(role,action){
 return Object.hasOwn(grants,role)&&grants[role].includes(action);
}
export function validateRoomSettings(value){
 if(!value||typeof value!=='object')throw new Error('Invalid room settings');
 return {
  waitingRoom:value.waitingRoom!==false,
  guestsCanShareScreen:value.guestsCanShareScreen===true,
  guestsCanSendChat:value.guestsCanSendChat!==false,
  locked:value.locked===true,
  maxParticipants:Number.isInteger(value.maxParticipants)&&value.maxParticipants>=2&&value.maxParticipants<=12?value.maxParticipants:12
 };
}
export function resolveAdmission({settings,authenticated,role}){
 if(!settings||typeof settings!=='object')throw new Error('Settings required');
 if(settings.locked)return {admitted:false,reason:'locked'};
 if(role==='owner'||role==='host'||role==='cohost')return {admitted:true,reason:'staff'};
 if(!authenticated)return {admitted:false,reason:'authentication-required'};
 return settings.waitingRoom?{admitted:false,reason:'waiting-room'}:{admitted:true,reason:'open'};
}
