import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const html=readFileSync('public/index.html','utf8');
const module=readFileSync('public/integrations.js','utf8');
const headers=readFileSync('public/_headers','utf8');
const original=readFileSync('index.html','utf8');
assert.equal(html,original,'Source and public HTML must match');
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
assert.ok(timelineScript.includes('rec.pause()') && timelineScript.includes('rec.resume()'),'Export recorder must skip clip seeking');
for (const safeguard of ["invalidateExport();undo.push", "invalidateExport();clips=data.map", "if(session)return info('Stop preview or export", "if(clips.length>=200)", "'clipRemove','clipUp','clipDown','clipUndo','clipRedo'"]) {
  assert.ok(timelineScript.includes(safeguard),'Missing timeline regression safeguard: '+safeguard);
}
assert.ok(timelineScript.includes("else list.value=''") ,'Empty timeline must clear selected clip');
console.log('PASS frontend integration wiring, duplicate source and security headers');
