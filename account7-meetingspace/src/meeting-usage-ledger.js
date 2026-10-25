// Duration is computed on the server, not supplied by a meeting participant.
export function measuredMeetingMinutes(startedAt,endedAt){
 if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(endedAt)||startedAt<=0||endedAt<startedAt)throw Error('Invalid timestamps');
 return Math.ceil((endedAt-startedAt)/60000);
}
export async function finalizeMeetingUsage(db,roomId,ownerId,endedAt){
 if(!db?.prepare||typeof roomId!=='string'||!/^[A-Za-z0-9_-]{6,80}$/.test(roomId)||typeof ownerId!=='string'||!ownerId)throw Error('Missing trusted meeting context');
 if(!Number.isSafeInteger(endedAt)||endedAt<=0)throw Error('Invalid meeting end time');
 if(!Number.isSafeInteger(endedAt)||endedAt<=0)throw Error('Invalid meeting end time');
 const current=await db.prepare('SELECT started_at AS startedAt,ended_at AS endedAt,billed_minutes AS minutes FROM meeting_sessions WHERE room_id=? AND owner_user_id=?').bind(roomId,ownerId).first();
 if(!current)throw Error('Unknown meeting');
 if(current.endedAt!=null)return {changed:false,minutes:current.minutes};
 const minutes=measuredMeetingMinutes(current.startedAt,endedAt);
 const result=await db.prepare('UPDATE meeting_sessions SET ended_at=?,billed_minutes=? WHERE room_id=? AND owner_user_id=? AND ended_at IS NULL').bind(endedAt,minutes,roomId,ownerId).run();
 if(result.meta?.changes===1)return {changed:true,minutes};
 const latest=await db.prepare('SELECT billed_minutes AS minutes FROM meeting_sessions WHERE room_id=? AND owner_user_id=?').bind(roomId,ownerId).first();
 if(!latest)throw Error('Meeting disappeared during finalization');
 return {changed:false,minutes:latest.minutes};
}
