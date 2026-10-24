// Pure waiting-room state machine. Integrate with authenticated Durable Object handlers.
export function createWaitingRoom({ownerId,maxParticipants=12}){
 if(typeof ownerId!=='string'||!ownerId||!Number.isInteger(maxParticipants)||maxParticipants<2||maxParticipants>12)throw Error('Invalid room');
 return {ownerId,maxParticipants,locked:false,admitted:[],pending:[],denied:[]};
}
export function requestAdmission(room,{userId,displayName}){
 if(typeof userId!=='string'||!userId||userId.length>160)throw Error('Invalid user');
 if(typeof displayName!=='string'||!displayName.trim()||displayName.length>80)throw Error('Invalid display name');
 if(room.locked)return {room,status:'locked'};
 if(room.denied.includes(userId))return {room,status:'denied'};
 if(room.admitted.includes(userId))return {room,status:'admitted'};
 if(room.pending.some(p=>p.userId===userId))return {room,status:'waiting'};
 if(room.admitted.length+room.pending.length>=room.maxParticipants)return {room,status:'full'};
 return {room:{...room,pending:[...room.pending,{userId,displayName:displayName.trim()}]},status:'waiting'};
}
export function decideAdmission(room,{actorId,userId,decision}){
 if(actorId!==room.ownerId)throw Error('Only verified owner can decide admission');
 if(!['admit','deny'].includes(decision))throw Error('Invalid decision');
 const found=room.pending.find(p=>p.userId===userId);
 if(!found)throw Error('Participant not pending');
 if(decision==='admit'&&room.admitted.length>=room.maxParticipants)throw Error('Room full');
 return {...room,pending:room.pending.filter(p=>p.userId!==userId),admitted:decision==='admit'?[...room.admitted,userId]:room.admitted,denied:decision==='deny'?[...room.denied,userId]:room.denied};
}
export function removeParticipant(room,{actorId,userId}){
 if(actorId!==room.ownerId)throw Error('Only verified owner can remove participant');
 return {...room,admitted:room.admitted.filter(id=>id!==userId)};
}
export function setRoomLock(room,{actorId,locked}){
 if(actorId!==room.ownerId||typeof locked!=='boolean')throw Error('Not permitted');
 return {...room,locked};
}
