import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const html=readFileSync('public/index.html','utf8');
const module=readFileSync('public/integrations.js','utf8');
assert.ok(html.includes("$('vf').disabled=true")&&html.includes("exportStream.getTracks().forEach(t=>t.stop())")&&html.includes("exportRecorder.state!=='inactive'"),'Video exports must block source switching and clean up media tracks');
assert.ok(html.includes("limit>600")&&html.includes("Browser export is limited to ten minutes"),'Single video export must respect browser resource limits');
assert.ok(html.includes("'video/mp4'")&&html.includes("type.startsWith('video/mp4')?'mp4':'webm'"),'Single-video export must select a native MP4 or WebM extension matching its encoder');
assert.ok(html.includes('function invalidateVideoDownload()')&&html.includes("$('ve').addEventListener('input',invalidateVideoDownload)"),'Video changes must invalidate stale downloads');
assert.ok(html.includes('if(f.size>2*1024*1024)')&&html.includes('start<0||end<=start||layers.length>=500'),'Caption import and manual entry must reject oversized or invalid input');
const srtParser=html.match(/function parseTime\(s\)\{[^\n]+\}/)?.[0];
assert.ok(srtParser,'Missing SRT time parser');
const toSeconds=runInNewContext(srtParser+'; parseTime');
assert.equal(toSeconds('00:00:01,5'),1.5,'Single-digit millisecond groups must represent tenths');
assert.equal(toSeconds('01:02:03,045'),3723.045,'Three-digit millisecond groups must retain precision');
assert.ok(Number.isNaN(toSeconds('00:61:00,000')),'Invalid SRT minutes must be rejected');

assert.ok(html.includes('Video export timed out')&&html.includes('Video decoding failed during export'),'Single-video export must fail instead of stalling');
assert.ok(html.includes('id="register" disabled'),'Public registration must display closed state');
const headers=readFileSync('public/_headers','utf8');
const original=readFileSync('index.html','utf8');
const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(Boolean);
assert.ok(inlineScripts.length>0,'Editor inline application script is missing');
const layerValidator=html.match(/function validProjectLayers\(items\)\{[^\n]+\}/)?.[0];
assert.ok(layerValidator,'Saved projects must validate caption data before opening');
const validLayers=runInNewContext(layerValidator+'; validProjectLayers');
assert.equal(validLayers([{text:'Hello',start:0,end:2}]),true,'Valid project captions accepted');
assert.equal(validLayers([{text:'Broken',start:3,end:1}]),false,'Reversed timestamps rejected');
assert.equal(validLayers({layers:[]}),false,'Non-array captions rejected');
assert.ok(module.includes('validProjectLayers(state.layers||[])'),'Cloud project loading must validate caption layers');
assert.ok(html.includes('e.detail?.file'),'Video and audio inputs must support a cloud-loaded File');
for(const code of inlineScripts) new Script(code,{filename:'account9-inline-editor.js'});
assert.equal(html,original,'Source and public HTML must match');
assert.ok(html.includes('const revision=++audioLoadRevision')&&html.includes('if(revision!==audioLoadRevision)return;'),'Old audio decoding must not replace a more recent file');
assert.ok(html.includes('href="#studio-main" class="skip-link"')&&html.includes('<main id="studio-main" tabindex="-1">'),'Keyboard skip link must target primary editor content');
for(const check of ["Number(m[4].padEnd(3,'0'))/1000",'if(!caption||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||layers.length>=500)']) assert.ok(html.includes(check),'Safe SRT parser must reject invalid timing and cap subtitles: '+check);
assert.ok(html.includes('aria-label="Studio sections"')&&html.includes("setAttribute('aria-pressed'"),'Navigation must expose active section to assistive technology');
assert.ok(html.includes('button:focus-visible')&&html.includes('<label for="af">Choose audio</label>'),'Keyboard focus and audio upload label required');
assert.ok(html.includes('invalidateVideoDownload();if(sourceURL)'),'Selecting a new video must invalidate the prior export');
assert.ok(html.includes('audioBuffer=null;')&&html.includes("$('aexp').disabled=true"),'Loading an audio file must clear previously decoded audio');
assert.ok(html.includes('v.onerror=()'),'Unsupported video codecs must show a helpful error');
assert.equal(module,readFileSync('integrations.js','utf8'),'Integration modules must match');
assert.ok(module.includes("if(generation!==libraryGeneration)return;selected=d.id")&&module.includes('const blob=await res.blob();if(generation!==libraryGeneration)return'),'Delayed private project or media fetch must not import after logout');
assert.ok(module.includes('const generation=libraryGeneration')&&module.includes('if(generation!==libraryGeneration)return')&&module.includes('libraryGeneration++;selected=null;list.replaceChildren();ml.replaceChildren()'),'Cloud library responses must not display after logout');
for(const id of ['vf','vexp','vdl','af','aexp','autocap','login','register','logout','pcloud','psave','pload','srtf','srtx','projects','account','video','audio']){
  assert.ok(html.includes('id="'+id+'"'),'Missing frontend element: '+id);
}
for(const route of ["json('projects')","json('media')","'/api/transcribe'","'/api/media?name='","json('me')"]){
  assert.ok(module.includes(route),'Missing frontend API integration: '+route);
}
for(const name of ['integrations.js','ai-tools.js','gateway-ui.js','voice-enhance.js','timeline.js','voice-studio.js']){
  const src=readFileSync(name,'utf8'),pub=readFileSync('public/'+name,'utf8');
  assert.equal(src,pub,'Module synchronization failed: '+name);
  assert.ok(html.includes('src="/'+name+'"'),'Missing script tag: '+name);
  execFileSync(process.execPath,['--check',name],{stdio:'inherit'});
}
const timeline=readFileSync('timeline.js','utf8');
for(const feature of ['clipAdd','clipSplit','clipUndo','clipRedo','clipExport','clipDownload'])
  assert.ok(timeline.includes(feature),'Timeline missing '+feature);
