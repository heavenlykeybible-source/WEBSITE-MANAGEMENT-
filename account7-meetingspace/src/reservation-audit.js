// Report unreconciled reservations for trusted maintenance workflows only.
// Never auto-finalize or delete a session without authoritative host lifecycle evidence.
export async function inspectOpenMeetingReservations(db,{now=Date.now(),olderThanMinutes=60,limit=100}={}){
 if(!db?.prepare)throw Error('Database not configured');
 if(!Number.isSafeInteger(now)||now<=0||!Number.isInteger(olderThanMinutes)||olderThanMinutes<1||olderThanMinutes>10080)throw Error('Invalid inspection period');
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid inspection limit');
 const cutoff=now-olderThanMinutes*60000;
 const rows=await db.prepare('SELECT room_id AS roomId, owner_user_id AS ownerId, started_at AS reservedAt FROM meeting_sessions WHERE ended_at IS NULL AND started_at<? ORDER BY started_at ASC LIMIT ?').bind(cutoff,limit).all();
 const reservations=rows?.results||[];
 return {cutoff,olderThanMinutes,reservations:reservations.map(row=>({roomId:row.roomId,ownerId:row.ownerId,reservedAt:row.reservedAt})),requiresReview:reservations.length>0};
}
