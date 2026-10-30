import { resolveLiveKitConfig } from './livekit-config';
import { signLiveKitGrant } from './livekit';

type Env={LIVE_STATUS_KV:KVNamespace;MEDIA_ENGINE_SHARED_SECRET:string};
const CONFIG_KEY='restream-destinations-v1';
const ACTIVE_KEY='restream-active-egress-v1';
const allowed=new Set(['youtube','facebook','tiktok','instagram','linkedin','x']);

async function key(env:Env){
 const seed=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.MEDIA_ENGINE_SHARED_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const bytes=await crypto.subtle.sign('HMAC',seed,new TextEncoder().encode('heavenlykey-restream-destination-encryption-v1'));
 return crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(env:Env,value:unknown){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),new TextEncoder().encode(JSON.stringify(value)));
 return JSON.stringify({iv:Array.from(iv),data:Array.from(new Uint8Array(data))});
}
async function open<T>(env:Env,stored:string|null):Promise<T|null>{
 if(!stored)return null;
 try{const {iv,data}=JSON.parse(stored);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(iv)},await key(env),Uint8Array.from(data));return JSON.parse(new TextDecoder().decode(plain)) as T;}catch{return null;}
}
type Destination={url:string;enabled:boolean;updatedAt:string};
type Store=Record<string,Destination>;
export async function listDestinations(env:Env){
 const store=await open<Store>(env,await env.LIVE_STATUS_KV.get(CONFIG_KEY))??{};
 return Array.from(allowed).map(destination=>{
  const row=store[destination];
  let host:string|null=null;try{host=row?new URL(row.url).hostname:null;}catch{}
  return {destination,configured:!!row?.url,enabled:!!row?.enabled,host,updatedAt:row?.updatedAt??null};
 });
}
export async function saveDestination(env:Env,destination:string,urlValue:string,enabled:boolean){
 if(!allowed.has(destination))throw new Error('Unsupported destination.');
 let u:URL;try{u=new URL(urlValue.trim());}catch{throw new Error('Enter the platform RTMP or RTMPS server URL including its stream key.');}
 if(u.protocol!=='rtmps:'||!u.hostname||u.username||u.password||u.hash)throw new Error('Use a secure RTMPS streaming URL without embedded credentials or fragments.');
 if(u.href.length>2048)throw new Error('Streaming URL is too long.');
 const store=await open<Store>(env,await env.LIVE_STATUS_KV.get(CONFIG_KEY))??{};
 store[destination]={url:u.href,enabled,updatedAt:new Date().toISOString()};
 await env.LIVE_STATUS_KV.put(CONFIG_KEY,await seal(env,store));
 return {destination,configured:true,enabled,host:u.hostname};
}
export async function removeDestination(env:Env,destination:string){
 if(!allowed.has(destination))throw new Error('Unsupported destination.');
 const store=await open<Store>(env,await env.LIVE_STATUS_KV.get(CONFIG_KEY))??{};
 if(!store[destination])return {destination,configured:false,enabled:false};
 delete store[destination];
 await env.LIVE_STATUS_KV.put(CONFIG_KEY,await seal(env,store));
 return {destination,configured:false,enabled:false};
}
export async function setDestinationEnabled(env:Env,destination:string,enabled:boolean){
 if(!allowed.has(destination))throw new Error('Unsupported destination.');
 const store=await open<Store>(env,await env.LIVE_STATUS_KV.get(CONFIG_KEY))??{};
 if(!store[destination]?.url)throw new Error('Connect this destination first.');
 store[destination].enabled=enabled;store[destination].updatedAt=new Date().toISOString();
 await env.LIVE_STATUS_KV.put(CONFIG_KEY,await seal(env,store));
}
async function enabledUrls(env:Env){
 const store=await open<Store>(env,await env.LIVE_STATUS_KV.get(CONFIG_KEY))??{};
 return Object.entries(store).filter(([name,v])=>{
  if(!allowed.has(name)||!v?.enabled||typeof v.url!=='string')return false;
  try{const u=new URL(v.url);return u.protocol==='rtmps:'&&!!u.hostname&&!u.username&&!u.password&&!u.hash;}catch{return false;}
 }).map(([destination,v])=>({destination,url:v.url}));
}
async function callLiveKit(env:any,method:string,body:unknown){
 if(!['StartEgress','StopEgress','ListEgress'].includes(method))throw new Error('Unsupported LiveKit operation.');
 const config=await resolveLiveKitConfig(env);if(!config)throw new Error('LiveKit connection is not configured.');
 const token=await signLiveKitGrant(config,{roomRecord:true});
 const base=new URL(config.LIVEKIT_URL);
 if(base.protocol!=='wss:'||base.username||base.password||base.hash||base.search||base.pathname!=='/'||!base.hostname)throw new Error('LiveKit must use a secure WSS endpoint without a custom path.');
 const endpoint='https://'+base.host+'/twirp/livekit.Egress/'+method;
 const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'manual',signal:AbortSignal.timeout(15000)});
 // Enforce the response limit while reading, not after buffering it.
 const limit=262144;const reader=r.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
 if(reader){try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new Error('LiveKit provider response exceeded the safe size limit.');}chunks.push(part.value);}}finally{reader.releaseLock();}}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 const text=new TextDecoder().decode(bytes);
 let data:any={};try{data=text?JSON.parse(text):{};}catch{}
 if(r.status>=300&&r.status<400)throw new Error('LiveKit Egress endpoint redirected; verify the configured project URL.');
 if(!r.ok)throw new Error('LiveKit Egress '+method+' failed (HTTP '+r.status+'). Check provider logs.');
 return data;
}
export async function startRestream(env:any,input:{source:'live'|'247';sessionId?:number;programmeUrl?:string;format?:string;quality?:string;channel?:'radio'|'video'}){
 if(input.source!=='live'&&input.source!=='247')throw new Error('Choose a valid live or 24/7 stream source.');
 const outputs=await enabledUrls(env);if(!outputs.length)throw new Error('Enable at least one connected streaming destination.');
 const format=String(input.format??'landscape-720');
 const presetByFormat:Record<string,string>={landscape_720:'H264_720P_30',landscape_1080:'H264_1080P_30',portrait_720:'PORTRAIT_H264_720P_30',portrait_1080:'PORTRAIT_H264_1080P_30'};
 const normalized=format.replace(/-/g,'_');
 const preset=presetByFormat[normalized]??(normalized.startsWith('portrait_')?'PORTRAIT_H264_720P_30':'H264_720P_30');
 let body:any;
 if(input.source==='live'){
  if(!Number.isSafeInteger(input.sessionId)||Number(input.sessionId)<=0)throw new Error('An active live session is required.');
  const live=await env.DB.prepare("SELECT session_id,source_ref FROM live_sessions WHERE session_id=? AND status='live' AND julianday(last_heartbeat_at)>julianday('now','-180 seconds')").bind(input.sessionId).first() as {session_id:number;source_ref:string}|null;
  if(!live||!String(live.source_ref).startsWith('livekit:'))throw new Error('LiveKit camera is not on air. Connect the publisher before starting social distribution.');
  body={room_name:'heavenlykey-live-'+input.sessionId,template:{layout:'grid'},preset,outputs:[{stream:{protocol:'RTMP',urls:outputs.map(x=>x.url)}}]};
 }else{
  const page=String(input.programmeUrl??'').trim();let u:URL;try{u=new URL(page);}catch{throw new Error('24/7 programme source URL is invalid.');}
  if(u.protocol!=='https:'||u.username||u.password||u.hash)throw new Error('24/7 programme source must be a safe HTTPS URL.');
  const host=u.hostname.toLowerCase().replace(/\.$/,'');
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.invalid')||host.endsWith('.example')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('['))throw new Error('24/7 programme source must use a public DNS hostname.');
  body={web:{url:u.href,await_start_signal:false},preset,outputs:[{stream:{protocol:'RTMP',urls:outputs.map(x=>x.url)}}]};
 }
 // Check all inputs before ending an existing on-air egress. An invalid
 // replacement must never silence the currently running programme.
 const previous=await reconcileActive(env);
 const replacedEgressId=previous.active?.egressId?String(previous.active.egressId):null;
 // Establish the replacement before touching the existing broadcast.
 // A failed StartEgress must not take the current programme off air.
 const result=await callLiveKit(env,'StartEgress',body);
 const newEgressId=String(result.egress_id??result.egressId??'');
 if(!newEgressId)throw new Error('LiveKit did not return an egress ID.');
 // Persist the replacement before retiring the old stream, so an interrupted
 // handoff does not leave the only active stream untracked.
 const replacementState={egressId:newEgressId,source:input.source,sessionId:input.source==='live'?input.sessionId:undefined,channel:input.source==='247'?(input.channel??'video'):undefined,format,quality:input.quality??'balanced',destinations:outputs.map(x=>x.destination),startedAt:new Date().toISOString()};
 try{await env.LIVE_STATUS_KV.put(ACTIVE_KEY,JSON.stringify(replacementState));}
 catch(error){try{await callLiveKit(env,'StopEgress',{egress_id:newEgressId});}catch{}throw error;}
 if(replacedEgressId){
  try{
   await callLiveKit(env,'StopEgress',{egress_id:replacedEgressId});
  }catch(error){
   // Avoid leaving two simultaneous broadcasts when the handoff fails.
   try{await callLiveKit(env,'StopEgress',{egress_id:newEgressId});}catch{}
   try{await env.LIVE_STATUS_KV.put(ACTIVE_KEY,JSON.stringify(previous.active));}catch{}
   throw error;
  }
 }

 return {ok:true,egressId:newEgressId,source:input.source,destinations:outputs.map(x=>x.destination),replacedEgressId};
}
function egressStillActive(status:unknown){
 if(typeof status==='number')return [0,1,2].includes(status);
 return ['EGRESS_STARTING','EGRESS_ACTIVE','EGRESS_ENDING'].includes(String(status||'').toUpperCase());
}
async function reconcileActive(env:any){
 const raw=await env.LIVE_STATUS_KV.get(ACTIVE_KEY);let active:any=null;try{active=raw?JSON.parse(raw):null;}catch{}
 if(!active?.egressId)return {active:null,last:null};
 try{
  const listed=await callLiveKit(env,'ListEgress',{egress_id:active.egressId});
  const item=(listed?.items||[]).find((x:any)=>String(x.egress_id||x.egressId||'')===String(active.egressId));
  if(!item)return {active:{...active,providerStatus:'UNKNOWN'},last:null};
  if(item&&egressStillActive(item.status))return {active:{...active,providerStatus:item.status,providerUpdatedAt:item.updated_at||item.updatedAt||null},last:null};
  const terminal=typeof item.status==='number'?[3,4,5].includes(item.status):['EGRESS_COMPLETE','EGRESS_FAILED','EGRESS_ABORTED'].includes(String(item.status||'').toUpperCase());
  if(!terminal)return {active:{...active,providerStatus:'UNKNOWN'},last:null};
  await env.LIVE_STATUS_KV.delete(ACTIVE_KEY);
  return {active:null,last:item?{egressId:active.egressId,status:item.status,error:item.error||item.details?'Provider reported a broadcast failure':null}:null};
 }catch{
  return {active:{...active,providerStatus:'UNKNOWN'},last:null};
 }
}
export async function stopRestream(env:any){
 const reconciled=await reconcileActive(env),active=reconciled.active;
 if(!active?.egressId)return {ok:true,active:false};
 await callLiveKit(env,'StopEgress',{egress_id:active.egressId});
 await env.LIVE_STATUS_KV.delete(ACTIVE_KEY);return {ok:true,active:false};
}
export async function restreamStatus(env:Env){
 const state=await reconcileActive(env as any);
 return {active:state.active,last:state.last,destinations:await listDestinations(env)};
}