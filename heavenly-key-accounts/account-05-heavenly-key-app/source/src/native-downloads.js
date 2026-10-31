// Native release distribution: signed packages must be uploaded to private R2.
// No download is counted unless a real package exists and is returned.
// Aggregate counts are private and require a configured admin bearer token.
const headers = {'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const platforms = {android:{extension:'apk',type:'application/vnd.android.package-archive'},windows:{extension:'msix',type:'application/msix'},mac:{extension:'dmg',type:'application/x-apple-diskimage'}};
const idPattern = /^[a-z0-9-]{1,64}$/;
const reply = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'content-type':'application/json; charset=utf-8'}});
function authorized(request,env) {
  const expected = env.DOWNLOAD_ADMIN_TOKEN;
  const provided = request.headers.get('authorization') || '';
  if(typeof expected !== 'string' || expected.length < 32 || !provided.startsWith('Bearer ')) return false;
  const actual = provided.slice(7);
  if(actual.length !== expected.length) return false;
  let mismatch=0;
  for(let i=0;i<actual.length;i++) mismatch |= actual.charCodeAt(i)^expected.charCodeAt(i);
  return mismatch===0;
}
export async function handleNativeDownloads(request,env) {
  const url=new URL(request.url);
  if(url.pathname==='/api/admin/download-counts') {
    if(request.method!=='GET') return reply({error:'Method not allowed'},405);
    // Administrator credentials must never be processed over HTTP or as URL parameters.
    if(url.protocol!=='https:' || url.search || url.username || url.password)
      return reply({error:'Secure request without query parameters required'},400);
    if(!authorized(request,env)) return reply({error:'Unauthorized'},401);
    if(!env.DOWNLOAD_DB) return reply({error:'Download statistics database not configured'},503);
    try {
      const result=await env.DOWNLOAD_DB.prepare('SELECT app_id, platform, downloads FROM native_download_counts ORDER BY app_id, platform').all();
      return reply({counts:result.results||[]});
    } catch { return reply({error:'Statistics database not initialized'},503); }
  }
  const match=/^\/api\/native-download\/([a-z0-9-]+)\/(android|windows|mac)$/.exec(url.pathname);
  if(!match) return null;
  if(request.method!=='GET' && request.method!=='HEAD') return reply({error:'Method not allowed'},405);
  if(url.search) return reply({error:'Query parameters not accepted'},400);
  const [,appId,platform]=match;
  if(!idPattern.test(appId)) return reply({error:'Invalid app'},400);
  // Never distribute an arbitrary object merely because its path matches.
  // The reviewed app catalogue is the only source of eligible IDs.
  try {
    const catalogResponse=await env.ASSETS.fetch(new Request(new URL('/app-downloads.json',url.origin),{redirect:'manual',credentials:'omit'}));
    if(catalogResponse.status!==200 || catalogResponse.headers.has('content-range') ||
       !/^application\/json(?:\s*;|\s*$)/i.test(catalogResponse.headers.get('content-type')||''))
      throw new Error('Catalogue unavailable');
    // An unbounded catalogue parse allows a compromised asset to exhaust Worker memory.
    const length=catalogResponse.headers.get('content-length');
    if(length!==null && (!/^\d+$/.test(length) || Number(length)>65536))throw new Error('Catalogue too large');
    const reader=catalogResponse.body?.getReader();
    if(!reader)throw new Error('Catalogue body missing');
    let total=0;const chunks=[];
    try {
      for(;;){
        const {done,value}=await reader.read();if(done)break;
        total+=value.length;
        if(total>65536){await reader.cancel();throw new Error('Catalogue too large');}
        chunks.push(value);
      }
    } finally {reader.releaseLock();}
    const bytes=new Uint8Array(total);let position=0;
    for(const chunk of chunks){bytes.set(chunk,position);position+=chunk.length;}
    const catalogue=JSON.parse(new TextDecoder().decode(bytes));
    if(!catalogue || typeof catalogue!=='object' || Array.isArray(catalogue))
      throw new Error('Invalid catalogue');
    if(!Object.prototype.hasOwnProperty.call(catalogue,appId)) return reply({error:'Unknown app'},404);
    const entry=catalogue[appId];
    if(!entry || typeof entry!=='object' || Array.isArray(entry) ||
       typeof entry.name!=='string' || !entry.name.trim() ||
       typeof entry.url!=='string')throw new Error('Invalid catalogue app');
    const destination=new URL(entry.url);
    const approvedHosts=new Set(['heavenlykey.org','www.heavenlykey.org',
      'apps.heavenlykey.org','onlinebible.heavenlykey.org','global.heavenlykey.org',
      'radio.heavenlykey.org','meeting.heavenlykey.org']);
    if(destination.protocol!=='https:' || !approvedHosts.has(destination.hostname) ||
       destination.port || destination.username || destination.password)
      throw new Error('Unapproved catalogue destination');
  } catch { return reply({error:'Download catalogue unavailable'},503); }
  if(!env.NATIVE_RELEASES) return reply({error:'Native downloads are not yet published'},503);
  const meta=platforms[platform];
  const key=appId+'/'+platform+'/release.'+meta.extension;
  try {
    const object=request.method==='HEAD' ? await env.NATIVE_RELEASES.head(key) : await env.NATIVE_RELEASES.get(key);
    if(!object) return reply({error:'Native installation package not available for this app and device'},404);
    // Reject malformed or implausibly large R2 object sizes before constructing download headers.
    if(!Number.isSafeInteger(object.size) || object.size<=0 || object.size>2147483648)
      return reply({error:'Native release size is invalid'},403);
    // A release is publishable only after the trusted release pipeline records its SHA-256.
    // This metadata is set by the publisher after malware scanning and signing checks.
    const sha256=object.customMetadata?.sha256;
    const scanned=object.customMetadata?.malwareScan;
    const signed=object.customMetadata?.signatureVerified;
    const scannedDigest=object.customMetadata?.scannedSha256;
    // A shared all-in-one binary may not be presented as a separately
    // installable app. The publisher must attest the exact app and device
    // identity of the reviewed package, not merely its R2 key.
    const releaseAppId=object.customMetadata?.appId;
    const releasePlatform=object.customMetadata?.platform;
    if(!/^[a-f0-9]{64}$/i.test(sha256||'') || scanned!=='passed' || signed!=='true' || scannedDigest!==sha256 || releaseAppId!==appId || releasePlatform!==platform) return reply({error:'Release has not passed security verification'},403);
    if(request.method==='HEAD') return new Response(null,{status:200,headers:{...headers,'content-type':meta.type,'content-length':String(object.size),'x-release-sha256':sha256}});
    // A valid object header alone does not prove R2 returned a readable package body.
    // Reject missing bodies before recording an initiated download.
    if (!object.body) return reply({error:'Native package body unavailable'},503);
    // A download event means a package response was initiated, not that the device installed it.
    // Use a single aggregate counter row rather than storing identifying visitor data.
    // Anonymous analytics are best-effort: a statistics outage must not block downloads.
    if(env.DOWNLOAD_DB) {
      try {
        await env.DOWNLOAD_DB.prepare('INSERT INTO native_download_counts (app_id, platform, downloads) VALUES (?, ?, 1) ON CONFLICT(app_id, platform) DO UPDATE SET downloads = downloads + 1').bind(appId,platform).run();
      } catch (error) {
        console.warn('Native download counter unavailable', String(error));
      }
    }
    return new Response(object.body,{status:200,headers:{...headers,'content-type':meta.type,'content-disposition':'attachment; filename="heavenly-key-'+appId+'.'+meta.extension+'"','content-length':String(object.size),'x-release-sha256':sha256}});
  } catch { return reply({error:'Download temporarily unavailable'},503); }
}
