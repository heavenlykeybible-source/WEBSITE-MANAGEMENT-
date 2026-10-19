import {LiveKitConnectionError,resolveLiveKitConfig,checkLiveKitConnection} from './livekit-config';
import {restreamStatus} from './restream';
export async function connectionDiagnostics(env:any){
 const checks:Array<{name:string;state:string;detail:string}>=[];
 for(const [name,probe] of [['Database',()=>env.DB.prepare('SELECT 1 AS ok').first()],['Media storage',()=>env.MEDIA_R2.list({limit:1})],['Session storage',()=>env.LIVE_STATUS_KV.get('__hk_health_probe__')]] as const){try{await probe();checks.push({name,state:'passed',detail:'Existing binding responded.'});}catch{checks.push({name,state:'failed',detail:'The existing binding could not be read. Check its configuration; do not replace or reset it.'});}}
 let transportReady=false;
 try{const config=await resolveLiveKitConfig(env);if(config){await checkLiveKitConnection(config);transportReady=true;checks.push({name:'Live broadcast connection',state:'passed',detail:'LiveKit accepted the saved connection. A device preview and on-air test are still needed.'});}else checks.push({name:'Live broadcast connection',state:'setup_needed',detail:'No complete LiveKit connection is saved.'});}catch(e){checks.push({name:'Live broadcast connection',state:'failed',detail:e instanceof LiveKitConnectionError?e.message:'The saved connection could not be read or checked. Preserve existing secrets and inspect the configuration.'});}
 let stream:any=null;
 try{stream=await restreamStatus(env);}catch{checks.push({name:'Streaming destinations',state:'failed',detail:'Saved streaming destinations could not be read. Existing credentials were preserved. Check the original media encryption secret.'});}
 const facebook=stream?.destinations?.find((x:any)=>x.destination==='facebook');
 let facebookDetail='Facebook configuration could not be checked.',facebookState='unknown';
 if(stream){if(!facebook?.configured){facebookState='setup_needed';facebookDetail='No Facebook RTMP destination is saved in this Studio. Prepare an event in Facebook Live Producer, then save its server URL and stream key in Connections.';}
 else if(!facebook.enabled){facebookState='disabled';facebookDetail='A Facebook destination is saved but disabled. Select Facebook in the Studio final check before broadcasting.';}
 else if(!transportReady){facebookState='blocked';facebookDetail='The Facebook destination is saved, but the LiveKit connection did not pass. Fix that connection first.';}
 else if(stream.active?.destinations?.includes('facebook')){facebookState=stream.active.providerStatus==='UNKNOWN'?'unverified':'stream_requested';facebookDetail='Facebook is included in the current distribution request. This does not confirm Facebook is publicly live. Check Live Producer and the provider status.';}
 else{facebookState='ready_to_test';facebookDetail='A Facebook destination is saved and enabled. Start a programme, choose Facebook and confirm the incoming stream in Facebook Live Producer. No stream is started by this check.';}}
 checks.push({name:'Facebook',state:facebookState,detail:facebookDetail});
 return {checkedAt:new Date().toISOString(),checks,liveBroadcastVerified:false,facebookPublicLiveVerified:false,startsBroadcast:false};
}
