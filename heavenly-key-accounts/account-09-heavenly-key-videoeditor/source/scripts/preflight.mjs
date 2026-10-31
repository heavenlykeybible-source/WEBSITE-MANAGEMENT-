import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const required = ['index.html','_headers','public/index.html','public/_headers','schema.sql','wrangler.toml','functions/api/[[path]].js','tests/be.mjs'];
for (const path of required) if (!existsSync(path)) throw Error(`Missing ${path}`);
const staticHeaders=readFileSync('_headers','utf8');
const deployHeaders=readFileSync('public/_headers','utf8');
if(staticHeaders!==deployHeaders) throw Error('Security header configurations must match');
if(!deployHeaders.includes("manifest-src 'self'")) throw Error('Manifest source policy missing');

for (const path of ['functions/api/[[path]].js','scripts/provision-roles.mjs']) execFileSync(process.execPath,['--check',path],{stdio:'inherit'});
const apiSource=readFileSync('functions/api/[[path]].js','utf8');
if(!apiSource.includes(".replace(/^[.\\- ]+/, '').replace(/\\.{2,}/g, '.')"))throw Error('Uploaded filename normalization missing');
if(!apiSource.includes(".replace(/[. ]+$/, '')"))throw Error('Trailing filename cleanup missing');
if(!apiSource.includes("rawName.includes(':')"))throw Error('Colon filename rejection missing');
if(!apiSource.includes('rawName.length > 255'))throw Error('Raw filename length limit missing');
if(!apiSource.includes('let id, key, saved = false;') || !apiSource.includes('saved = true;') || !apiSource.includes('if (!saved) {'))throw Error('Media upload quota rollback tracking missing');
if(!apiSource.includes('if (saved.meta.changes) await env.MEDIA.delete(r.r2_key).catch(() => {});'))throw Error('Media delete must confirm DB update before R2 cleanup');
if(!apiSource.includes('SELECT r2_key,size FROM media') || !apiSource.includes('bind(r.size,u.id).run()'))throw Error('Media delete size reuse missing');
if(!apiSource.includes('c.charCodeAt(0) < 32') || !apiSource.includes('c.charCodeAt(0) === 127'))throw Error('Control-character filename rejection missing');
if(!apiSource.includes('Filename extension does not match media type.') || !apiSource.includes('Unsafe filename extension.'))throw Error('Media extension validation missing');
if(!apiSource.includes('if (!suffix || !extensions[type]?.includes(suffix))'))throw Error('Missing-extension upload protection absent');
if((apiSource.match(/const suffix=name\.includes/g)||[]).length!==1)throw Error('Media filename validation must occur in one route only');
if(apiSource.indexOf('const suffix=name.includes') < apiSource.indexOf("if (a === 'media')"))throw Error('Media filename validation misplaced before media route');
if(apiSource.indexOf('const suffix=name.includes') > apiSource.indexOf("if (p[1] && m === 'GET')",apiSource.indexOf("if (a === 'media')")))throw Error('Media filename validation misplaced after upload handler');
if(apiSource.slice(apiSource.indexOf("if (a === 'transcribe'"),apiSource.indexOf("if (a === 'media')")).includes('const suffix=name.includes'))throw Error('Media upload validation leaked into transcription');
if(!apiSource.includes("'image/png':['png']") || !apiSource.includes("'image/jpeg':['jpg','jpeg']"))throw Error('Approved image extension mappings missing');
if(!apiSource.includes("'php5','php7'") || !apiSource.includes("'jsp','jspx'"))throw Error('Alternate script extension protections missing');
// Binary API responses bypass the JSON response helper; require their own isolation headers.
for(const header of ["'cross-origin-resource-policy':'same-origin'", "'cross-origin-resource-policy': 'same-origin'"]){
  if(!apiSource.includes(header))throw Error('Missing binary response resource isolation: '+header);
}
if(!apiSource.includes("'cache-control':'private, no-store'"))throw Error('Private voice audio must not be cached');
const voiceHeaders=apiSource.split("return new Response(audio,{headers:")[1]?.split("});")[0] || '';
if(!voiceHeaders.includes("'cross-origin-resource-policy':'same-origin'"))throw Error('Voice response missing same-origin policy');
const mediaHeaders=apiSource.split("return o ? new Response(o.body, { headers:")[1]?.split("}) : J(")[0] || '';
if(!mediaHeaders.includes("'cross-origin-resource-policy': 'same-origin'"))throw Error('Private media response missing same-origin policy');
if(!voiceHeaders.includes("'cache-control':'private, no-store'"))throw Error('Voice response must disable shared caching');
if(!mediaHeaders.includes("'cache-control': 'private, no-store'"))throw Error('Media response must disable shared caching');
if(!mediaHeaders.includes("'content-security-policy': \"sandbox; default-src 'none'\""))throw Error('Private media response must enforce sandbox CSP');
if(!voiceHeaders.includes("'content-type':'audio/mpeg'"))throw Error('Voice response must use audio/mpeg');
if(!mediaHeaders.includes("'content-disposition'"))throw Error('Private media response must include content disposition');
for(const [name,headers] of [['voice',voiceHeaders],['media',mediaHeaders]]){
  for(const key of ['x-content-type-options','x-frame-options','referrer-policy']){
    if(!headers.includes(key))throw Error(name+' response missing '+key);
  }
}



