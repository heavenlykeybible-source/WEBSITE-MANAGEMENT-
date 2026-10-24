import {broadcastSummary} from './broadcast-manager.js';
import {redactStreamDestination} from './broadcast-credentials.js';

// Returns safe data for an authenticated host dashboard. Never expose stream keys.
export function buildBroadcastDashboard(outputs,actor,roomId){
 if(!actor||actor.verified!==true||actor.roomId!==roomId||!['owner','host','cohost'].includes(actor.role))throw Error('Dashboard access denied');
 const destinations=outputs.map(redactStreamDestination);
 return {roomId,canControl:['owner','host'].includes(actor.role),canConfigure:true,summary:broadcastSummary(outputs),destinations};
}
export function renderBroadcastDashboard(data){
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 if(!data||!Array.isArray(data.destinations))throw Error('Invalid dashboard');
 const rows=data.destinations.map(o=>'<tr><td>'+escape(o.label)+'</td><td>'+escape(o.platform)+'</td><td>'+escape(o.state)+'</td></tr>').join('');
 return '<section aria-label="Broadcast destinations"><h2>Live broadcast destinations</h2><p>Live: '+data.summary.live+' / '+data.summary.total+'</p><table><thead><tr><th>Destination</th><th>Platform</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
}
