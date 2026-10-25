// coturn TURN REST API credentials for WebRTC NAT traversal.
// A trusted backend must verify a user's meeting access before calling this.
// Never deliver the shared TURN secret or permanent credentials to the browser.
const enc=new TextEncoder();
export async function issueTurnCredentials({userId,turnUrls,sharedSecret,ttlSeconds=1800,now=Math.floor(Date.now()/1000)}){
 if(typeof userId!=='string'||!/^[a-zA-Z0-9_.:-]{1,128}$/.test(userId))throw Error('Invalid TURN identity');
 if(typeof sharedSecret!=='string'||sharedSecret.length<32)throw Error('TURN credentials not configured');
 if(!Array.isArray(turnUrls)||turnUrls.length===0||turnUrls.length>4||turnUrls.some(u=>typeof u!=='string'||!/^turns?:[^\s]+$/.test(u)))throw Error('Invalid TURN URLs');
 if(!Number.isSafeInteger(now)||now<1||!Number.isInteger(ttlSeconds)||ttlSeconds<60||ttlSeconds>3600)throw Error('Invalid TURN lifetime');
 const username=(now+ttlSeconds)+':'+userId;
 const key=await crypto.subtle.importKey('raw',enc.encode(sharedSecret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(username)));
 const credential=btoa(String.fromCharCode(...signature));
 return {urls:[...turnUrls],username,credential,credentialType:'password',expiresAt:(now+ttlSeconds)*1000};
}
