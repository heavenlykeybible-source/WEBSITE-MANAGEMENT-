export function youtubeVideoId(value:string):string|null {try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;let id:string|null=null;if(u.hostname==='youtu.be')id=u.pathname.slice(1).split('/')[0];else if(['youtube.com','www.youtube.com','m.youtube.com','www.youtube-nocookie.com'].includes(u.hostname)){id=u.pathname==='/watch'?u.searchParams.get('v'):/^\/(?:embed|shorts|live)\/([^/]+)/.exec(u.pathname)?.[1]||null;}return id&&/^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;}catch{return null;}}
export function isPlaybackURL(value:string):boolean {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!(u.hostname==='heavenlykey.alldaywow247.workers.dev'&&!u.pathname.startsWith('/api/broadcast/media/'));}catch{return false;}}
export interface BroadcastEnv { DB:D1Database; MEDIA_R2:R2Bucket; LIVE_STATUS_KV?:KVNamespace }
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const ready="m.status IN ('approved','published') AND (m.status='published' OR m.keep_media=1 OR m.retention_until IS NULL OR julianday(m.retention_until)>julianday('now'))";

/** Only media deliberately published or selected for an active programme is public. */
export async function eligibleMedia(env:BroadcastEnv,id:number):Promise<any>{
 return env.DB.prepare(`SELECT m.* FROM media_objects m WHERE m.media_id=? AND ${ready} AND
 (m.status='published' OR EXISTS (SELECT 1 FROM playout_items p WHERE p.media_id=m.media_id AND p.status IN ('scheduled','playing') AND julianday(p.starts_at)<=julianday('now') AND julianday(p.ends_at)>julianday('now'))
 OR EXISTS (SELECT 1 FROM live_sessions l WHERE ((l.status='live' AND julianday(l.last_heartbeat_at)>julianday('now','-180 seconds')) OR (l.status='reconnecting' AND julianday(l.reconnect_deadline)>julianday('now'))) AND (l.visual_media_id=m.media_id OR l.fallback_media_id=m.media_id OR l.source_ref='media:'||m.media_id)))`).bind(id).first();
}

function mediaItem(m:any){return {mediaId:m.media_id,title:m.object_key.split('/').pop()??'Ministry programme',type:m.media_type,mimeType:m.mime_type,url:`/api/broadcast/media/${m.media_id}/object`};}

