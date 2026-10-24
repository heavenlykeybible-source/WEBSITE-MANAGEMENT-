// Sensitive destination credentials are never returned to browser callers.
// Production integration must use encrypted storage and authorized platform flows.
export function validateStreamEndpoint(url){
 if(typeof url!=='string'||url.length>2048)throw Error('Invalid endpoint');
 let parsed;try{parsed=new URL(url)}catch{throw Error('Invalid endpoint')}
 if(parsed.protocol!=='rtmps:')throw Error('Only RTMPS endpoints are permitted');
 if(parsed.username||parsed.password||parsed.hash)throw Error('Credentials must not appear in endpoint URL');
 if(!parsed.hostname||parsed.hostname==='localhost'||parsed.hostname.endsWith('.local'))throw Error('Invalid host');
 return parsed.toString();
}
export function redactStreamDestination(destination){
 if(!destination||typeof destination!=='object')throw Error('Invalid destination');
 const {id,platform,label,state,updatedAt}=destination;
 return {id,platform,label,state,updatedAt};
}
export function validateCredentialRecord(record){
 if(!record||typeof record!=='object')throw Error('Invalid credential record');
 if(typeof record.destinationId!=='string'||!record.destinationId||record.destinationId.length>160)throw Error('Invalid destination ID');
 if(typeof record.encryptedSecret!=='string'||record.encryptedSecret.length<16)throw Error('Encrypted secret required');
 if(typeof record.keyVersion!=='number'||!Number.isInteger(record.keyVersion)||record.keyVersion<1)throw Error('Invalid key version');
 return {destinationId:record.destinationId,encryptedSecret:record.encryptedSecret,keyVersion:record.keyVersion};
}
