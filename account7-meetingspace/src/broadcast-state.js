export const broadcastStates = ['ready', 'starting', 'live', 'stopping', 'failed'];
export function nextBroadcastState(current, next) {
 const allowed = {ready:['starting'], starting:['live','failed'], live:['stopping','failed'], stopping:['ready','failed'], failed:['ready']};
 if (!allowed[current]?.includes(next)) throw new Error('Invalid broadcast state transition');
 return next;
}
