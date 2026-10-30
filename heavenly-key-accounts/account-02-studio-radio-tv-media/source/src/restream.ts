import { resolveLiveKitConfig } from './livekit-config';
import { signLiveKitGrant } from './livekit';

type Env={LIVE_STATUS_KV:KVNamespace;MEDIA_ENGINE_SHARED_SECRET:string};
const CONFIG_KEY='restream-destinations-v1';
const ACTIVE_KEY='restream-active-egress-v1';
const allowed=new Set(['youtube','facebook','tiktok','instagram','linkedin','x']);
function validStreamingOutput(urlValue:string):boolean{
 try{
  const url=new URL(urlValue);
  if(url.protocol!=='rtmps:'||!url.hostname||url.username||url.password||url.hash||url.href.length>2048)return false;
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  // RTMPS alone does not make an arbitrary local network target safe.
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||host.endsWith('.test')||host.endsWith('.invalid')||host.endsWith('.example')||/^\d+\.\d+\.\d+\.\d+$/.test(host)||host.startsWith('['))return false;
  return true;
 }catch{return false;}
}

// Authoritative D1 state: KV is intentionally not used for broadcast decisions.
async function readActiveState(env:any):Promise<any|null>{
 const row=await env.DB.prepare("SELECT payload FROM restream_active_state WHERE state_key='active'").first() as {payload:string}|null;
 if(!row){
  // Preserve an existing on-air broadcast when upgrading from the legacy KV
  // storage. The INSERT is atomic, so parallel readers cannot overwrite D1.
  const legacy=await env.LIVE_STATUS_KV.get(ACTIVE_KEY);
  if(!legacy)return null;
  let parsed:any;
  try{parsed=JSON.parse(legacy);}catch{throw new Error('Legacy broadcast state is invalid. Manual recovery is required.');}
  if(!parsed||typeof parsed.egressId!=='string'||!parsed.egressId.trim())throw new Error('Legacy broadcast state is invalid. Manual recovery is required.');
  await env.DB.prepare("INSERT INTO restream_active_state (state_key,payload,updated_at) VALUES ('active',?,unixepoch()) ON CONFLICT(state_key) DO NOTHING").bind(JSON.stringify(parsed)).run();
  const adopted=await env.DB.prepare("SELECT payload FROM restream_active_state WHERE state_key='active'").first() as {payload:string}|null;
  if(!adopted)throw new Error('Broadcast state migration could not be verified.');
  try{return JSON.parse(adopted.payload);}catch{throw new Error('Stored broadcast state is invalid. Manual recovery is required.');}
 }
 try{return JSON.parse(row.payload);}catch{throw new Error('Stored broadcast state is invalid. Manual recovery is required.');}
}
async function writeActiveState(env:any,state:unknown){
 await env.DB.prepare("INSERT INTO restream_active_state (state_key,payload,updated_at) VALUES ('active',?,unixepoch()) ON CONFLICT(state_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at").bind(JSON.stringify(state)).run();
}
async function clearActiveState(env:any){
 // Keep an explicit null tombstone so stale legacy KV can never be imported again.
 await writeActiveState(env,null);
}