if ((apiSource.match(/match\(\/\(\?:\^\|;\\s\*\)hk=/g)||[]).length!==2 || !apiSource.includes('(?=;|$)/)')) throw Error('Exact session cookie boundary enforcement missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'ai_gateway_attempt'") || !apiSource.includes("AND at>?) < 60") || !apiSource.includes("if (!reserved.meta.changes)")) throw Error('Atomic external AI gateway attempt quota safeguard missing');
for (const [name, limit] of [['ai_tools_attempt',30],['transcribe_attempt',120]]) {
  if (!apiSource.includes("'"+name+"'") || !apiSource.includes("at>?) < "+limit) || !apiSource.includes('meta.changes')) throw Error('Atomic AI resource quota missing: '+name);
}
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'register_ip_attempt'") || !apiSource.includes("AND at>?) < 10") || !apiSource.includes('if (!reservation.meta.changes)')) throw Error('Atomic signup attempt throttle missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'login_attempt_ip'") || !apiSource.includes("AND at>?) < 100") || !apiSource.includes('if (!loginSlot.meta.changes)')) throw Error('Atomic per-IP login rate protection missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'login_attempt_account'") || !apiSource.includes("AND at>?) < 40") || !apiSource.includes('if (!accountSlot.meta.changes)')) throw Error('Atomic per-account login throttling missing');
if (!apiSource.includes("DELETE FROM sessions WHERE user_id=? AND expires_at<=?") || !apiSource.includes('ORDER BY expires_at DESC, rowid DESC LIMIT 20')) throw Error('Expired session cleanup and active device cap missing');
const sessionIndex='CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id,expires_at)';
if (!readFileSync('schema.sql','utf8').includes(sessionIndex) || !readFileSync('migrations/0004_session_user_expiry_index.sql','utf8').includes(sessionIndex)) throw Error('Session index missing from schema or migration');
if (!apiSource.includes("if (a === 'logout-all' && m === 'POST')") || !apiSource.includes("await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id).run()") || !apiSource.includes("await log(env,u.id,'logout_all')")) throw Error('Account-wide session revocation safeguard missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'voice_synthesize_attempt'") || !apiSource.includes("AND at>?) < 10") || !apiSource.includes('if(!voiceSlot.meta.changes)')) throw Error('Atomic voice synthesis attempt quota missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'logout_all_attempt'") || !apiSource.includes('if (!reauthSlot.meta.changes)')) throw Error('Account session revocation attempt throttle missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'account_delete_attempt'") || !apiSource.includes('if (!deleteSlot.meta.changes)')) throw Error('Atomic account deletion reauthentication throttle missing');
if (!apiSource.includes("INSERT INTO audit(user_id,action,at) SELECT ?,'media_upload_attempt'") || !apiSource.includes("AND at>?) < 120") || !apiSource.includes('if(!uploadSlot.meta.changes)')) throw Error('Atomic media upload attempt limit missing');
const wrangler = readFileSync('wrangler.toml','utf8');
for (const x of ['pages_build_output_dir = "public"','binding = "DB"','binding = "MEDIA"','binding = "AI"']) if (!wrangler.includes(x)) throw Error(`Missing binding ${x}`);
for (const name of ['integrations.js','ai-tools.js','gateway-ui.js','voice-enhance.js','timeline.js','voice-studio.js']) {
  for (const file of [name,'public/'+name]) { if (!existsSync(file)) throw Error('Missing '+file); execFileSync(process.execPath,['--check',file],{stdio:'inherit'}); }
  if (readFileSync(name,'utf8') !== readFileSync('public/'+name,'utf8')) throw Error('Out-of-sync browser script: '+name);
}
const timeline=readFileSync('public/timeline.js','utf8');
if ((timeline.match(/Math\.min\(end,v\.duration\)<=start/g)||[]).length!==2 || !timeline.includes('c.start>=v.duration||c.end>v.duration+.02')) throw Error('Timeline clip boundary safeguards missing');
for (const speed of ['.25','.5','.75','1','1.25','1.5','2','3','4']) if (!timeline.includes('<option value="'+speed+'"')) throw Error('Timeline speed option missing: '+speed);
if (!timeline.includes('Estimated timeline:')) throw Error('Timeline duration display missing');
if (!timeline.includes("else{$('clipStart').value='0';$('clipEnd').value=ready()?String(Math.min(v.duration,86400)):'0';$('clipSpeed').value='1'}")) throw Error('Timeline cleared-input reset missing');
if ((timeline.match(/Enter both clip start and end times/g)||[]).length!==3) throw Error('Timeline empty timing validation missing');
if (!timeline.includes('let completedSeconds=0') || !timeline.includes("+'% complete.'")) throw Error('Timeline progress indicator missing');
if ((timeline.match(/c\.end<=86400/g)||[]).length<2) throw Error('Saved timeline and export timestamp safety limits missing');
if (!timeline.includes("$('clipEnd').value=validSourceRange()?v.duration.toFixed(2):'0'") || !timeline.includes('Video exceeds the 24-hour timeline limit or has invalid duration.')) throw Error('Invalid source metadata display safeguard missing');
if (!timeline.includes('const validSourceRange=()=>ready()&&v.duration<=86400') || (timeline.match(/validSourceRange\(\)/g)||[]).length<4) throw Error('Timeline source duration limit missing');
if (!timeline.includes('id="clipInsert"') || !timeline.includes("$('clipInsert').onclick=()=>") || !timeline.includes('clips.splice(i+1,0,{start,end:Math.min(end,v.duration),speed})')) throw Error('Validated insert-after-selected command missing');
if (!timeline.includes('id="clipDuplicate"') || !timeline.includes("$('clipDuplicate').onclick=")) throw Error('Timeline clip duplication control missing');
for (const id of ['clipAddFull','clipClear','clipFirst','clipLast','clipReverse','clipSort','clipCopy','clipPaste']) if (!timeline.includes('id="'+id+'"') || !timeline.includes("$('"+id+"').onclick=")) throw Error('Timeline editing command missing: '+id);
if (!timeline.includes('copiedClip=null;undo=[];redo=[];paint()') || !timeline.includes('copiedClip=null;pendingProjectMedia=true') || !timeline.includes("$('clipPaste').onclick=()=>")) throw Error('Source-safe clip clipboard missing');
if (!timeline.includes("$('clipSort').onclick=()=>") || !timeline.includes('selectedClip?clips.indexOf(selectedClip):0') || !timeline.includes('a.index-b.index')) throw Error('Stable clip sorting, selection and undo protection missing');
if (!timeline.includes('JSON.stringify({clips,selected:chosen()})') || !timeline.includes('paint(previous.selected)') || !timeline.includes('paint(next.selected)')) throw Error('Timeline undo/redo selection persistence missing');
for (const control of ['clipTrimIn','clipTrimOut']) if (!timeline.includes('id="'+control+'"') || !timeline.includes("$('"+control+"').onclick=")) throw Error('Timeline playhead trim control missing: '+control);
if (!timeline.includes("['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm") || !timeline.includes('const outputMime=rec.mimeType||mime') || !timeline.includes("(outputMime.toLowerCase().startsWith('video/mp4')?'mp4':'webm')")) throw Error('Compatible MP4 preference and recorder MIME export validation missing');
if (!timeline.includes('for(const candidate of supportedMimes)') || !timeline.includes('mime=candidate;break') || !timeline.includes('Browser could not initialize any supported video encoder.')) throw Error('MediaRecorder constructor codec fallback safeguard missing');
if (!timeline.includes('recordedBytes>256*1024*1024')) throw Error('Timeline export size safeguard missing');
if (!timeline.includes('state.abortPlayback?.();state.abortStart?.();return') || !timeline.includes('if(encoderError)throw encoderError;')) throw Error('Oversized encoder stream early-abort safeguard missing');
if (!timeline.includes('rec.ondataavailable=e=>{if(state.cancelled||encoderError||!e.data?.size)return;')) throw Error('Late encoder data discard missing');
if (!timeline.includes("rec.onerror=e=>{encoderError=e.error||Error('Encoder failed');state.abortSeek?.();state.abortStart?.();state.abortPlayback?.();resolve()}")) throw Error('Recorder error immediate abort missing');
if (!timeline.includes('canvas.width>4096||canvas.height>4096') || !timeline.includes('canvas.width*canvas.height>8847360') || !timeline.includes('Invalid export canvas size.')) throw Error('Canvas export dimension safeguard missing');
if (!timeline.includes('if(record)invalidateExport();')) throw Error('Stale timeline download invalidation missing');
if (!timeline.includes("window.addEventListener?.('pagehide',()=>{invalidateExport();if(session){session.cancelled=true") || !timeline.includes("session.abortEncoder?.();v.pause()}});")) throw Error('Active timeline session pagehide cleanup missing');
if (!timeline.includes('session.abortSeek?.()') || !timeline.includes('await seek(c.start,state)')) throw Error('Timeline seek cancellation safeguard missing');
if (!timeline.includes('if(!v.seeking&&Math.abs(v.currentTime-t)<.02)')) throw Error('Pending video seek guard missing');
if (!timeline.includes("v.addEventListener('loadedmetadata',()=>{if(session){session.sourceChanged=true;session.cancelled=true") || !timeline.includes('if(!state.sourceChanged){try{v.pause()}catch{}try{v.playbackRate=rate}catch{}')) throw Error('Timeline source switch isolation safeguard missing');
if (!timeline.includes('for(const mediaStream of [stream,sourceStream])') || !timeline.includes('try{track.stop()}catch{}') || !timeline.includes('session=null;setBusy(false)')) throw Error('Timeline cleanup must unlock editor after track-stop failure');
if (!timeline.includes('if(!state.sourceChanged)v.pause();')) throw Error('Old clip loop may pause replacement video');
if (!timeline.includes('if(!state.sourceChanged)info(state.cancelled?')) throw Error('Stale export status isolation missing');
if (!timeline.includes('session.abortPlayback?.()') || !timeline.includes('state.abortPlayback=()=>finish()')) throw Error('Timeline playback cancellation safeguard missing');
if (!timeline.includes('Source video ended before the clip finished.') || !timeline.includes('if(v.ended)return finish(Error(')) throw Error('Premature source-end validation missing');
if (!timeline.includes('session.abortStart?.()') || !timeline.includes('Video playback did not start within 15 seconds.')) throw Error('Timeline playback startup cancellation safeguard missing');
if (!timeline.includes('session.abortEncoder?.()') || !timeline.includes('state.abortEncoder=abort')) throw Error('Timeline encoder cancellation safeguard missing');
if (!timeline.includes('if(finished&&session===state&&!state.sourceChanged)v.pause()')) throw Error('Timeline session isolation safeguard missing');
if (!timeline.includes('Load the matching video to seek.') || !timeline.includes('try{v.currentTime=c.start}catch')) throw Error('Safe restored clip selection missing');
if (!timeline.includes("$('clipList').onkeydown=") || !timeline.includes("key==='delete'") || !timeline.includes("key==='z'") || !timeline.includes("key==='c'") || !timeline.includes("key==='v'") || !timeline.includes("key==='y'")) throw Error('Timeline keyboard shortcuts missing');
const html=readFileSync('public/index.html','utf8');
for (const name of ['integrations.js','ai-tools.js','gateway-ui.js','voice-enhance.js','timeline.js','voice-studio.js']) if (!html.includes('src="/'+name+'"')) throw Error('Script not loaded: '+name);
if (html !== readFileSync('index.html','utf8')) throw Error('Public page not synchronized with editor source');
if (!html.includes('id="deleteAccount"') || !html.includes("api('account','DELETE',{password})") || !html.includes('window.confirm(')) throw Error('Password-confirmed irreversible account deletion UI missing');
if (!html.includes('id="logoutAll"') || !html.includes("api('logout-all','POST',{password})")) throw Error('All-device sign-out control missing from editor');
for (const asset of ['logo-256.png','logo-512.png','favicon.png']) if (!existsSync('public/assets/'+asset)) throw Error('Public asset missing: '+asset);
for (const x of ['id="vexp"','id="vdl"','id="autocap"']) if (!html.includes(x)) throw Error(`Missing client control ${x}`);
const api=readFileSync('functions/api/[[path]].js','utf8');
if (!api.includes(".trim().toLowerCase() !== 'application/json'")) throw Error('API JSON content type safeguard missing');
if (!api.includes('Number(declared) !== payload.byteLength')) throw Error('JSON Content-Length mismatch safeguard missing');
if (!api.includes('gifDimensionsOk') || !api.includes("type==='image/gif' ? size>=13")) throw Error('GIF image dimension safeguards missing');
if (!api.includes('const jpegDimensionsOk =') || !api.includes("type==='image/jpeg' ? jpegDimensionsOk")) throw Error('JPEG frame-dimension validation missing');
if (!api.includes('return frameOk&&segmentLength>=6') || !api.includes('data[data.length-1]===217')) throw Error('JPEG scan and end-marker validation missing');
if (!api.includes('webpLength===size-8') || !api.includes("type==='image/webp' ? webpValid")) throw Error('WebP RIFF container safeguard missing');
for (const guard of ['webpChunkFits','webpDimensionsOk','webpLossless','webpLossy','webpExtended']) if (!api.includes(guard)) throw Error('WebP chunk and dimension validation missing: '+guard);
if (!api.includes("Voice provider returned invalid MP3 audio.") || !api.includes('const mp3=frame.length>=4')) throw Error('Synthesized MP3 signature validation missing');
if (!api.includes('readBoundedMedia(response, 1024*1024)')) throw Error('AI provider response-size limit missing');
if (!api.includes("providerType!=='application/json'")) throw Error('AI provider response content type safeguard missing');
for (const x of ['const ROLES','content-security-policy','await env.MEDIA.delete(key)']) if (!api.includes(x)) throw Error(`Missing server safeguard ${x}`);
if (!api.includes("String(r?.text || '').slice(0,12000)") || !api.includes('.slice(0,2000).filter(w=>') || !api.includes("String(w.word || '').slice(0,160)")) throw Error('Whisper result size and timestamp validation missing');
for (const guard of ['const validWav = wavHeader','wavHeader.getUint32(4,true) === wave.length - 8','wavHeader.getUint32(40,true) === wave.length - 44']) if (!api.includes(guard)) throw Error('PCM WAV validation safeguard missing: '+guard);
console.log('Account 9 preflight: source, route, editor controls and Cloudflare bindings present.');
