const enc=(v:string)=>btoa(v).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function signHs256(input:string,secret:string){
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return enc(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(input)))));
}
export function livekitConfigured(env:{LIVEKIT_API_KEY?:string;LIVEKIT_API_SECRET?:string;LIVEKIT_URL?:string}){return !!(env.LIVEKIT_API_KEY&&env.LIVEKIT_API_SECRET&&env.LIVEKIT_URL);}
export async function createLiveKitToken(env:{LIVEKIT_API_KEY?:string;LIVEKIT_API_SECRET?:string;LIVEKIT_URL?:string},room:string,identity:string,publish:boolean){
  if(!livekitConfigured(env)) throw new Error('Live broadcast transport is not configured.');
  const now=Math.floor(Date.now()/1000);
  const header=enc(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const payload=enc(JSON.stringify({iss:env.LIVEKIT_API_KEY,sub:identity,nbf:now-5,exp:now+600,video:{roomJoin:true,room,canPublish:publish,canSubscribe:true,canPublishData:publish}}));
  const input=header+'.'+payload;
  return {token:input+'.'+await signHs256(input,env.LIVEKIT_API_SECRET!),url:env.LIVEKIT_URL!,room,expiresAt:now+600};
}

export async function signLiveKitGrant(env:{LIVEKIT_API_KEY:string;LIVEKIT_API_SECRET:string},video:Record<string,unknown>){const now=Math.floor(Date.now()/1000),input=enc(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+enc(JSON.stringify({iss:env.LIVEKIT_API_KEY,nbf:now-5,exp:now+60,video}));return input+'.'+await signHs256(input,env.LIVEKIT_API_SECRET);}
