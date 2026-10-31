/** Owner-directed release gate: television is on hold. Radio remains available. */
export const TV_LOCKED=true as const;
export const TV_LOCK_MESSAGE='Television is locked and on hold. Radio remains available.';
export function tvLockedResponse():Response{
 return Response.json({error:TV_LOCK_MESSAGE,code:'TELEVISION_LOCKED',channel:'video',locked:true},{status:423,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export function channelAvailability(){
 return {radio:{locked:false,available:true},television:{locked:true,available:false,message:TV_LOCK_MESSAGE}};
}
