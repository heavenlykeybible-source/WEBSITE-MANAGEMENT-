import {createWaitingRoom,requestAdmission,decideAdmission,removeParticipant,setRoomLock} from './waiting-room.js';
// Server-side admission orchestration. Verified identities must be supplied by trusted authentication.
export function initializeAdmission(owner){
 if(!owner||owner.verified!==true||owner.role!=='owner'||typeof owner.userId!=='string')throw Error('Verified owner required');
 const room=createWaitingRoom({ownerId:owner.userId});
 return {...room,admitted:[owner.userId]};
}
export function joinAdmission(room,actor,displayName){
 if(!actor||actor.verified!==true||typeof actor.userId!=='string')throw Error('Verified identity required');
 if(actor.userId===room.ownerId)return {room,status:'admitted'};
 return requestAdmission(room,{userId:actor.userId,displayName});
}
export function reviewAdmission(room,actor,userId,decision){
 if(!actor||actor.verified!==true||actor.role!=='owner'||actor.userId!==room.ownerId)throw Error('Owner authorization required');
 return decideAdmission(room,{actorId:actor.userId,userId,decision});
}
export function ejectAdmission(room,actor,userId){
 if(!actor||actor.verified!==true||actor.role!=='owner'||actor.userId!==room.ownerId)throw Error('Owner authorization required');
 if(userId===room.ownerId)throw Error('Cannot eject owner');
 return removeParticipant(room,{actorId:actor.userId,userId});
}
export function lockAdmission(room,actor,locked){
 if(!actor||actor.verified!==true||actor.role!=='owner'||actor.userId!==room.ownerId)throw Error('Owner authorization required');
 return setRoomLock(room,{actorId:actor.userId,locked});
}
export function canReceiveMeetingMedia(room,actor){
 return !!(actor&&actor.verified===true&&room.admitted.includes(actor.userId));
}
