import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('host and guest gallery positions remain within their allotted halves', () => {
  const html = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('const P={');
  const end = html.indexOf('\n', html.indexOf('for(let count=1;count<=20', start));
  assert.ok(start >= 0 && end > start, 'gallery definitions must exist');
  const positions = vm.runInNewContext(html.slice(start, end) + '; P');
  for (let count = 1; count <= 20; count++) {
    for (let index = 0; index < count; index++) {
      const [x, y, width, height] = positions['guestGallery' + count + 'x' + index];
      assert.ok(x >= 0.5 && y >= 0 && width > 0 && height > 0);
      assert.ok(x + width <= 1 + 1e-9 && y + height <= 1 + 1e-9);
    }
  }
});
