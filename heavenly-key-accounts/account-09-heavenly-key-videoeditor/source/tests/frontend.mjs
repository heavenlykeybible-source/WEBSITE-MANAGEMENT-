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
console.log('PASS frontend integration wiring, duplicate source and security headers');
