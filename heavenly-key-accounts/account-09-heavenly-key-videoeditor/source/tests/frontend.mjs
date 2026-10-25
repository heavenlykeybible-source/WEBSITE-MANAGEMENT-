import assert from 'node:assert/strict';
import { Script, runInNewContext } from 'node:vm';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const html=readFileSync('public/index.html','utf8');
const module=readFileSync('public/integrations.js','utf8');
assert.ok(html.includes('function invalidateVideoDownload()')&&html.includes("$('ve').addEventListener('input',invalidateVideoDownload)"),'Video changes must invalidate stale downloads');
assert.ok(html.includes('if(f.size>2*1024*1024)')&&html.includes('start<0||end<=start||layers.length>=500'),'Caption import and manual entry must reject oversized or invalid input');
const srtParser=html.match(/function parseTime\(s\)\{[^\n]+\}/)?.[0];
assert.ok(srtParser,'Missing SRT time parser');
const toSeconds=runInNewContext(srtParser+'; parseTime');
assert.equal(toSeconds('00:00:01,5'),1.5,'Single-digit millisecond groups must represent tenths');
assert.equal(toSeconds('01:02:03,045'),3723.045,'Three-digit millisecond groups must retain precision');
assert.ok(Number.isNaN(toSeconds('00:61:00,000')),'Invalid SRT minutes must be rejected');

const headers=readFileSync('public/_headers','utf8');
const original=readFileSync('index.html','utf8');
const inlineScripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(Boolean);
assert.ok(inlineScripts.length>0,'Editor inline application script is missing');
for(const code of inlineScripts) new Script(code,{filename:'account9-inline-editor.js'});
assert.equal(html,original,'Source and public HTML must match');
assert.ok(html.includes('const revision=++audioLoadRevision')&&html.includes('if(revision!==audioLoadRevision)return;'),'Old audio decoding must not replace a more recent file');
assert.ok(html.includes('href="#studio-main" class="skip-link"')&&html.includes('<main id="studio-main" tabindex="-1">'),'Keyboard skip link must target primary editor content');
for(const check of ["Number(m[4].padEnd(3,'0'))/1000",'if(!caption||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||layers.length>=500)']) assert.ok(html.includes(check),'Safe SRT parser must reject invalid timing and cap subtitles: '+check);
assert.ok(html.includes('aria-label="Studio sections"')&&html.includes("setAttribute('aria-pressed'"),'Navigation must expose active section to assistive technology');
assert.ok(html.includes('button:focus-visible')&&html.includes('<label for="af">Choose audio</label>'),'Keyboard focus and audio upload label required');
assert.ok(html.includes("if(exportURL){URL.revokeObjectURL(exportURL);exportURL=''}"),'Selecting a new video must invalidate the prior export');
assert.ok(html.includes('audioBuffer=null;')&&html.includes("$('aexp').disabled=true"),'Loading an audio file must clear previously decoded audio');
assert.ok(html.includes('v.onerror=()'),'Unsupported video codecs must show a helpful error');
assert.equal(module,readFileSync('integrations.js','utf8'),'Integration modules must match');
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
const voice=readFileSync('voice-studio.js','utf8');
assert.ok(voice.includes('/api/voice-synthesize'),'Voice synthesis API not connected');
const enhancement=readFileSync('voice-enhance.js','utf8');
assert.ok(enhancement.includes('enhanceDownload'),'Enhanced audio download control missing');
assert.ok(headers.includes('Content-Security-Policy'),'Missing CSP');
execFileSync(process.execPath,['--check','public/integrations.js'],{stdio:'inherit'});
execFileSync(process.execPath,['--check','integrations.js'],{stdio:'inherit'});
const timelineScript=readFileSync('timeline.js','utf8');
assert.ok(timelineScript.includes('window.hkTimeline='),'Timeline state bridge must exist');
assert.ok(html.includes('timeline:window.hkTimeline?.getClips()'),'Project snapshots must contain timeline');
assert.ok(html.includes('restoreClips(d.timeline||[])'),'Local projects must restore timeline');
assert.ok(module.includes('restoreClips(state.timeline||[])'),'Cloud projects must restore timeline');
assert.ok(module.includes("const originalLogout=$('logout').onclick")&&module.includes('selected=null;list.replaceChildren();ml.replaceChildren()'),'Sign out must clear private cloud library data');
assert.ok(module.includes("try{await json('me');await Promise.allSettled"),'Cloud libraries must only load after verified login');
for (const wiring of ['new DataTransfer()', "input.dispatchEvent(new Event('change'", "fetch('/api/media/'+encodeURIComponent(f.id)", "f.type.startsWith('video/')||f.type.startsWith('audio/')"]) assert.ok(module.includes(wiring),'Cloud media editor import missing: '+wiring);
assert.ok(module.includes('Math.min(end,Math.max(start'),'Caption word timings must remain within each processed chunk');
assert.ok(timelineScript.includes('rec.pause()') && timelineScript.includes('rec.resume()'),'Export recorder must skip clip seeking');
for (const safeguard of ["invalidateExport();undo.push", "invalidateExport();clips=data.map", "if(session)return info('Stop preview or export", "if(clips.length>=200)", "'clipRemove','clipUp','clipDown','clipUndo','clipRedo'"]) {
  assert.ok(timelineScript.includes(safeguard),'Missing timeline regression safeguard: '+safeguard);
}
assert.ok(timelineScript.includes("else list.value=''") ,'Empty timeline must clear selected clip');
console.log('PASS frontend integration wiring, duplicate source and security headers');
