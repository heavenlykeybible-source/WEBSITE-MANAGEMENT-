import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match => match[1]).filter(Boolean);

test('inline dashboard JavaScript parses successfully', () => {
  assert.ok(scripts.length > 0, 'expected inline dashboard JavaScript');
  for (const source of scripts) assert.doesNotThrow(() => new Script(source));
});
test('dashboard exposes the authenticated media upload interface', () => {
  assert.match(html, /function addMediaLibrary\(\)/);
  assert.match(html, /api\('\/api\/media'/);
  assert.match(html, /image\/png,image\/jpeg,image\/webp/);
  assert.match(html, /chosen\.size>750000/);
});
test('dashboard retains its post draft editor', () => {
  assert.match(html, /socialplus-post-editor-ready/);
  assert.match(html, /\/api\/posts/);
});

test('scheduled draft queue supports reviewing, rescheduling and unscheduling', () => {
  assert.match(html, /function addScheduledQueue\(\)/);
  assert.match(html, /api\('\/api\/posts\/queue'/);
  assert.match(html, /method:'PUT'/);
  assert.match(html, /method:'PATCH'/);
  assert.match(html, /date\.toISOString\(\)/);
  assert.match(html, /Remove schedule/);
  assert.match(html, /Reschedule/);
});

test('private media library has paginated listing controls', () => {
  assert.match(html, /api\('\/api\/media\/list'/);
  assert.match(html, /function addMediaLibrary\(\)/);
  assert.match(html, /Refresh image library/);
  assert.match(html, /Load more/);
  assert.match(html, /Copy ID/);
});

test('saved drafts can be edited without publishing', () => {
  assert.match(html, /function addDraftEditor\(\)/);
  assert.match(html, /Edit saved post drafts/);
  assert.match(html, /method:'PATCH'/);
  assert.match(html, /Save draft edits/);
  assert.match(html, /Draft edited and saved internally/);
});

test('draft manager offers manual copying and safe deletion', () => {
  assert.match(html, /Copy post text/);
  assert.match(html, /manual publishing/);
  assert.match(html, /Delete draft/);
  assert.match(html, /method:'DELETE'/);
});

test('post draft editor supports private image attachments', () => {
  assert.match(html, /Private image ID for post draft/);
  assert.match(html, /Attached image ID/);
  assert.match(html, /mediaId:media\.value\.trim\(\)\|\|null/);
  assert.match(html, /mediaId:mediaId\.value\.trim\(\)/);
});

test('rapid conversation switching cannot display stale Gemini suggestions or history', () => {
  assert.match(html, /const targetConversation=selected;const message=prompt/);
  assert.match(html, /conversationId:targetConversation,message:message\.trim\(\)/);
  assert.match(html, /if\(selected!==targetConversation\)return;if\(result\.suggestion\)/);
  assert.match(html, /const d=await api\('\/api\/conversation\?id='\+encodeURIComponent\(id\)\);if\(selected!==id\)return/);
  assert.match(html, /if\(selected!==id\)return;renderMessages\(/);
});

test('operator notes are saved only to the conversation selected at submission time', () => {
  assert.match(html, /const targetConversation=selected;const body=\$\('draftText'\)\.value\.trim\(\)/);
  assert.match(html, /conversationId:targetConversation,body/);
  assert.match(html, /if\(selected===targetConversation\)\{\$\('draftText'\)\.value=''/);
});

test('human takeover request preserves its original conversation when operators switch chats', () => {
  assert.match(html, /const targetConversation=selected;const targetPaused=!paused/);
  assert.match(html, /conversationId:targetConversation,paused:targetPaused/);
  assert.match(html, /if\(selected===targetConversation\)\{await openChat\(targetConversation\)/);
});
