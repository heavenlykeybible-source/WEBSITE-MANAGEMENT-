// MeetingSpace broadcast destination configuration.
// This module does not transmit video or authenticate social accounts.
// Secrets belong in encrypted server-side storage, never browser bundles.
export const PLATFORMS = Object.freeze({
 facebook:{label:'Facebook',mode:'platform-dependent',multiple:true,notes:'Pages and eligible profile destinations require authorization and current Meta permissions.'},
 youtube:{label:'YouTube',mode:'rtmps-or-api',multiple:true,notes:'Each channel must have live streaming enabled and separately authorized.'},
 instagram:{label:'Instagram',mode:'platform-dependent',multiple:true,notes:'Live Producer or supported official access; availability varies by account.'},
 tiktok:{label:'TikTok',mode:'platform-dependent',multiple:true,notes:'LIVE access and external encoder permissions vary by account.'},
 linkedin:{label:'LinkedIn',mode:'platform-dependent',multiple:true,notes:'Live event eligibility and organization/member authorization required.'},
 x:{label:'X',mode:'platform-dependent',multiple:true,notes:'Streaming access depends on current account and platform entitlements.'},
 custom:{label:'Custom RTMPS',mode:'rtmps',multiple:true,notes:'Use only approved endpoints with securely stored stream credentials.'}
});
export function validateDestination(input){
 if(!input||typeof input!=='object')throw new Error('Invalid destination');
 const {platform,label,accountId}=input;
 if(!Object.hasOwn(PLATFORMS,platform))throw new Error('Unsupported platform');
 if(typeof label!=='string'||label.trim().length<1||label.length>120)throw new Error('Invalid label');
 if(typeof accountId!=='string'||accountId.length<1||accountId.length>160)throw new Error('Invalid account ID');
 return {platform,label:label.trim(),accountId,enabled:input.enabled===true};
}
export function planBroadcast(destinations){
 if(!Array.isArray(destinations)||destinations.length>50)throw new Error('Invalid destination list');
 const checked=destinations.map(validateDestination);
 const unique=new Set(checked.map(d=>d.platform+':'+d.accountId));
 if(unique.size!==checked.length)throw new Error('Duplicate destination');
 return {destinations:checked,requiresEncoder:true,requiresAuthorization:true,readyToStream:false};
}
