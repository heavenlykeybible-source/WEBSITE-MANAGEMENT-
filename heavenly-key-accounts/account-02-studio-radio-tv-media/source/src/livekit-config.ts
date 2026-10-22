import { signLiveKitGrant } from './livekit';
export type LiveKitConfig={LIVEKIT_URL:string;LIVEKIT_API_KEY:string;LIVEKIT_API_SECRET:string};
type ConfigEnv={LIVEKIT_URL?:string;LIVEKIT_API_KEY?:string;LIVEKIT_API_SECRET?:string;LIVE_STATUS_KV:KVNamespace;MEDIA_ENGINE_SHARED_SECRET:string};
export class LiveKitConnectionError extends Error { constructor(message:string,public code:string,public status=400){super(message);} }
const CONFIG_KEY='livekit-connection-v1';
async function cipherKey(env:ConfigEnv){const seed=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MEDIA_ENGINE_SHARED_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=await crypto.subtle.sign('HMAC',seed,new TextEncoder().encode('heavenlykey-livekit-credential-encryption-v1'));return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);}
export async function resolveLiveKitConfig(env:ConfigEnv):Promise<LiveKitConfig|null>{
 const stored=await env.LIVE_STATUS_KV?.get(CONFIG_KEY);if(!stored)return env.LIVEKIT_URL&&env.LIVEKIT_API_KEY&&env.LIVEKIT_API_SECRET?{LIVEKIT_URL:env.LIVEKIT_URL,LIVEKIT_API_KEY:env.LIVEKIT_API_KEY,LIVEKIT_API_SECRET:env.LIVEKIT_API_SECRET}:null;
 if(JSON.parse(stored).disabled===true)return null;
 try{const {iv,data}=JSON.parse(stored);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(iv)},await cipherKey(env),Uint8Array.from(data));return JSON.parse(new TextDecoder().decode(plain));}catch{throw new Error('Stored broadcast connection cannot be decrypted. Reconnect it in Settings.');}
}
export function validateCloudConnection(body:Record<string,unknown>):LiveKitConfig{
 let url:URL;try{url=new URL(String(body.url??'').trim());}catch{throw new LiveKitConnectionError('Project URL is invalid. Copy the full wss:// URL from your LiveKit project settings, not the project name.','invalid_project_url');}if(!['wss:','https:'].includes(url.protocol)||!/^[-a-z0-9]+\.livekit\.cloud$/i.test(url.hostname)||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new LiveKitConnectionError('Use the exact LiveKit Cloud project URL, such as wss://your-project.livekit.cloud. Do not enter the project name or dashboard address.','invalid_project_url');
 const key=String(body.apiKey??'').trim(),secret=String(body.apiSecret??'').trim();if(!key||!secret||key.length>256||secret.length>512)throw new LiveKitConnectionError('Enter both the API key and matching API secret from the same LiveKit project.','missing_credentials');return {LIVEKIT_URL:'wss://'+url.hostname,LIVEKIT_API_KEY:key,LIVEKIT_API_SECRET:secret};
}
export async function checkLiveKitConnection(config:LiveKitConfig){
 const token=await signLiveKitGrant(config,{roomList:true});
 let r:Response;try{r=await fetch(config.LIVEKIT_URL.replace('wss:','https:')+'/twirp/livekit.RoomService/ListRooms',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',redirect:'manual',signal:AbortSignal.timeout(10000)});}catch{throw new LiveKitConnectionError('The server could not reach your LiveKit project. Check the project URL and try again.','provider_unreachable',503);}
 if(r.status>=300&&r.status<400)throw new LiveKitConnectionError('The project URL redirected instead of answering. Copy its exact LiveKit Cloud Project URL; credentials were not forwarded.','provider_redirect');
 if(r.status===401||r.status===403)throw new LiveKitConnectionError('LiveKit rejected the API key or secret. Copy a matching pair from this project’s Settings → Keys.','credentials_rejected');
 if(r.status===404)throw new LiveKitConnectionError('LiveKit could not find this project endpoint. Copy its exact Project URL from project settings.','project_not_found');
 if(!r.ok)throw new LiveKitConnectionError('LiveKit returned HTTP '+r.status+'. Wait briefly, then try again.','provider_unavailable',503);
 let result:{rooms?:unknown[]};try{result=await r.json();}catch{throw new LiveKitConnectionError('The project endpoint did not return a LiveKit response. Check the Project URL.','invalid_provider_response',502);}
 if(!result||typeof result!=='object'||(result.rooms!==undefined&&!Array.isArray(result.rooms)))throw new LiveKitConnectionError('The project endpoint returned an unexpected LiveKit response.','invalid_provider_response',502);
}
export async function saveLiveKitConnection(env:ConfigEnv,config:LiveKitConfig){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await cipherKey(env),new TextEncoder().encode(JSON.stringify(config)));await env.LIVE_STATUS_KV.put(CONFIG_KEY,JSON.stringify({iv:Array.from(iv),data:Array.from(new Uint8Array(data))}));}

const STATUS_KEY='livekit-connection-status-v1';
export async function liveKitConnectionStatus(env:ConfigEnv){
 const meta=JSON.parse(await env.LIVE_STATUS_KV.get(STATUS_KEY)||'{}');
 try{const config=await resolveLiveKitConfig(env);return {configured:!!config,state:config?(meta.state||'saved'):(meta.state==='reset'?'reset':env.LIVEKIT_API_KEY||env.LIVEKIT_API_SECRET||env.LIVEKIT_URL?'incomplete':'not_configured'),url:meta.state==='reset'?null:config?.LIVEKIT_URL??env.LIVEKIT_URL??null,keyMasked:config?'••••'+(config.LIVEKIT_API_KEY.length>4?config.LIVEKIT_API_KEY.slice(-4):''):null,secretSaved:!!config,verifiedAt:meta.verifiedAt??null,checkedAt:meta.checkedAt??null,errorCode:meta.errorCode??null,source:await env.LIVE_STATUS_KV.get(CONFIG_KEY)?'dashboard':'environment'};}catch{return {configured:false,state:'unreadable',url:null,keyMasked:null,secretSaved:false,verifiedAt:meta.verifiedAt??null,errorCode:'connection_unreadable'};}
}
export async function recordLiveKitVerification(env:ConfigEnv,ok:boolean,errorCode?:string){const old=JSON.parse(await env.LIVE_STATUS_KV.get(STATUS_KEY)||'{}'),now=new Date().toISOString();await env.LIVE_STATUS_KV.put(STATUS_KEY,JSON.stringify({state:ok?'connected':'attention',verifiedAt:ok?now:old.verifiedAt??null,checkedAt:now,errorCode:ok?null:errorCode||'connection_check_failed'}));}
export async function resetLiveKitConnection(env:ConfigEnv){await env.LIVE_STATUS_KV.put(CONFIG_KEY,JSON.stringify({disabled:true}));await env.LIVE_STATUS_KV.put(STATUS_KEY,JSON.stringify({state:'reset',checkedAt:new Date().toISOString()}));}
