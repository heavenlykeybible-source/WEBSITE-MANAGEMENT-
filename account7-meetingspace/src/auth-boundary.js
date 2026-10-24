// Authentication boundary for Account 7.
// Never mint meeting tickets based solely on unverified browser-provided user IDs or roles.
export function requireVerifiedIdentity(identity){
 if(!identity||typeof identity!=='object'||identity.verified!==true||typeof identity.subject!=='string'||!identity.subject.trim()||identity.subject.length>160)throw new Error('Verified identity required');
 return {subject:identity.subject};
}
export function authorizeRoomRole({identity,room,role}){
 const {subject}=requireVerifiedIdentity(identity);
 if(!room||typeof room!=='object'||typeof room.ownerId!=='string')throw new Error('Room metadata required');
 if(!['owner','host','cohost','participant'].includes(role))throw new Error('Invalid role');
 if(role==='owner'&&room.ownerId!==subject)throw new Error('Not room owner');
 if(['host','cohost'].includes(role)&&room.ownerId!==subject&&!room.moderators?.[subject]?.includes(role))throw new Error('Moderator role not granted');
 if(role==='participant'&&room.blockedUsers?.includes(subject))throw new Error('Participant blocked');
 return {userId:subject,role};
}
export function parseBearer(request){
 const authorization=request.headers.get('Authorization')||'';
 if(!authorization.startsWith('Bearer '))return null;
 const token=authorization.slice(7).trim();
 return token.length>=10&&token.length<=4096?token:null;
}
