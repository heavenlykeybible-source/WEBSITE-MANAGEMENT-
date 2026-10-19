import { multipartUpload, MAX_MEDIA_BYTES } from './uploads';
import { LiveKitConnectionError, resolveLiveKitConfig, validateCloudConnection, checkLiveKitConnection, saveLiveKitConnection, liveKitConnectionStatus, recordLiveKitVerification, resetLiveKitConnection } from './livekit-config';
import { publicProgramme, serveBroadcastMedia, isPlaybackURL } from "./public-broadcast";
import { restreamStatus, saveDestination, setDestinationEnabled, removeDestination, startRestream, stopRestream } from './restream';
interface Env {
  MEDIA_ENGINE_SHARED_SECRET: string;
  MEDIA_ENGINE_VERSION?: string;
  DB: D1Database;
  MEDIA_R2: R2Bucket;
  LIVE_STATUS_KV: KVNamespace;
}

type Capability = { sub:string; role:string; iat:number; exp:number; nonce:string };
const ADMIN_ROLES = new Set(['Administrator','Super Administrator','Deputy Super Administrator']);
const json = (body: unknown, status=200, headers?: HeadersInit) => Response.json(body,{status,headers});
function fromHex(value:string):Uint8Array { if(!/^[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid signature'); const o=new Uint8Array(32); for(let i=0;i<32;i++)o[i]=parseInt(value.slice(i*2,i*2+2),16); return o; }
async function verifyCapability(token:string, secret:string):Promise<Capability|null>{
  const [encoded,signature]=token.split('.'); if(!encoded||!signature)return null;
  let p:Capability; try{p=JSON.parse(atob(encoded)) as Capability;}catch{return null;}
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  let valid=false; try{valid=await crypto.subtle.verify('HMAC',key,fromHex(signature) as unknown as BufferSource,new TextEncoder().encode(encoded));}catch{return null;}
  const now=Math.floor(Date.now()/1000); if(!valid||!p.sub||!p.nonce||!Number.isInteger(p.exp)||p.exp<now||p.iat>now+30||!ADMIN_ROLES.has(p.role))return null; return p;
}
function audit(env:Env, cap:Capability, action:string, type:string, id?:string){ return env.DB.prepare('INSERT INTO audit_events(actor_id,action,resource_type,resource_id) VALUES(?,?,?,?)').bind(cap.sub,action,type,id??null).run(); }
async function requireJson(request:Request){ try{return await request.json() as Record<string,unknown>}catch{return null;} }
function expiryHours(hours=48){return new Date(Date.now()+hours*3600000).toISOString();}

export default {
 async fetch(request:Request,env:Env):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname==='/'&&['GET','HEAD'].includes(request.method))return Response.redirect('https://heavenlykey.org/pages/admin#studio',302);
  if(url.pathname==='/health'&&request.method==='GET') return json({ok:true,service:'heavenlykey-media-engine',version:env.MEDIA_ENGINE_VERSION??'v1'});
  const marker=request.headers.get('X-Heavenly-Key-Internal'); const auth=request.headers.get('Authorization')??'';
  if(marker==='media-engine-public-v1' && request.method==='GET' && url.pathname==='/api/broadcast/live') {
    const row=await env.DB.prepare("SELECT session_id,title,status,source_type,source_ref,visual_media_id,fallback_media_id,started_at,last_heartbeat_at,reconnect_deadline FROM live_sessions WHERE status IN ('live','reconnecting') ORDER BY session_id DESC LIMIT 1").first();
    if(!row)return json({live:null});
     const safe=row as Record<string,unknown>;
     return json({live:{session_id:safe.session_id,title:safe.title,status:safe.status,source_type:safe.source_type,started_at:safe.started_at,reconnect_deadline:safe.reconnect_deadline}});
  }
  if(marker==='media-engine-public-v1' && request.method==='GET' && url.pathname==='/api/broadcast/programme') return publicProgramme(request,env);
  { const match=url.pathname.match(/^\/api\/broadcast\/media\/(\d+)\/object$/); if(marker==='media-engine-public-v1' && match && ['GET','HEAD'].includes(request.method))return serveBroadcastMedia(request,env,Number(match[1])); }
  if(url.pathname==='/api/media-engine/livekit/viewer-token'&&request.method==='POST'&&marker==='media-engine-public-v1'){
    const live=await env.DB.prepare("SELECT session_id,source_ref,title,status FROM live_sessions WHERE source_ref LIKE 'livekit:%' AND ((status='live' AND last_heartbeat_at>datetime('now','-180 seconds')) OR (status='reconnecting' AND reconnect_deadline>datetime('now'))) ORDER BY session_id DESC LIMIT 1").first<any>();
    if(!live)return json({error:'No LiveKit broadcast is active'},404);
    try { const {createLiveKitToken}=await import('./livekit'); const room='heavenlykey-live-'+live.session_id; return json({...(await createLiveKitToken((await resolveLiveKitConfig(env))??{},room,'viewer-'+crypto.randomUUID(),false)),title:live.title,sessionId:live.session_id}); }
    catch(e){return json({error:e instanceof Error?e.message:'Live transport unavailable'},503);}
  }

  if(marker!=='media-engine-v1'||!auth.startsWith('Bearer ')) return json({error:'Unauthorized'},401);
  const cap=await verifyCapability(auth.slice(7),env.MEDIA_ENGINE_SHARED_SECRET); if(!cap)return json({error:'Unauthorized'},401);

  const multipart=await multipartUpload(request,env,cap.sub);if(multipart)return multipart;
  {const m=url.pathname.match(/^\/api\/media\/(\d+)\/preview$/);if(m&&['GET','HEAD'].includes(request.method))return serveBroadcastMedia(request,env,Number(m[1]),true);}
  if(url.pathname==='/api/broadcast/playlist-order'&&request.method==='GET'){
    const result:Record<string,number[]>={radio:[],video:[]};
    for(const channel of ['radio','video']){
      const raw=await env.LIVE_STATUS_KV.get('playlist-order-'+channel);let ids:number[]=[];try{ids=raw?JSON.parse(raw):[];}catch(e){console.warn('Invalid playlist order state for '+channel,e);ids=[];}
      if(!Array.isArray(ids))ids=[];result[channel]=ids.filter(x=>Number.isSafeInteger(x)&&x>0).slice(0,50);
    }
    return json(result);
  }
  if(url.pathname==='/api/broadcast/playlist-order'&&request.method==='POST'){
    const b=await requireJson(request),channel=String(b?.channel??''),ids=Array.isArray(b?.media_ids)?b!.media_ids.map(Number):null;
    if(!['radio','video'].includes(channel)||!ids||ids.length>50||ids.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(ids).size!==ids.length)return json({error:'Enter a valid unique playlist order'},400);
    if(ids.length){
      const placeholders=ids.map(()=>'?').join(',');
      const rows=await env.DB.prepare(`SELECT media_id,media_type,status FROM media_objects WHERE media_id IN (${placeholders})`).bind(...ids).all<any>();
      if(rows.results.length!==ids.length||rows.results.some((m:any)=>m.status!=='published'||(channel==='video'&&m.media_type!=='video')||(channel==='radio'&&m.media_type!=='audio')))return json({error:'Playlist order contains unavailable or incompatible media'},400);
    }
    await env.LIVE_STATUS_KV.put('playlist-order-'+channel,JSON.stringify(ids));await audit(env,cap,'playlist.order','channel',channel);return json({ok:true,channel,media_ids:ids});
  }
  if(url.pathname==='/api/broadcast/settings'&&request.method==='GET'){const r=await env.DB.prepare('SELECT channel,playlist_enabled FROM broadcast_settings ORDER BY channel').all();return json({items:r.results});}
  if(url.pathname==='/api/broadcast/settings'&&request.method==='POST'){
    const b=await requireJson(request);if(!b||!['radio','video'].includes(String(b.channel))||typeof b.enabled!=='boolean')return json({error:'Choose a channel and playlist switch'},400);
    await env.DB.prepare('UPDATE broadcast_settings SET playlist_enabled=? WHERE channel=?').bind(b.enabled?1:0,String(b.channel)).run();await audit(env,cap,'playlist.switch','channel',String(b.channel));return json({ok:true});
  }
  {const match=url.pathname.match(/^\/api\/playout\/(\d+)\/cancel$/);if(match&&request.method==='POST'){const r=await env.DB.prepare("UPDATE playout_items SET status='cancelled' WHERE playout_id=? AND status IN ('scheduled','playing')").bind(Number(match[1])).run();if(!r.meta.changes)return json({error:'Active programme not found'},404);await audit(env,cap,'playout.cancel','playout',match[1]);return json({ok:true});}}
  if(url.pathname==='/api/media-engine/studio/preferences'&&['GET','POST'].includes(request.method)){
    const key='studio-preset-v1:'+cap.sub;
    if(request.method==='GET'){const stored=await env.LIVE_STATUS_KV.get(key);return json({preferences:stored?JSON.parse(stored):null});}
    const body=await requireJson(request),value=body?.preferences;if(!value||typeof value!=='object'||Array.isArray(value)||JSON.stringify(value).length>8000)return json({error:'Enter a studio preset up to 8 KB'},400);
    const prefs:Record<string,unknown>={};const textLimits:Record<string,number>={title:200,presenter:150,lowerThird:240,ticker:500,scripture:1000};
    for(const [k,max]of Object.entries(textLimits)){if(k in value){const v=(value as any)[k];if(typeof v!=='string'||v.length>max)return json({error:'Invalid studio text field: '+k},400);prefs[k]=v;}}
    const choices:Record<string,string[]>={format:['landscape-480','landscape-720','landscape-1080','portrait-720','portrait-1080','portrait-3-4','square-720','square-1080'],destination:['both','radio','video'],facing:['user','environment'],scene:['camera','screen','media','starting','break','ending'],backgroundMode:['none','blur','virtual','video'],backgroundPreset:['hkem-global','hkem-stage','nations-wall','world-map','sanctuary','prayer','europe-paris','europe-london','europe-rome','europe-alps','america-newyork','america-washington','america-coast','america-city','world-night','mission-clouds','royal-blue','wine-gold','clean-white','media-wall'],voicePreset:['condenser','speech','natural'],qualityPreset:['data','balanced','high']};
    for(const [k,values]of Object.entries(choices)){if(k in value){const v=(value as any)[k];if(!values.includes(v))return json({error:'Invalid studio selection: '+k},400);prefs[k]=v;}}
    for(const k of ['cameraVisible','mirror','muteIntermission','showBrand','showLowerThird','showTicker','duckMusic','subjectProtection','noiseSuppression','echoCancellation','autoGainControl','noiseGate','compressor','limiter'])if(k in value){if(typeof (value as any)[k]!=='boolean')return json({error:'Invalid studio switch'},400);prefs[k]=(value as any)[k];}
    for(const [k,max]of [['micGain',150],['mediaGain',100],['screenGain',100],['musicGain',100],['countdown',60],['backgroundStrength',100],['voiceClarity',100],['backgroundVideoId',999999999]] as const)if(k in value){const v=(value as any)[k];if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)return json({error:'Invalid studio mixer/countdown value'},400);prefs[k]=v;}
    await env.LIVE_STATUS_KV.put(key,JSON.stringify(prefs));await audit(env,cap,'studio.preset.save','studio');return json({ok:true});
  }

  if(url.pathname==='/api/media-engine/livekit/connection'&&['GET','POST'].includes(request.method)){
    if(!['Super Administrator','Deputy Super Administrator'].includes(cap.role))return json({error:'Owner or deputy access is required to configure streaming credentials'},403);
    if(request.method==='GET')return json(await liveKitConnectionStatus(env));
    const body=await requireJson(request);if(!body)return json({error:'Invalid JSON'},400);
    if(body.action==='reset'){await resetLiveKitConnection(env);await audit(env,cap,'livekit.reset','connection');return json({ok:true,...await liveKitConnectionStatus(env)});}
    try{
      const existing=body.action==='check'?await resolveLiveKitConfig(env):await resolveLiveKitConfig(env).catch(()=>null);
      const config=body.action==='check'?existing:validateCloudConnection({url:body.url||existing?.LIVEKIT_URL,apiKey:body.apiKey||existing?.LIVEKIT_API_KEY,apiSecret:body.apiSecret||existing?.LIVEKIT_API_SECRET});
      if(!config)return json({error:'No streaming connection is saved'},409);
      await checkLiveKitConnection(config);
      if(body.action!=='check'){await saveLiveKitConnection(env,config);await audit(env,cap,'livekit.configure','connection');}
      await recordLiveKitVerification(env,true);return json({ok:true,...await liveKitConnectionStatus(env)});
    }catch(e){if(e instanceof LiveKitConnectionError){if(body.action==='check')await recordLiveKitVerification(env,false,e.code);return json({error:e.message,code:e.code},e.status);}return json({error:'The saved streaming connection could not be read or updated. Re-enter the connection details to replace it.',code:'connection_storage_failed'},503);}

  }

  if(url.pathname==='/api/media-engine/status'&&request.method==='GET'){
    const services={database:false,storage:false,kv:false};
    try{await env.DB.prepare('SELECT 1 AS ok').first();services.database=true;}catch(e){console.warn('Media Engine DB health check failed',e);}
    try{await env.MEDIA_R2.list({limit:1});services.storage=true;}catch(e){console.warn('Media Engine R2 health check failed',e);}
    try{await env.LIVE_STATUS_KV.get('__hk_health_probe__');services.kv=true;}catch(e){console.warn('Media Engine KV health check failed',e);}
    const ok=services.database&&services.storage&&services.kv;
    return json({ok,account:'media-broadcast',version:env.MEDIA_ENGINE_VERSION??'v1',temporary_media:true,services,livekit_configured:!!(await resolveLiveKitConfig(env))},ok?200:503);
  }

  if(url.pathname==='/api/media-engine/restream'&&request.method==='GET'){
    if(!['Super Administrator','Deputy Super Administrator'].includes(cap.role))return json({error:'Owner or deputy access is required to manage social streaming destinations'},403);
    return json(await restreamStatus(env));
  }
  if(url.pathname==='/api/media-engine/restream/destination'&&request.method==='POST'){
    if(!['Super Administrator','Deputy Super Administrator'].includes(cap.role))return json({error:'Owner or deputy access is required to manage social streaming destinations'},403);
    const b=await requireJson(request);if(!b)return json({error:'Invalid JSON'},400);
    try{
      const destination=String(b.destination??'');
      const current=await restreamStatus(env);
      if(current.active?.destinations?.includes(destination))return json({error:'This destination is currently on air. Stop social distribution before editing, disabling or removing its stream key.'},409);
      if(String(b.action??'')==='remove'){
        const state=await restreamStatus(env);if(state.active?.destinations?.includes(String(b.destination??'')))return json({error:'Stop social distribution before removing an active destination.'},409);
        const result=await removeDestination(env,String(b.destination??''));await audit(env,cap,'restream.destination.remove','destination',String(b.destination??''));return json({ok:true,...result});
      }
      if(b.server_url!==undefined||b.stream_key!==undefined||b.url!==undefined){
        let combined=String(b.url??'').trim();
        if(!combined){
          const server=String(b.server_url??'').trim(),streamKey=String(b.stream_key??'').trim();
          if(!server||!streamKey||streamKey.length>512)return json({error:'Enter the platform server URL and stream key'},400);
          let parsed:URL;try{parsed=new URL(server);}catch{return json({error:'Enter a valid RTMP or RTMPS server URL'},400);}
          if(!['rtmp:','rtmps:'].includes(parsed.protocol)||parsed.username||parsed.password)return json({error:'Enter a valid RTMP or RTMPS server URL'},400);
          combined=server.replace(/\/+$/,'')+'/'+streamKey.replace(/^\/+/, '');
        }
        const result=await saveDestination(env,String(b.destination??''),combined,Boolean(b.enabled));await audit(env,cap,'restream.destination.save','destination',String(b.destination??''));return json({ok:true,...result});
      }
      await setDestinationEnabled(env,String(b.destination??''),Boolean(b.enabled));await audit(env,cap,'restream.destination.toggle','destination',String(b.destination??''));return json({ok:true});
    }catch(e){return json({error:e instanceof Error?e.message:'Destination could not be saved'},400);}
  }
  if(url.pathname==='/api/media-engine/restream/start'&&request.method==='POST'){
    if(!['Super Administrator','Deputy Super Administrator'].includes(cap.role))return json({error:'Owner or deputy access is required to start social streaming'},403);
    const b=await requireJson(request);if(!b)return json({error:'Invalid JSON'},400);
    try{const source=String(b.source??'live')==='247'?'247':'live';const channel=String(b.channel??'video')==='radio'?'radio':'video';const siteBase='https://heavenlykey.alldaywow247.workers.dev';const programmeUrl=source==='247'?siteBase+'/pages/'+(channel==='radio'?'radio':'video')+'.html?egress=1':undefined;const result=await startRestream(env,{source,sessionId:b.session_id?Number(b.session_id):undefined,programmeUrl,format:String(b.format??'landscape-720'),quality:String(b.quality??'balanced'),channel});await audit(env,cap,'restream.start','egress',result.egressId);return json(result,201);}catch(e){return json({error:e instanceof Error?e.message:'Social streaming could not start'},503);}
  }
  if(url.pathname==='/api/media-engine/restream/stop'&&request.method==='POST'){
    if(!['Super Administrator','Deputy Super Administrator'].includes(cap.role))return json({error:'Owner or deputy access is required to stop social streaming'},403);
    try{const result=await stopRestream(env);await audit(env,cap,'restream.stop','egress');return json(result);}catch(e){return json({error:e instanceof Error?e.message:'Social streaming could not stop'},503);}
  }


  if(url.pathname==='/api/media-engine/livekit/token'&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400);
    const room=String(b.room??'').trim(); const identity=String(b.identity??'').trim(); const publish=Boolean(b.publish);
    if(publish)return json({error:'Use a session-bound LiveKit publisher token for an active broadcast.'},403);
    if(!room||!identity||room.length>120||identity.length>120)return json({error:'room and identity are required'},400);
    try { const {createLiveKitToken}=await import('./livekit'); return json(await createLiveKitToken((await resolveLiveKitConfig(env))??{},room,identity,publish)); }
    catch(e){ return json({error:e instanceof Error?e.message:'Live transport unavailable'},503); }
  }

  if(url.pathname==='/api/media-engine/livekit/publisher-token'&&request.method==='POST'){
    const b=await requireJson(request); const sessionId=Number(b?.session_id); if(!Number.isInteger(sessionId))return json({error:'session_id is required'},400);
    const live=await env.DB.prepare("SELECT session_id,status,source_type,source_ref FROM live_sessions WHERE session_id=? AND status IN ('live','reconnecting')").bind(sessionId).first<any>();
    if(!live)return json({error:'Live session not active'},404);
    if(live.source_type!=='camera'||!String(live.source_ref).startsWith('livekit:'))return json({error:'This session is not a LiveKit camera broadcast'},409);
    const room='heavenlykey-live-'+sessionId;
    try { const {createLiveKitToken}=await import('./livekit'); const token=await createLiveKitToken((await resolveLiveKitConfig(env))??{},room,'publisher-'+cap.sub,true);
      await env.DB.prepare("UPDATE live_sessions SET last_heartbeat_at=CURRENT_TIMESTAMP WHERE session_id=?").bind(sessionId).run(); return json(token); }
    catch(e){return json({error:e instanceof Error?e.message:'Live transport unavailable'},503);}
  }

  if(url.pathname==='/api/media-engine/studio/capabilities'&&request.method==='GET') return json({
    formats:[
      {key:'landscape-480',label:'Low data 480p',width:854,height:480},
      {key:'portrait-1080',label:'Vertical 1080p',width:1080,height:1920},
      {key:'portrait-720',label:'Vertical 720p',width:720,height:1280},
      {key:'portrait-3-4',label:'Portrait 3:4',width:810,height:1080},
      {key:'landscape-720',label:'Landscape 720p',width:1280,height:720},
      {key:'landscape-1080',label:'Landscape 1080p',width:1920,height:1080},
      {key:'square-720',label:'Square 720p',width:720,height:720},
      {key:'square-1080',label:'Square 1080p',width:1080,height:1080}
    ],
    sources:['camera','screen','video','audio','picture','starting','break','ending'],
    production:{composed_output:true,preview_programme:true,scene_switching:true,screen_share:true,audio_mixer:true,programme_recording:true,private_presets:true,resumable_uploads:true,network_loss_advert:true,quality_profiles:['data','balanced','high']},
    camera:{front:true,rear:true,mirror_preview:true,original_mode:true,device_selection:true,virtual_background_mode:true,moving_video_background:true,subject_protection:true},
    audio:{
      microphone_toggle:true,
      permission_handling:true,
      native_noise_suppression:true,
      echo_cancellation:true,
      auto_gain_control:true,
      voice_enhancement:true,
      high_pass_hz:70,
      presence_boost_db:null,
      compressor_ratio:3,
      limiter:true,
      low_pass_hz:null
    },
    branding:{programme_banner:true,official_assets_supported:true},
    takeover:{live_to_prerecorded:true,prerecorded_to_live:true,automatic_24_7_resume:true},
    destinations:['website_video','website_radio'],
    transport:{live_camera_ingest:!!(await resolveLiveKitConfig(env)),external_stream_url:true,prerecorded_playback:true,social_publishing:true,multi_destination_rtmp:true,social_output_follows_studio_orientation:true}
  });

  if(url.pathname==='/api/media'&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400);
    const objectKey=String(b.object_key??''); const type=String(b.media_type??''); const mime=String(b.mime_type??''); const size=Number(b.size_bytes??0);
    if(!objectKey||!['image','audio','video'].includes(type)||!mime||!Number.isSafeInteger(size)||size<0||size>MAX_MEDIA_BYTES)return json({error:'Invalid media metadata or size'},400);
    const keep=Boolean(b.keep_media); const retention=keep?null:expiryHours(Number(b.retention_hours??48));
    const r=await env.DB.prepare('INSERT INTO media_objects(object_key,media_type,mime_type,size_bytes,status,keep_media,retention_until,created_by) VALUES(?,?,?,?,\'pending\',?,?,?)').bind(objectKey,type,mime,size,keep?1:0,retention,cap.sub).run();
    const id=Number(r.meta.last_row_id); await audit(env,cap,'media.register','media',String(id)); return json({media_id:id,retention_until:retention,keep_media:keep},201);
  }
  if(url.pathname==='/api/media'&&request.method==='GET'){
    const r=await env.DB.prepare('SELECT media_id,object_key,media_type,mime_type,size_bytes,status,keep_media,retention_until,created_at FROM media_objects WHERE status!=\'deleted\' ORDER BY created_at DESC LIMIT 50').all(); return json({items:r.results});
  }
  let m=url.pathname.match(/^\/api\/media\/(\d+)\/keep$/); if(m&&['GET','POST'].includes(request.method)){
    const media=await env.DB.prepare("SELECT object_key,media_type,status,keep_media,retention_until FROM media_objects WHERE media_id=? AND status!='deleted'").bind(Number(m[1])).first<{object_key:string;media_type:string;status:string;keep_media:number;retention_until:string|null}>();
    if(!media)return json({error:'Media not found'},404);
    const available=['approved','published'].includes(media.status)&&!!(await env.MEDIA_R2.head(media.object_key));
    if(request.method==='GET')return json({media_id:Number(m[1]),media_type:media.media_type,status:media.status,keep_media:!!media.keep_media,retention_until:media.retention_until,available});
    const b=await requireJson(request);
    if(!b||typeof b.keep!=='boolean')return json({error:'Specify a valid keep setting'},400);
    if(b.keep&&!available)return json({error:'Media upload is not complete or the stored file is unavailable'},409);
    if(!b.keep&&media.status==='published')return json({error:'Published radio/TV playlist files must remain retained. Unpublish first; the media file will remain stored.'},409);
    const retention=b.keep?null:expiryHours(Number(b.retention_hours??48));
    await env.DB.prepare("UPDATE media_objects SET keep_media=?,retention_until=?,updated_at=CURRENT_TIMESTAMP WHERE media_id=? AND status!='deleted'").bind(b.keep?1:0,retention,Number(m[1])).run();
    await audit(env,cap,'media.keep','media',m[1]);
    return json({ok:true,media_type:media.media_type,status:media.status,keep_media:b.keep});
  }
  m=url.pathname.match(/^\/api\/media\/(\d+)\/upload-url$/); if(m&&request.method==='POST'){
    const row=await env.DB.prepare('SELECT object_key,status FROM media_objects WHERE media_id=?').bind(Number(m[1])).first<{object_key:string,status:string}>(); if(!row||row.status==='deleted')return json({error:'Media not found'},404);
    return json({media_id:Number(m[1]),object_key:row.object_key,upload_mode:'multipart-r2',max_bytes:MAX_MEDIA_BYTES,chunk_bytes:8388608});
  }
  m=url.pathname.match(/^\/api\/media\/(\d+)\/upload$/); if(m&&request.method==='PUT'){
    const mediaId=Number(m[1]); if(!Number.isInteger(mediaId))return json({error:'Invalid media id'},400);
    const row=await env.DB.prepare('SELECT object_key,mime_type,status FROM media_objects WHERE media_id=?').bind(mediaId).first<{object_key:string,mime_type:string,status:string}>();
    if(!row||row.status==='deleted')return json({error:'Media not found'},404);
    if(!['pending','failed'].includes(row.status))return json({error:'This media is already uploaded'},409);
    const contentType=request.headers.get('Content-Type')??'';
    if(contentType!==row.mime_type)return json({error:'Content-Type does not match registered media'},415);
    if(!request.body)return json({error:'Upload body is required'},400);
    const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>26214400){await reader.cancel();return json({error:'Uploads are limited to 25MB'},413);}chunks.push(part.value);}
    if(!size)return json({error:'Upload body is empty'},400);
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    await env.MEDIA_R2.put(row.object_key,bytes,{httpMetadata:{contentType:row.mime_type}});
    await env.DB.prepare("UPDATE media_objects SET status='approved',size_bytes=?,updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(size,mediaId).run();
    await audit(env,cap,'media.upload','media',String(mediaId));
    return json({ok:true,media_id:mediaId,size_bytes:size});
  }

  m=url.pathname.match(/^\/api\/media\/(\d+)\/delete$/);if(m&&request.method==='POST'){
    const mediaId=Number(m[1]);
    const row=await env.DB.prepare("SELECT object_key,status FROM media_objects WHERE media_id=? AND status!='deleted'").bind(mediaId).first<any>();
    if(!row)return json({error:'Media not found'},404);
    const deletionRequest=await requireJson(request);
    if(deletionRequest?.protect_broadcast&&row.status==='published')return json({error:'A published radio or TV recording cannot be deleted by social-media cleanup.'},409);
    const activeLive=await env.DB.prepare("SELECT session_id FROM live_sessions WHERE status IN ('live','reconnecting') AND (visual_media_id=? OR fallback_media_id=? OR source_ref=?) LIMIT 1").bind(mediaId,mediaId,'media:'+mediaId).first();
    if(activeLive)return json({error:'This file is being used by the current live programme. End or switch the programme first.'},409);
    const scheduled=await env.DB.prepare("SELECT playout_id FROM playout_items WHERE media_id=? AND status IN ('scheduled','playing') AND julianday(ends_at)>julianday('now') LIMIT 1").bind(mediaId).first();
    if(scheduled)return json({error:'This file is used by an active or upcoming scheduled programme. Cancel that programme first.'},409);
    const upload=await env.DB.prepare("SELECT upload_id,status FROM media_uploads WHERE media_id=?").bind(mediaId).first<any>();
    if(upload?.status==='uploading'){try{await env.MEDIA_R2.resumeMultipartUpload(row.object_key,upload.upload_id).abort();}catch{return json({error:'The active upload could not be stopped safely. Retry before deleting this file.'},502);}}
    try{await env.MEDIA_R2.delete(row.object_key);}catch{return json({error:'Media storage deletion failed. Nothing was removed.'},502);}
    await env.DB.prepare("UPDATE media_objects SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(mediaId).run();
    await env.DB.prepare("DELETE FROM media_upload_parts WHERE media_id=?").bind(mediaId).run();
    await env.DB.prepare("DELETE FROM media_uploads WHERE media_id=?").bind(mediaId).run();
    await audit(env,cap,'media.delete','media',String(mediaId));
    return json({ok:true});
  }

  m=url.pathname.match(/^\/api\/media\/(\d+)\/publish$/);if(m&&request.method==='POST'){
    const b=await requireJson(request);if(typeof b?.published!=='boolean')return json({error:'Choose publish or unpublish'},400);
    const row=await env.DB.prepare("SELECT object_key,media_type,status,keep_media,retention_until FROM media_objects WHERE media_id=?").bind(Number(m[1])).first<any>();
    if(!row||!['approved','published'].includes(row.status))return json({error:'Upload media before publishing'},400);
    if(b.published && (!await env.MEDIA_R2.head(row.object_key) || (row.keep_media===0&&row.retention_until&&new Date(row.retention_until)<=new Date())))return json({error:'Media file is missing or expired'},400);
    if(b.published&&!['audio','video'].includes(row.media_type))return json({error:'Only audio or video belongs in the broadcast playlist'},400);
    await env.DB.prepare("UPDATE media_objects SET status=?,keep_media=1,retention_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(b.published?'published':'approved',Number(m[1])).run();
    await audit(env,cap,b.published?'media.publish':'media.unpublish','media',m[1]);return json({ok:true});
  }

  if(url.pathname==='/api/broadcast/live'&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400); const title=String(b.title??'Live Broadcast'); const source=String(b.source_type??'camera'); if(!['camera','video'].includes(source))return json({error:'Choose a camera stream or an uploaded video'},400);
    if(source==='camera'){const ref=String(b.source_ref??'');if(ref.startsWith('livekit:')&&!(await resolveLiveKitConfig(env)))return json({error:'Configure LiveKit before starting camera live'},503);if(!ref.startsWith('livekit:')){try{const stream=new URL(ref);if(!isPlaybackURL(ref))throw new Error();}catch{return json({error:'Use a direct HTTPS media stream, not your radio or video webpage. Camera broadcasting uses the Production studio.'},400);}}}
    if(source==='video'){const id=Number(b.visual_media_id??String(b.source_ref??'').replace(/^media:/,''));const media=await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=? AND media_type='video' AND status IN ('approved','published') AND (keep_media=1 OR retention_until IS NULL OR julianday(retention_until)>julianday('now'))").bind(id).first<any>();if(!media||!await env.MEDIA_R2.head(media.object_key))return json({error:'Select an uploaded, available video'},400);b.visual_media_id=id;b.source_ref='media:'+id;}
    const destination=String(b.destination??'both');if(!['radio','video','both'].includes(destination))return json({error:'Invalid broadcast destination'},400);
    if(b.fallback_media_id){const fallbackId=Number(b.fallback_media_id);const fallback=await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=? AND media_type='video' AND status IN ('approved','published') AND (keep_media=1 OR retention_until IS NULL OR julianday(retention_until)>julianday('now'))").bind(fallbackId).first<any>();if(!Number.isInteger(fallbackId)||!fallback||!await env.MEDIA_R2.head(fallback.object_key))return json({error:'Select an uploaded, available standby advert video'},400);b.fallback_media_id=fallbackId;}
    const active=await env.DB.prepare("SELECT session_id FROM live_sessions WHERE status IN ('live','reconnecting') LIMIT 1").first(); if(active)return json({error:'Another live session is active'},409);
    const r=await env.DB.prepare('INSERT INTO live_sessions(title,status,source_type,source_ref,visual_media_id,fallback_media_id,started_at,last_heartbeat_at,created_by,destination) VALUES(?,?,?, ?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,?)').bind(title,'live',source,b.source_ref?String(b.source_ref):null,b.visual_media_id?Number(b.visual_media_id):null,b.fallback_media_id?Number(b.fallback_media_id):null,cap.sub,destination).run(); const id=Number(r.meta.last_row_id); await audit(env,cap,'broadcast.start','live_session',String(id)); return json({session_id:id,status:'live'},201);
  }
  if(url.pathname==='/api/broadcast/live'&&request.method==='GET'){
    const row=await env.DB.prepare("SELECT * FROM live_sessions WHERE status IN ('live','reconnecting') ORDER BY session_id DESC LIMIT 1").first(); return json({live:row??null});
  }
  m=url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/heartbeat$/); if(m&&request.method==='POST'){
    const r=await env.DB.prepare("UPDATE live_sessions SET status='live',last_heartbeat_at=CURRENT_TIMESTAMP,reconnect_deadline=NULL WHERE session_id=? AND status IN ('live','reconnecting')").bind(Number(m[1])).run(); if(!r.meta.changes)return json({error:'Live session not active'},404); return json({ok:true});
  }
  m=url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/switch-to-video$/); if(m&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400);
    const sessionId=Number(m[1]); const mediaId=Number(b.media_id);
    if(!Number.isInteger(sessionId)||!Number.isInteger(mediaId))return json({error:'Invalid session or media id'},400);
    const media=await env.DB.prepare("SELECT media_id,object_key,status,media_type,keep_media,retention_until FROM media_objects WHERE media_id=?").bind(mediaId).first<{media_id:number,object_key:string,status:string,media_type:string,keep_media:number,retention_until:string|null}>();
    if(!media||!['approved','published'].includes(media.status)||media.media_type!=='video'||(media.keep_media===0&&media.retention_until!==null&&media.retention_until<=new Date().toISOString()))return json({error:'Prerecorded video is unavailable'},400);
    const live=await env.DB.prepare("SELECT session_id,source_type,source_ref,visual_media_id,status FROM live_sessions WHERE session_id=? AND status IN ('live','reconnecting')").bind(sessionId).first<{session_id:number,source_type:string,source_ref:string|null,visual_media_id:number|null,status:string}>();
    if(!live)return json({error:'Live session not active'},404);
    const r=await env.DB.prepare("UPDATE live_sessions SET source_type='video',source_ref=?,visual_media_id=?,status='live',last_heartbeat_at=CURRENT_TIMESTAMP,reconnect_deadline=NULL WHERE session_id=? AND status IN ('live','reconnecting')").bind('media:'+mediaId,mediaId,sessionId).run();
    if(!r.meta.changes)return json({error:'Live session not active'},404);
    await audit(env,cap,'broadcast.switch_to_prerecorded','live_session',String(sessionId));
    return json({ok:true,status:'live',source_type:'video',media_id:mediaId,previous_source:{source_type:live.source_type,source_ref:live.source_ref,visual_media_id:live.visual_media_id}});
  }
  m=url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/switch-to-livekit$/); if(m&&request.method==='POST'){
    const sessionId=Number(m[1]);if(!Number.isInteger(sessionId))return json({error:'Invalid session id'},400);
    if(!(await resolveLiveKitConfig(env)))return json({error:'LiveKit is not configured'},503);
    const live=await env.DB.prepare("SELECT session_id,status,source_type,source_ref FROM live_sessions WHERE session_id=? AND status IN ('live','reconnecting')").bind(sessionId).first<any>();
    if(!live)return json({error:'Live session not active'},404);
    const r=await env.DB.prepare("UPDATE live_sessions SET source_type='camera',source_ref=?,visual_media_id=NULL,status='live',last_heartbeat_at=CURRENT_TIMESTAMP,reconnect_deadline=NULL WHERE session_id=? AND status IN ('live','reconnecting')").bind('livekit:'+sessionId,sessionId).run();
    if(!r.meta.changes)return json({error:'Live session not active'},404);
    await audit(env,cap,'broadcast.switch_to_live','live_session',String(sessionId));
    return json({ok:true,status:'live',source_type:'camera',source_ref:'livekit:'+sessionId,session_id:sessionId});
  }
  m=url.pathname.match(/^\/api\/broadcast\/live\/(\d+)\/stop$/); if(m&&request.method==='POST'){
    const r=await env.DB.prepare("UPDATE live_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE session_id=? AND status IN ('live','reconnecting')").bind(Number(m[1])).run(); if(!r.meta.changes)return json({error:'Live session not active'},404); await audit(env,cap,'broadcast.stop','live_session',m[1]); return json({ok:true,status:'ended'});
  }

  if(url.pathname==='/api/playout'&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400); const media=Number(b.media_id); const start=new Date(String(b.starts_at)); const end=new Date(String(b.ends_at)); if(!Number.isInteger(media)||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return json({error:'Invalid playout window'},400);
    if(end.getTime()<=Date.now())return json({error:'Programme end time must be in the future'},400);
    const mr=await env.DB.prepare("SELECT media_id,keep_media,retention_until FROM media_objects WHERE media_id=? AND status IN ('approved','published')").bind(media).first<any>(); if(!mr)return json({error:'Media unavailable'},400);
    if(!mr.keep_media&&mr.retention_until&&new Date(mr.retention_until).getTime()<end.getTime())return json({error:'This temporary media will expire before the programme ends. Keep the file permanently or choose an earlier programme time.'},409);
    if(!await env.MEDIA_R2.head((await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=?").bind(media).first<any>())?.object_key??''))return json({error:'Media file is missing from storage'},400);
    const conflict=await env.DB.prepare("SELECT playout_id,title,starts_at,ends_at FROM playout_items WHERE status IN ('scheduled','playing') AND julianday(starts_at)<julianday(?) AND julianday(ends_at)>julianday(?) ORDER BY starts_at LIMIT 1").bind(end.toISOString(),start.toISOString()).first<any>();
    if(conflict)return json({error:'This time overlaps with another programme: '+conflict.title+' ('+conflict.starts_at+' – '+conflict.ends_at+').' },409);
    const title=String(b.title??'Prerecorded Broadcast').trim().slice(0,200)||'Prerecorded Broadcast';
    const r=await env.DB.prepare('INSERT INTO playout_items(media_id,title,starts_at,ends_at,created_by) VALUES(?,?,?,?,?)').bind(media,title,start.toISOString(),end.toISOString(),cap.sub).run(); const id=Number(r.meta.last_row_id); await audit(env,cap,'playout.schedule','playout',String(id)); return json({playout_id:id},201);
  }
  if(url.pathname==='/api/playout'&&request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM playout_items WHERE status IN (\'scheduled\',\'playing\') ORDER BY starts_at LIMIT 50').all(); return json({items:r.results});}

  if(url.pathname==='/api/social/accounts'&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400); const ch=String(b.channel_name??''); const ref=String(b.provider_account_ref??''); if(!ch||!ref)return json({error:'Missing account fields'},400); const r=await env.DB.prepare('INSERT INTO social_accounts(channel_name,provider_account_ref,automatable,created_by) VALUES(?,?,?,?)').bind(ch,ref,b.automatable===false?0:1,cap.sub).run(); return json({account_id:Number(r.meta.last_row_id)},201);
  }
  if(url.pathname==='/api/social/accounts'&&request.method==='GET'){const r=await env.DB.prepare('SELECT account_id,channel_name,status,automatable,created_at FROM social_accounts ORDER BY account_id DESC LIMIT 100').all();return json({items:r.results});}

  if(url.pathname==='/api/distribution/jobs'&&request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM distribution_jobs ORDER BY created_at DESC LIMIT 100').all();return json({items:r.results});}
  if(url.pathname==='/api/recordings'&&request.method==='POST'){
    const b=await requireJson(request); if(!b)return json({error:'Invalid JSON'},400);
    const objectKey=String(b.object_key??''); const title=String(b.title??'Live Recording'); const sessionId=b.live_session_id==null?null:Number(b.live_session_id);
    if(!objectKey||!title||title.length>200)return json({error:'Invalid recording metadata'},400);
    const head=await env.MEDIA_R2.head(objectKey); if(!head)return json({error:'Recording object not found in Media R2'},400);
    const keep=Boolean(b.keep_recording); const retention=keep?null:expiryHours(Number(b.retention_hours??48));
    const r=await env.DB.prepare('INSERT INTO recordings(object_key,title,live_session_id,keep_recording,retention_until,created_by) VALUES(?,?,?,?,?,?)').bind(objectKey,title,sessionId,keep?1:0,retention,cap.sub).run();
    const id=Number(r.meta.last_row_id);
    const accounts=await env.DB.prepare("SELECT account_id,channel_name FROM social_accounts WHERE status='connected' AND automatable=1").all<{account_id:number,channel_name:string}>();
    for(const a of accounts.results) await env.DB.prepare('INSERT OR IGNORE INTO distribution_jobs(recording_id,account_id,channel_name) VALUES(?,?,?)').bind(id,a.account_id,a.channel_name).run();
    await audit(env,cap,'recording.register','recording',String(id)); return json({recording_id:id,retention_until:retention,distribution_jobs:accounts.results.length},201);
  }
  let rm=url.pathname.match(/^\/api\/recordings\/(\d+)\/keep$/); if(rm&&request.method==='POST'){
    const b=await requireJson(request); const keep=Boolean(b?.keep); const retention=keep?null:expiryHours(Number(b?.retention_hours??48)); const r=await env.DB.prepare("UPDATE recordings SET keep_recording=?,retention_until=? WHERE recording_id=? AND status!='deleted'").bind(keep?1:0,retention,Number(rm[1])).run(); if(!r.meta.changes)return json({error:'Recording not found'},404); return json({ok:true});
  }
  rm=url.pathname.match(/^\/api\/recordings\/(\d+)$/); if(rm&&request.method==='DELETE'){
    const row=await env.DB.prepare("SELECT object_key FROM recordings WHERE recording_id=? AND status!='deleted'").bind(Number(rm[1])).first<{object_key:string}>(); if(!row)return json({error:'Recording not found'},404); try{await env.MEDIA_R2.delete(row.object_key);}catch{return json({error:'Recording storage deletion failed'},502);} await env.DB.prepare("UPDATE recordings SET status='deleted',retention_until=CURRENT_TIMESTAMP WHERE recording_id=?").bind(Number(rm[1])).run(); return json({ok:true});
  }
  if(url.pathname==='/api/campaigns'&&request.method==='POST'){
    const b=await requireJson(request);if(!b)return json({error:'Invalid JSON'},400);const when=new Date(String(b.scheduled_for));if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now())return json({error:'Choose a future planning time'},400);
    const title=String(b.title??'').trim();if(!title||title.length>200)return json({error:'Enter a title up to 200 characters'},400);
    if(b.media_id!=null){const id=Number(b.media_id);if(!Number.isSafeInteger(id))return json({error:'Invalid media'},400);const file=await env.DB.prepare("SELECT object_key FROM media_objects WHERE media_id=? AND status IN ('approved','published') AND (keep_media=1 OR julianday(retention_until)>julianday('now'))").bind(id).first<{object_key:string}>();if(!file||!await env.MEDIA_R2.head(file.object_key))return json({error:'Choose an available uploaded file'},400);}
    const r=await env.DB.prepare('INSERT INTO campaigns(title,scheduled_for,media_id,created_by) VALUES(?,?,?,?)').bind(title,when.toISOString(),b.media_id!=null?Number(b.media_id):null,cap.sub).run();return json({campaign_id:Number(r.meta.last_row_id)},201);
  }
  {const match=url.pathname.match(/^\/api\/campaigns\/(\d+)\/cancel$/);if(match&&request.method==='POST'){const r=await env.DB.prepare("UPDATE campaigns SET status='cancelled' WHERE campaign_id=? AND status='scheduled'").bind(Number(match[1])).run();if(!r.meta.changes)return json({error:'Active plan not found'},404);await audit(env,cap,'campaign.cancel','campaign',match[1]);return json({ok:true});}}
  if(url.pathname==='/api/campaigns'&&request.method==='GET'){const r=await env.DB.prepare('SELECT * FROM campaigns ORDER BY scheduled_for LIMIT 100').all();return json({items:r.results});}

  if(url.pathname==='/api/media-engine/cleanup'&&request.method==='POST'){
    const expired=await env.DB.prepare("SELECT media_id,object_key FROM media_objects WHERE status NOT IN ('deleted','published') AND keep_media=0 AND retention_until IS NOT NULL AND julianday(retention_until)<=julianday('now') LIMIT 50").all<{media_id:number,object_key:string}>();
    for(const x of expired.results){try{await env.MEDIA_R2.delete(x.object_key);}catch{continue;} await env.DB.prepare("UPDATE media_objects SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(x.media_id).run();}
    return json({deleted:expired.results.length});
  }
  return json({error:'Not found'},404);
 },
 async scheduled(_controller:ScheduledController,env:Env):Promise<void>{
   const expiredUploads=await env.DB.prepare("SELECT u.media_id,u.upload_id,m.object_key FROM media_uploads u JOIN media_objects m ON m.media_id=u.media_id WHERE u.status='uploading' AND julianday(u.expires_at)<=julianday('now') LIMIT 10").all<any>();for(const row of expiredUploads.results){try{await env.MEDIA_R2.resumeMultipartUpload(row.object_key,row.upload_id).abort();await env.DB.prepare("UPDATE media_uploads SET status='expired' WHERE media_id=?").bind(row.media_id).run();}catch{console.warn('Expired multipart cleanup will retry',row.media_id);}}
   const expiredRecordings=await env.DB.prepare("SELECT recording_id,object_key FROM recordings WHERE status!='deleted' AND keep_recording=0 AND retention_until IS NOT NULL AND julianday(retention_until)<=julianday('now') LIMIT 50").all<{recording_id:number,object_key:string}>();
   for(const r of expiredRecordings.results){try{await env.MEDIA_R2.delete(r.object_key);}catch{continue;}await env.DB.prepare("UPDATE recordings SET status='deleted' WHERE recording_id=?").bind(r.recording_id).run();await env.DB.prepare("UPDATE distribution_jobs SET status='cancelled',last_error='Recording retention expired',updated_at=CURRENT_TIMESTAMP WHERE recording_id=? AND status IN ('pending','processing','failed')").bind(r.recording_id).run();}

   const stale=await env.DB.prepare("SELECT session_id FROM live_sessions WHERE status='live' AND last_heartbeat_at<=datetime('now','-180 seconds')").all<{session_id:number}>();
   for(const x of stale.results){await env.DB.prepare("UPDATE live_sessions SET status='reconnecting',reconnect_deadline=datetime('now','+10 minutes') WHERE session_id=? AND status='live'").bind(x.session_id).run();}
   await env.DB.prepare("UPDATE live_sessions SET status='ended',ended_at=CURRENT_TIMESTAMP WHERE status='reconnecting' AND reconnect_deadline<=datetime('now')").run();
   await env.DB.prepare("UPDATE playout_items SET status='playing' WHERE status='scheduled' AND julianday(starts_at)<=julianday('now') AND julianday(ends_at)>julianday('now')").run();
   await env.DB.prepare("UPDATE playout_items SET status='completed' WHERE status='playing' AND julianday(ends_at)<=julianday('now')").run();
   const expired=await env.DB.prepare("SELECT media_id,object_key FROM media_objects WHERE status!='deleted' AND keep_media=0 AND retention_until IS NOT NULL AND julianday(retention_until)<=julianday('now') LIMIT 50").all<{media_id:number,object_key:string}>();
   for(const x of expired.results){try{await env.MEDIA_R2.delete(x.object_key);}catch{continue;} await env.DB.prepare("UPDATE media_objects SET status='deleted',updated_at=CURRENT_TIMESTAMP WHERE media_id=?").bind(x.media_id).run();}
 }
};

