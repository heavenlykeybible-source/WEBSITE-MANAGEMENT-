import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext,Script} from 'node:vm';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(resolve(root,'src/radio-player.ts'),'utf8');
const index=readFileSync(resolve(root,'src/index.ts'),'utf8');
const compiled=ts.transpileModule(source.replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const html=await runInNewContext(compiled+';radioPlayerHtml()',{Response}).text();
assert.match(html,/<audio id="audio" preload="none"/);
assert.match(html,/Bluetooth \/ audio output/);
assert.match(html,/selectAudioOutput/);
assert.match(html,/setSinkId/);
assert.match(html,/mediaSession/);
assert.match(html,/\.addEventListener\('ended'/);
assert.match(html,/\.addEventListener\('click'/);
assert.match(html,/audio\.pause\(\)/);
assert.match(html,/media-engine-public-v1/);
assert.match(html,/channel=radio/);
assert.match(html,/Content-Security-Policy|Content-Security/i);
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Radio player script must be present');
new Script(script,{filename:'radio-player.js'}); // Validate emitted browser JavaScript, not the TS template.
const match=script.match(/const validItem=item=>([^;]+);/);
assert.ok(match,'Track allowlist must be present');
const validItem=runInNewContext('(item)=>'+match[1],{});
assert.equal(Boolean(validItem({type:'audio',url:'/api/broadcast/media/42/object'})),true,'Allowed radio audio source');
for(const url of ['https://evil.example/audio.mp3','//evil.example/audio.mp3','/api/broadcast/media/1/object?redirect=1','/api/broadcast/media/1/object#fragment','/api/broadcast/media/x/object']){
 assert.equal(Boolean(validItem({type:'audio',url})),false,'Reject untrusted playlist source '+url);
}
assert.equal(Boolean(validItem({type:'video',url:'/api/broadcast/media/42/object'})),false,'Video playback stays locked');
assert.ok(index.includes("url.pathname==='/radio/player'"),'Player must have an Account 2 Worker route');
console.log('Account 2 radio player Bluetooth support, JS syntax, audio allowlist and on-demand checks passed');
