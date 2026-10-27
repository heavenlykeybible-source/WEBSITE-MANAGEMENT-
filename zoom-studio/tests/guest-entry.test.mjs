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
