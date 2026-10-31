import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext,Script} from 'node:vm';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(resolve(root,'src/radio-player.ts'),'utf8');
const index=readFileSync(resolve(root,'src/index.ts'),'utf8');
const compiled=ts.transpileModule(source.replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const response=runInNewContext(compiled+';radioPlayerHtml()',{Response,crypto:webcrypto});
assert.match(response.headers.get('Content-Security-Policy')||'',/media-src 'self'/);
assert.doesNotMatch(response.headers.get('Content-Security-Policy')||'',/unsafe-inline/);
const nonce=(response.headers.get('Content-Security-Policy')||'').match(/script-src 'nonce-([a-f0-9]{32})'/)?.[1];
assert.ok(nonce,'CSP must have cryptographically generated script nonce');
const html=await response.text();
assert.match(html,/<audio id="audio" preload="none"/);
assert.ok(html.includes('<script nonce="'+nonce+'">'));
assert.ok(html.includes('<style nonce="'+nonce+'">'));
assert.match(html,/Bluetooth \/ audio output/);
assert.match(html,/selectAudioOutput/);
assert.match(html,/setSinkId/);
assert.match(html,/mediaSession/);
assert.match(html,/\.addEventListener\('ended'/);
assert.match(html,/\.addEventListener\('click'/);
assert.match(html,/audio\.pause\(\)/);
assert.match(html,/media-engine-public-v1/);
assert.match(html,/channel=radio/);
assert.match(html,/channel=radio&delivery=on-demand/,'Standalone player requests listener-activated playlist');
assert.match(html,/window\.addEventListener\('pagehide'/,'Playback must stop when the radio page closes');
assert.match(html,/playGeneration/,'Async playback generation must avoid stale state');
assert.match(html,/audio\.getAttribute\('src'\)/,'Missing player source must be detected reliably');
assert.match(html,/audio\.addEventListener\('error'/,'Audio errors must be handled');
assert.match(html,/window\.addEventListener\('offline'/,'Offline status must be visible');
assert.match(html,/window\.addEventListener\('online'/,'Reconnect guidance must be visible');
assert.match(html,/audio\.addEventListener\('waiting'/,'Buffering status must be announced');
assert.match(html,/if\(generation===playGeneration\)setPaused/,'Old async playback failures cannot alter current controls');
assert.match(html,/setAttribute\('aria-label','Pause radio'\)/,'Accessible pause state must be announced');

const script=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1];
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
