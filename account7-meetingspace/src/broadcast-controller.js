import {safeBroadcastCommand} from './broadcast-authorization.js';
import {updateDestination,broadcastSummary} from './broadcast-manager.js';

// This controller records verified encoder events; it does not claim streaming is live on request.
export function requestBroadcastOperation(outputs,input,actor){
 const command=safeBroadcastCommand(input,actor);
 const output=outputs.find(o=>o.id===command.destinationId);
 if(!output)throw Error('Unknown destination');
 const next={start:'starting',stop:'stopping',retry:'ready'}[command.action];
 if(!next)throw Error('Unsupported broadcast operation');
 const updated=updateDestination(outputs,output.id,next);
 return {outputs:updated,command:{...command,status:'pending_encoder_confirmation'},summary:broadcastSummary(updated)};
}
export function applyEncoderReport(outputs,report,{verifiedEncoder=false}={}){
 if(verifiedEncoder!==true)throw Error('Trusted encoder report required');
 if(!report||typeof report!=='object')throw Error('Invalid encoder report');
 if(!['live','ready','failed'].includes(report.state))throw Error('Unsupported encoder state');
 return updateDestination(outputs,report.destinationId,report.state,{error:report.error||null,at:report.timestamp||Date.now()});
}