// D1's unique primary key serializes commands across Worker isolates.
// Requires migration 0006 before this release is deployed.
async function withBroadcastLock<T>(env:any,operation:()=>Promise<T>):Promise<T>{
 const owner=crypto.randomUUID();
 const acquired=await env.DB.prepare(
  "INSERT INTO restream_operation_lock (lock_name,owner,expires_at) VALUES ('social-distribution',?,unixepoch()+180) ON CONFLICT(lock_name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE restream_operation_lock.expires_at <= unixepoch()"
 ).bind(owner).run();
 if(!acquired.meta?.changes)throw new Error('Another broadcast operation is in progress. Try again shortly.');
 try{return await operation();}
 finally{try{await env.DB.prepare("DELETE FROM restream_operation_lock WHERE lock_name='social-distribution' AND owner=?").bind(owner).run();}catch{/* Lock automatically expires if release fails. */}}
}

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
 try{const {iv,data}=JSON.parse(stored);const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(iv)},await key(env),Uint8Array.from(data));return JSON.parse(new TextDecoder().decode(plain)) as T;}catch{throw new Error('Stored streaming destinations cannot be decrypted. Restore the encryption secret or recover the destination configuration.');}
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
 if(!validStreamingOutput(u.href))throw new Error('Use a secure public-hostname RTMPS URL without embedded credentials or fragments.');
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
  return validStreamingOutput(v.url);
 }).map(([destination,v])=>({destination,url:v.url}));
}
async function callLiveKit(env:any,method:string,body:unknown){
 if(!['StartEgress','StopEgress','ListEgress'].includes(method))throw new Error('Unsupported LiveKit operation.');
 const config=await resolveLiveKitConfig(env);if(!config)throw new Error('LiveKit connection is not configured.');
 let base:URL;
 try{base=new URL(config.LIVEKIT_URL);}catch{throw new Error('LiveKit project URL is invalid.');}
 // Match the Cloud-only policy enforced when credentials are saved.
 // Never transmit a signed LiveKit token to an arbitrary environment URL.
 if(base.protocol!=='wss:'||base.username||base.password||base.hash||base.search||base.pathname!=='/'||base.port||!/^[-a-z0-9]+\.livekit\.cloud$/i.test(base.hostname))throw new Error('LiveKit must use a secure LiveKit Cloud project URL.');
 const token=await signLiveKitGrant(config,{roomRecord:true});
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
 return withBroadcastLock(env,async()=>{
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
  // Restrict browser egress to explicitly approved programme origins.
  // A public hostname alone cannot prevent DNS rebinding or redirect-based SSRF.
  const approved=['heavenlykey.alldaywow247.workers.dev',...String(env.STUDIO_247_ALLOWED_HOSTS??'').split(',').map((value:string)=>value.trim().toLowerCase()).filter(Boolean)];
  if(!approved.includes(host)||u.port&&u.port!=='443')throw new Error('24/7 programme source hostname is not approved for broadcasting.');
  // The built-in programme origin can render only the known radio/video pages.
  // Reject unexpected routes and query parameters that could trigger navigation.
  if(host==='heavenlykey.alldaywow247.workers.dev'&&(!['/pages/radio.html','/pages/video.html'].includes(u.pathname)||u.search!=='?egress=1'))throw new Error('24/7 programme source must use the approved radio or video broadcast page.');
  body={web:{url:u.href,await_start_signal:false},preset,outputs:[{stream:{protocol:'RTMP',urls:outputs.map(x=>x.url)}}]};
 }
 // Check all inputs before ending an existing on-air egress. An invalid
 // replacement must never silence the currently running programme.
 const previous=await reconcileActive(env);
 if(previous.active?.providerStatus==='UNKNOWN')throw new Error('Current broadcast status is unconfirmed. Verify the provider before replacing this programme.');
 const replacedEgressId=previous.active?.egressId?String(previous.active.egressId):null;
 // Establish the replacement before touching the existing broadcast.
 // A failed StartEgress must not take the current programme off air.
 const result=await callLiveKit(env,'StartEgress',body);
 const newEgressId=String(result.egress_id??result.egressId??'');
 if(!newEgressId)throw new Error('LiveKit did not return an egress ID.');
 // Persist the replacement before retiring the old stream, so an interrupted
 // handoff does not leave the only active stream untracked.
 const replacementState={egressId:newEgressId,source:input.source,sessionId:input.source==='live'?input.sessionId:undefined,channel:input.source==='247'?(input.channel??'video'):undefined,format,quality:input.quality??'balanced',destinations:outputs.map(x=>x.destination),startedAt:new Date().toISOString()};
 try{await writeActiveState(env,replacementState);}
 catch(error){try{await callLiveKit(env,'StopEgress',{egress_id:newEgressId});}catch{}throw error;}
 if(replacedEgressId){
  try{
   await callLiveKit(env,'StopEgress',{egress_id:replacedEgressId});
  }catch(error){
   // If cancellation of the replacement fails, retain its D1 state so
   // operators can still identify and stop it. Never restore a stale ID.
   try{await callLiveKit(env,'StopEgress',{egress_id:newEgressId});}
   catch{throw new Error('Broadcast handoff is incomplete. The replacement stream may still be active; verify both egress IDs in LiveKit before retrying.');}
   try{if(previous.active)await writeActiveState(env,previous.active);else await clearActiveState(env);}
   catch{throw new Error('Broadcast handoff rollback could not restore state. Verify the LiveKit egresses and D1 state before retrying.');}
   throw error;
  }
 }

 return {ok:true,egressId:newEgressId,source:input.source,destinations:outputs.map(x=>x.destination),replacedEgressId};
 });
}
function egressStillActive(status:unknown){
 if(typeof status==='number')return [0,1,2].includes(status);
 return ['EGRESS_STARTING','EGRESS_ACTIVE','EGRESS_ENDING'].includes(String(status||'').toUpperCase());
}
async function reconcileActive(env:any){
 const active=await readActiveState(env);
 if(!active?.egressId)return {active:null,last:null};
 try{
  const listed=await callLiveKit(env,'ListEgress',{egress_id:active.egressId});
  const item=(listed?.items||[]).find((x:any)=>String(x.egress_id||x.egressId||'')===String(active.egressId));
  if(!item)return {active:{...active,providerStatus:'UNKNOWN'},last:null};
  if(item&&egressStillActive(item.status))return {active:{...active,providerStatus:item.status,providerUpdatedAt:item.updated_at||item.updatedAt||null},last:null};
  const terminal=typeof item.status==='number'?[3,4,5,6].includes(item.status):['EGRESS_COMPLETE','EGRESS_FAILED','EGRESS_ABORTED','EGRESS_LIMIT_REACHED'].includes(String(item.status||'').toUpperCase());
  if(!terminal)return {active:{...active,providerStatus:'UNKNOWN'},last:null};
  // Status reads must never erase a new broadcast's state during handoff.
  // A subsequent locked start or stop replaces/clears this terminal record.
  return {active:null,last:item?{egressId:active.egressId,status:item.status,error:item.error||item.details?'Provider reported a broadcast failure':null}:null};
 }catch{
  return {active:{...active,providerStatus:'UNKNOWN'},last:null};
 }
}
export async function stopRestream(env:any){
 return withBroadcastLock(env,async()=>{
 const reconciled=await reconcileActive(env),active=reconciled.active;
 if(!active?.egressId){await clearActiveState(env);return {ok:true,active:false};}
 await callLiveKit(env,'StopEgress',{egress_id:active.egressId});
 await clearActiveState(env);return {ok:true,active:false};
 });
}
export async function restreamStatus(env:Env){
 const state=await reconcileActive(env as any);
 return {active:state.active,last:state.last,destinations:await listDestinations(env)};
}