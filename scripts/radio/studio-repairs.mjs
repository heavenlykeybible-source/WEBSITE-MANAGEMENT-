// Narrow edits to the current deployed bundle; unrelated studio code is retained.
export function repairStudioSource(input) {
  let source=input;const changes=[];
  function once(oldText,newText,label){
    if(source.includes(newText)&&!source.includes(oldText))return;
    const count=source.split(oldText).length-1;
    if(count!==1)throw Error('Cannot safely apply '+label+': expected one source match, found '+count);
    source=source.replace(oldText,newText);changes.push(label);
  }
  once("const api=(path,method='GET',data)=>request(path==='media'?'/api/media':'/api/media-engine/'+path,method,data);","const api=(path,method='GET',data)=>request(path==='media'?'/api/media':'/api/media-engine/'+(path==='capabilities'?'studio/capabilities':path),method,data);",'studio capabilities request');
  once('if (url.pathname === "/api/media-engine/studio/capabilities" && request.method === "GET")','if (["/api/media-engine/studio/capabilities", "/api/media-engine/capabilities"].includes(url.pathname) && request.method === "GET")','capabilities compatibility for cached interfaces');
  const oldQuery="SELECT session_id,title,status,source_type,source_ref,visual_media_id,fallback_media_id,destination,reconnect_deadline FROM live_sessions WHERE ((status='live' AND julianday(last_heartbeat_at)>julianday('now','-180 seconds')) OR (status='reconnecting' AND julianday(reconnect_deadline)>julianday('now'))) ORDER BY session_id DESC LIMIT 1";
  const newQuery=oldQuery.replace('WHERE ((',"WHERE destination IN (?, 'both') AND ((");
  once('env.DB.prepare('+JSON.stringify(oldQuery)+').first()', 'env.DB.prepare('+JSON.stringify(newQuery)+').bind(channel === "audio" ? "radio" : "video").first()','live radio and television selection');
  once('if (fallback && channel === "video")','if (fallback && (channel === "video" || fallback.media_type === "audio"))','radio audio fallback during reconnect');
  if(source.includes('Faith of Our Fathers · Live studio'))once('Faith of Our Fathers · Live studio','Heavenly Key · Live studio','studio heading');
  source=source.replaceAll('"ONLINE REVIVAL RADIO"','"HEAVENLY KEY RADIO"');
  return {source,changes};
}
