// Called only after authenticated host admission by trusted server infrastructure.
export async function markVerifiedHostJoined(db,roomId,ownerId,joinedAt=Date.now()){
 if(!db?.prepare||typeof roomId!=='string'||!/^[A-Za-z0-9_-]{6,80}$/.test(roomId)||typeof ownerId!=='string'||!ownerId)throw Error('Missing trusted meeting context');
 if(!Number.isSafeInteger(joinedAt)||joinedAt<=0)throw Error('Invalid join timestamp');
 const update=await db.prepare('UPDATE meeting_sessions SET host_joined_at=? WHERE room_id=? AND owner_user_id=? AND host_joined_at IS NULL AND ended_at IS NULL').bind(joinedAt,roomId,ownerId).run();
 if(update.meta?.changes===1)return {started:true,joinedAt};
 const existing=await db.prepare('SELECT host_joined_at AS joinedAt,ended_at AS endedAt FROM meeting_sessions WHERE room_id=? AND owner_user_id=?').bind(roomId,ownerId).first();
 if(!existing||existing.endedAt!=null)throw Error('Meeting is not open');
 if(!Number.isSafeInteger(existing.joinedAt)||existing.joinedAt<=0)throw Error('Verified start timestamp missing');
 return {started:false,joinedAt:existing.joinedAt};
}

// Duration is computed on the server, not supplied by a meeting participant.
export function measuredMeetingMinutes(startedAt,endedAt){
 if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(endedAt)||startedAt<=0||endedAt<startedAt)throw Error('Invalid timestamps');
 return Math.ceil((endedAt-startedAt)/60000);
}
export async function finalizeMeetingUsage(db,roomId,ownerId,endedAt){
 if(!db?.prepare||typeof roomId!=='string'||!/^[A-Za-z0-9_-]{6,80}$/.test(roomId)||typeof ownerId!=='string'||!ownerId)throw Error('Missing trusted meeting context');
 if(!Number.isSafeInteger(endedAt)||endedAt<=0)throw Error('Invalid meeting end time');
 const current=await db.prepare('SELECT host_joined_at AS joinedAt,ended_at AS endedAt,billed_minutes AS minutes FROM meeting_sessions WHERE room_id=? AND owner_user_id=?').bind(roomId,ownerId).first();
 if(!current)throw Error('Unknown meeting');
 if(current.endedAt!=null)return {changed:false,minutes:current.minutes};
 if(current.joinedAt!=null&&(!Number.isSafeInteger(current.joinedAt)||current.joinedAt<=0))throw Error('Invalid stored host join time');
 const minutes=current.joinedAt==null?0:measuredMeetingMinutes(current.joinedAt,endedAt);
 const result=await db.prepare('UPDATE meeting_sessions SET ended_at=?,billed_minutes=? WHERE room_id=? AND owner_user_id=? AND ended_at IS NULL').bind(endedAt,minutes,roomId,ownerId).run();
 if(result.meta?.changes===1)return {changed:true,minutes};
 const latest=await db.prepare('SELECT billed_minutes AS minutes FROM meeting_sessions WHERE room_id=? AND owner_user_id=?').bind(roomId,ownerId).first();
 if(!latest)throw Error('Meeting disappeared during finalization');
 return {changed:false,minutes:latest.minutes};
}
