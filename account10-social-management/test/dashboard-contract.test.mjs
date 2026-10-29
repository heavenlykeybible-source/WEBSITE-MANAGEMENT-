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
