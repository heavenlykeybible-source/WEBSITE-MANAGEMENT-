// Duration is computed on the server, not supplied by a meeting participant.
export function measuredMeetingMinutes(startedAt,endedAt){
 if(!Number.isSafeInteger(startedAt)||!Number.isSafeInteger(endedAt)||startedAt<=0||endedAt<startedAt)throw Error('Invalid timestamps');
 return Math.ceil((endedAt-startedAt)/60000);
}
export async function finalizeMeetingUsage(db,roomId,ownerId,endedAt){
 if(!db?.prepare||!roomId||!ownerId)throw Error('Missing trusted meeting context');
 const current=await db.prepare('SELECT started_at AS startedAt,ended_at AS endedAt,billed_minutes AS minutes FROM meeting_sessions WHERE room_id=? AND owner_user_id=?').bind(roomId,ownerId).first();
 if(!current)throw Error('Unknown meeting');
 if(current.endedAt!==null)return {changed:false,minutes:current.minutes};
 const minutes=measuredMeetingMinutes(current.startedAt,endedAt);
 const result=await db.prepare('UPDATE meeting_sessions SET ended_at=?,billed_minutes=? WHERE room_id=? AND owner_user_id=? AND ended_at IS NULL').bind(endedAt,minutes,roomId,ownerId).run();
 return {changed:result.meta?.changes===1,minutes};
}
