import {nextBroadcastState} from './broadcast-state.js';
import {validateDestination} from './broadcast-config.js';

// Pure immutable state manager; external streaming services must report verified status.
export function addDestination(outputs,input){
 const destination=validateDestination(input);
 if(!Array.isArray(outputs)||outputs.length>=50)throw Error('Destination limit reached');
 if(outputs.some(o=>o.platform===destination.platform&&o.accountId===destination.accountId))throw Error('Duplicate destination');
 const id=crypto.randomUUID();
 return [...outputs,{...destination,id,state:'ready',lastError:null,updatedAt:null}];
}
export function updateDestination(outputs,id,next,{error=null,at=Date.now()}={}){
 if(!Array.isArray(outputs)||typeof id!=='string')throw Error('Invalid request');
 let found=false;
 const updated=outputs.map(output=>{
  if(output.id!==id)return output;
  found=true;
  const state=nextBroadcastState(output.state,next);
  if(state==='failed'&&(!error||typeof error!=='string'))throw Error('Failure reason required');
  return {...output,state,lastError:state==='failed'?error:null,updatedAt:at};
 });
 if(!found)throw Error('Unknown destination');
 return updated;
}
export function broadcastSummary(outputs){
 if(!Array.isArray(outputs))throw Error('Invalid destinations');
 return {total:outputs.length,live:outputs.filter(x=>x.state==='live').length,failed:outputs.filter(x=>x.state==='failed').length,starting:outputs.filter(x=>x.state==='starting').length};
}