export async function publicProgramme(request:Request,env:BroadcastEnv):Promise<Response>{
 const channel=new URL(request.url).searchParams.get('channel')==='radio'?'audio':'video';
 const live=await env.DB.prepare("SELECT session_id,title,status,source_type,source_ref,visual_media_id,fallback_media_id,destination,reconnect_deadline FROM live_sessions WHERE ((status='live' AND julianday(last_heartbeat_at)>julianday('now','-180 seconds')) OR (status='reconnecting' AND julianday(reconnect_deadline)>julianday('now'))) ORDER BY session_id DESC LIMIT 1").first<any>();
 if(live&&(live.destination==='both'||live.destination===(channel==='audio'?'radio':'video'))){
  if(live.status==='reconnecting'){
   const fallbackId=Number(live.fallback_media_id);
   const fallback=Number.isInteger(fallbackId)&&fallbackId>0?await eligibleMedia(env,fallbackId):null;
   if(fallback&&channel==='video')return json({mode:'reconnecting',title:live.title+' · connection break',items:[mediaItem(fallback)],reconnectDeadline:live.reconnect_deadline});
  } else {
   const id=live.visual_media_id??Number(String(live.source_ref).replace(/^media:/,''));
   const media=Number.isInteger(id)&&id>0?await eligibleMedia(env,id):null;
   if(media&&(channel==='video'||media.media_type==='audio')) return json({mode:'live',title:live.title,items:[mediaItem(media)]});
   if(live.source_type==='camera'){
   const ref=String(live.source_ref??'');
   if(ref.startsWith('livekit:')) return json({mode:'live',transport:'livekit',title:live.title,sessionId:live.session_id,items:[]});
   const youtube=youtubeVideoId(ref);if(youtube&&channel==='video')return json({mode:'live',transport:'youtube',title:live.title,videoId:youtube,sessionId:live.session_id,items:[]});
   try {const url=new URL(ref);if(isPlaybackURL(ref))return json({mode:'live',title:live.title,items:[{title:live.title,type:channel,url:url.href}]});}catch{}
   }
  }
 }
 const channelFilter=channel==='audio'?"m.media_type='audio'":"m.media_type='video'";
 const scheduled=await env.DB.prepare(`SELECT m.*,p.title AS programme_title FROM playout_items p JOIN media_objects m ON m.media_id=p.media_id WHERE p.status IN ('scheduled','playing') AND julianday(p.starts_at)<=julianday('now') AND julianday(p.ends_at)>julianday('now') AND ${channelFilter} AND ${ready} ORDER BY p.starts_at DESC LIMIT 1`).first<any>();
 if(scheduled)return json({mode:'scheduled',title:scheduled.programme_title,items:[mediaItem(scheduled)]});
 const settings=await env.DB.prepare('SELECT playlist_enabled FROM broadcast_settings WHERE channel=?').bind(channel==='audio'?'radio':'video').first<{playlist_enabled:number}>();
 if(settings?.playlist_enabled===0)return json({mode:'offline',title:channel==='audio'?'ONLINE REVIVAL RADIO':'FAITH OF OUR FATHERS TV',items:[]});
 const playlist=await env.DB.prepare(`SELECT m.* FROM media_objects m WHERE ${channelFilter} AND m.status='published' AND ${ready} ORDER BY CASE WHEN m.media_type='audio' THEN 0 ELSE 1 END,m.media_id LIMIT 50`).all();
 let entries=playlist.results;
 const orderKey='playlist-order-'+(channel==='audio'?'radio':'video');let order:number[]=[];try{const raw=await env.LIVE_STATUS_KV.get(orderKey);order=raw?JSON.parse(raw):[];}catch(e){console.warn('Invalid public playlist order state',orderKey,e);order=[];}
 if(Array.isArray(order)&&order.length){const rank=new Map(order.map((id:any,index:number)=>[Number(id),index]));entries=[...entries].sort((a:any,b:any)=>(rank.get(a.media_id)??10000+a.media_id)-(rank.get(b.media_id)??10000+b.media_id));}
 return json({mode:entries.length?'playlist':'offline',title:channel==='audio'?'ONLINE REVIVAL RADIO':'FAITH OF OUR FATHERS TV',items:entries.map(mediaItem)});
}

export async function serveBroadcastMedia(request:Request,env:BroadcastEnv,id:number,adminPreview=false):Promise<Response>{
 const media=adminPreview?await env.DB.prepare("SELECT * FROM media_objects WHERE media_id=? AND status IN ('approved','published') AND (status='published' OR keep_media=1 OR retention_until IS NULL OR julianday(retention_until)>julianday('now'))").bind(id).first<any>():await eligibleMedia(env,id);
 if(!media||!['audio','video','image'].includes(media.media_type))return json({error:'Media unavailable'},404);
 const range=request.headers.get('Range');
 if(range&&!/^bytes=(\d+-\d*|-\d+)$/.test(range))return new Response(null,{status:416});
 const head=await env.MEDIA_R2.head(media.object_key);
 if(!head)return json({error:'Media unavailable'},404);
 if(range){const r=/^bytes=(\d+)-(\d*)$/.exec(range);if((r&&(Number(r[1])>=head.size||(r[2]&&Number(r[2])<Number(r[1]))))||range==='bytes=-0')return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+head.size}});}
 const object=request.method==='HEAD'?head:await env.MEDIA_R2.get(media.object_key,range?{range:request.headers}:undefined);
 if(!object)return json({error:'Media unavailable'},404);
 const headers=new Headers({'Content-Type':media.mime_type,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"});
 headers.set('ETag',object.httpEtag);
 const part=object.range as {offset?:number;length?:number}|undefined;
 let status=200;
 if(range&&part?.offset!==undefined&&part.length!==undefined){status=206;headers.set('Content-Range',`bytes ${part.offset}-${part.offset+part.length-1}/${object.size}`);headers.set('Content-Length',String(part.length));}
 else headers.set('Content-Length',String(object.size));
 return new Response(request.method==='HEAD'?null:(object as R2ObjectBody).body,{status,headers});
}