assert.ok(timeline.includes('clipDuplicate')&&timeline.includes("clips.splice(i+1,0,{...clips[i]})"),'Duplicate clip must preserve clip trim/speed and insert after selection');
assert.ok(timeline.includes("event.key.toLowerCase()")&&timeline.includes("event.preventDefault();$(action).click()")&&timeline.includes("['INPUT','TEXTAREA','SELECT']"),'Timeline hotkeys must not interfere with form editing');
const voice=readFileSync('voice-studio.js','utf8');
assert.ok(voice.includes('/api/voice-synthesize'),'Voice synthesis API not connected');
const enhancement=readFileSync('voice-enhance.js','utf8');
assert.ok(enhancement.includes('enhanceDownload'),'Enhanced audio download control missing');
assert.ok(headers.includes('Content-Security-Policy'),'Missing CSP');
execFileSync(process.execPath,['--check','public/integrations.js'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','integrations.js'],{stdio:'inherit'});
assert.ok(html.includes('id="fitmode"')&&html.includes("state.fit==='cover'")===false,'Framing selector stays in editor with cloud handling in module');
assert.ok(module.includes("state.fit==='cover'")&&html.includes("d.fit==='cover'"),'Local/cloud project framing must restore');
const timelineScript=readFileSync('timeline.js','utf8');
assert.ok(timeline.includes('clipFade')&&timeline.includes('fadeOpacity:')&&html.includes('window.hkTimeline?.fadeOpacity?.()'),'Clip edge fade must reach canvas export and preview renderer');
assert.ok(timelineScript.includes("'video/mp4'")&&timelineScript.includes("mime.startsWith('video/mp4')?'mp4':'webm'"),'Timeline export must select correct browser-supported format and extension');
assert.ok(timelineScript.includes('window.hkTimeline='),'Timeline state bridge must exist');
assert.ok(timelineScript.includes("['vf','vexp','clipExport'")&&timelineScript.includes("if($('vexp').disabled)return info"),'Timeline must lock source changes and prevent concurrent exports');
assert.ok(timelineScript.includes('id="clipUpdate"')&&timelineScript.includes("$('clipUpdate').onclick=()=>")&&timelineScript.includes('clips[i]={start,end:Math.min(end,v.duration),speed,fade}'),'Timeline selected clip edits must update trim and speed');
assert.ok(timelineScript.includes("'clipSplit','clipUpdate','clipDuplicate','clipRemove'"),'Editing clips must lock during timeline export');
assert.ok(html.includes('timeline:window.hkTimeline?.getClips()'),'Project snapshots must contain timeline');
assert.ok(html.includes('restoreClips(d.timeline||[])'),'Local projects must restore timeline');
assert.ok(module.includes('restoreClips(state.timeline||[])'),'Cloud projects must restore timeline');
assert.ok(module.includes("const originalLogout=$('logout').onclick")&&module.includes('selected=null;list.replaceChildren();ml.replaceChildren()'),'Sign out must clear private cloud library data');
assert.ok(module.includes("try{await json('me');await Promise.allSettled"),'Cloud libraries must only load after verified login');
for (const wiring of ["input.dispatchEvent(new CustomEvent('change'", "fetch('/api/media/'+encodeURIComponent(f.id)", "f.type.startsWith('video/')||f.type.startsWith('audio/')"]) assert.ok(module.includes(wiring),'Cloud media editor import missing: '+wiring);
assert.ok(module.includes('Math.min(end,Math.max(start'),'Caption word timings must remain within each processed chunk');
assert.ok(module.includes('const selectedAudio=audioBuffer,selectedRevision=audioLoadRevision')&&module.includes('if(audioLoadRevision!==selectedRevision)'),'Audio transcription must reject stale selected files');
assert.ok(module.includes('Math.max(0,500-layers.length)')&&module.includes('generated.filter(l=>l.text&&l.end>l.start).slice(0,remaining)')&&module.includes('invalidateVideoDownload();layers.push(...accepted)'), 'AI caption generation must respect 500-caption limit and invalidate exports');
assert.ok(timelineScript.includes('rec.pause()') && timelineScript.includes('rec.resume()'),'Export recorder must skip clip seeking');
for (const safeguard of ["invalidateExport();undo.push", "invalidateExport();clips=data.map", "if(session)return info('Stop preview or export", "if(clips.length>=200)", "'clipRemove','clipUp','clipDown','clipUndo','clipRedo'"]) {
  assert.ok(timelineScript.includes(safeguard),'Missing timeline regression safeguard: '+safeguard);
}
assert.ok(timelineScript.includes("else list.value=''") ,'Empty timeline must clear selected clip');
const manifest=JSON.parse(readFileSync('public/manifest.json','utf8'));
assert.equal(manifest.start_url,'/','Offline application must launch at the editor root');
assert.equal(manifest.display,'standalone','Offline app must be installable');
assert.ok(manifest.icons.length>=2,'Installable app must include icons');
assert.ok(html.includes('rel="manifest" href="/manifest.json"')&&html.includes("navigator.serviceWorker.register('/sw.js')"),'Editor must register the offline app');
const offline=readFileSync('public/offline-status.js','utf8');
new Script(offline,{filename:'account9-offline-status.js'});
assert.ok(html.includes('src="/offline-status.js"')&&offline.includes("window.addEventListener('offline'"),'Offline status must report local editor availability');
const sw=readFileSync('public/sw.js','utf8');
new Script(sw,{filename:'account9-service-worker.js'});
assert.ok(sw.includes("url.pathname.startsWith('/api/')")&&sw.includes("request.method!=='GET'"),'Service worker must bypass authenticated APIs and writes');
assert.ok(sw.includes("request.mode==='navigate'")&&sw.includes("cache.match('/index.html')"),'Offline navigation must fall back to cached editor');
assert.ok(sw.includes("cache.put('/index.html',copy)")&&sw.includes('event.waitUntil(fresh)'),'Online launches must refresh offline page and static assets');
console.log('PASS frontend integration wiring, duplicate source and security headers');
