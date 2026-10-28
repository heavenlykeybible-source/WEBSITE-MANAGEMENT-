import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../site/join.html', import.meta.url), 'utf8');

test('guest entry requires a name and explicit consent before connecting', () => {
  assert.match(html, /if\(!\$\('nm'\)\.value\.trim\(\)\)/);
  assert.match(html, /if\(!\$\('ok'\)\.checked\)/);
  assert.match(html, /id="ok"/);
  assert.match(html, /href="\/privacy\.html"/);
});

test('audience can join without granting camera or microphone access', () => {
  assert.match(html, /if\(!AUD\)\{\$\('pm'\)/);
  assert.match(html, /if\(AUD\)\{/);
  assert.match(html, /id="hand"/);
  assert.match(html, /id="leave"/);
});

test('mobile guest controls remain accessible and consent is not hidden', () => {
  assert.match(html, /@media \(max-width: 600px\)/);
  assert.match(html, /#live button\{min-height:44px/);
  assert.doesNotMatch(html, /#oklab\s*\{[^}]*display\s*:\s*none/);
  assert.match(html, /id="inv"/);
});

test('guest connection has bounded admission and websocket timeouts', () => {
  assert.match(html, /openTimer=setTimeout\(/);
  assert.match(html, /joinAckTimer=setTimeout\(/);
  assert.match(html, /if\(\+\+tries<=4\)/);
  assert.match(html, /clearTimeout\(joinAckTimer\)/);
});

test('guest meeting lifecycle closes media and signaling on departure', () => {
  assert.match(html, /function end\(msg\)/);
  assert.match(html, /ws&&ws\.close\(\)/);
  assert.match(html, /pc&&pc\.close\(\)/);
  assert.match(html, /function stopLocal\(\)/);
  assert.match(html, /rawMedia\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
});


test('broadcast links require HTTPS and trusted YouTube hostnames', () => {
  assert.match(html, /parsed\.protocol!=='https:'/);
  assert.match(html, /parsed\.username\|\|parsed\.password/);
  assert.match(html, /parsed\.hostname==='youtube\.com'/);
  assert.match(html, /parsed\.hostname==='youtu\.be'/);
  assert.match(html, /youtube-nocookie\.com\/embed/);
});

test('expired stage invitations invalidate pending camera access', () => {
  assert.match(html, /case 'invitation-expired':invitationEpoch\+\+/);
  assert.match(html, /case 'demoted':invitationEpoch\+\+/);
  assert.match(html, /epoch!==invitationEpoch/);
});

test('meeting invites use exact same-origin secure WebSocket URLs', () => {
  assert.match(html, /url\.protocol==='wss:'/);
  assert.match(html, /url\.host===location\.host/);
  assert.match(html, /url\.pathname==='\/meeting\/'\+room/);
  assert.match(html, /!url\.search&&!url\.hash/);
});

test('stage media is cancelled when an invitation expires or the guest disconnects', () => {
  assert.match(html, /getMedia\(false,epoch\)/);
  assert.match(html, /epoch!==invitationEpoch\|\|!joined/);
  assert.match(html, /if\(AUD\)\{stopLocal\(\);onStage=false;mode\(false\)\}/);
});

test('embedded YouTube broadcasts require a valid eleven-character ID', () => {
  assert.match(html, /parsed\.searchParams\.get\('v'\)/);
  assert.match(html, /\^\[\\w-\]\{11\}\$/);
  assert.match(html, /!parsed\.hash/);
});
