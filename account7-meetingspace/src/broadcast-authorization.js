// Authorization boundary for broadcast operations.
// A trusted identity provider must supply verified actor claims.
const EDIT_ROLES=new Set(['owner','host','cohost']);
const CONTROL_ROLES=new Set(['owner','host']);
export function authorizeBroadcastAction(actor,action,roomId){
 if(!actor||typeof actor!=='object'||actor.verified!==true)throw Error('Verified identity required');
 if(typeof roomId!=='string'||!roomId||actor.roomId!==roomId)throw Error('Room access denied');
 if(typeof actor.userId!=='string'||!actor.userId)throw Error('Invalid actor');
 if(action==='view')return true;
 if(action==='configure'&&EDIT_ROLES.has(actor.role))return true;
 if(['start','stop','retry','remove'].includes(action)&&CONTROL_ROLES.has(actor.role))return true;
 throw Error('Broadcast permission denied');
}
export function safeBroadcastCommand(input,actor){
 if(!input||typeof input!=='object')throw Error('Invalid command');
 const {roomId,action,destinationId}=input;
 authorizeBroadcastAction(actor,action,roomId);
 if(typeof destinationId!=='string'||!destinationId||destinationId.length>160)throw Error('Invalid destination ID');
 return {roomId,action,destinationId,requestedBy:actor.userId};
}
