// Short-lived HMAC-signed meeting admission tickets.
// Server must authenticate identity and authorize role BEFORE issuing tickets.
// Store the signing key as a Cloudflare secret, never in source control.
const enc=new TextEncoder(),dec=new TextDecoder();
const b64u=bytes=>{let str='';for(const n of bytes)str+=String.fromCharCode(n);return btoa(str).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')};
const unb64u=str=>{if(typeof str!=='string'||!/^[A-Za-z0-9_-]+$/.test(str))throw Error('Invalid token encoding');const raw=atob(str.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(raw,c=>c.charCodeAt(0))};
const key=async secret=>{if(typeof secret!=='string'||secret.length<32)throw Error('Signing secret must be at least 32 characters');return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])};
export async function issueMeetingTicket({roomId,userId,role,planId='free',meetingMinutes=null,secret,ttlSeconds=300,now=Math.floor(Date.now()/1000)}){
 if(!/^[A-Za-z0-9_-]{6,80}$/.test(roomId)||typeof userId!=='string'||!userId||userId.length>160||!['owner','host','cohost','participant'].includes(role)||!['free','starter','pro'].includes(planId))throw Error('Invalid ticket claims');
 if(meetingMinutes!==null&&(!Number.isInteger(meetingMinutes)||meetingMinutes<1||meetingMinutes>240))throw Error('Invalid meeting allowance');
 if(!Number.isInteger(ttlSeconds)||ttlSeconds<30||ttlSeconds>900)throw Error('Invalid TTL');
 const payload=b64u(enc.encode(JSON.stringify({v:1,roomId,userId,role,planId,meetingMinutes,iat:now,exp:now+ttlSeconds})));
 const signature=b64u(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),enc.encode(payload))));
 return payload+'.'+signature;
}
export async function verifyMeetingTicket({ticket,roomId,secret,now=Math.floor(Date.now()/1000)}){
 if(typeof ticket!=='string'||ticket.length>4096)return null;
 const parts=ticket.split('.');if(parts.length!==2)return null;
 try{
  const [payload,signature]=parts;
  const valid=await crypto.subtle.verify('HMAC',await key(secret),unb64u(signature),enc.encode(payload));
  if(!valid)return null;
  const claims=JSON.parse(dec.decode(unb64u(payload)));
  if(claims.v!==1||claims.roomId!==roomId||typeof claims.userId!=='string'||!claims.userId||!['owner','host','cohost','participant'].includes(claims.role)||!['free','starter','pro'].includes(claims.planId??'free'))return null;
  if(claims.meetingMinutes!=null&&(!Number.isInteger(claims.meetingMinutes)||claims.meetingMinutes<1||claims.meetingMinutes>240))return null;
  if(!Number.isInteger(claims.iat)||!Number.isInteger(claims.exp)||claims.iat>now+30||claims.exp<=now||claims.exp-claims.iat>900)return null;
  return {...claims,planId:claims.planId??'free'};
 }catch{return null}
}
