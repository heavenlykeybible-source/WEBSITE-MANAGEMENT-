import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
test('App discovery and download controls stay on apps.heavenlykey.org', () => {
  for (const name of ['index.html', 'experience.html']) {
    const html = read(name);
    assert.ok(html.includes('href="/downloads.html#download"'), name + ' missing local download link');
    assert.ok(html.includes('href="/downloads.html#choose-your-app"'), name + ' missing local app directory link');
    assert.ok(!html.includes('heavenlykey.org/pages/app.html#'), name + ' has old ministry page app link');
  }
});
test('App download page home links are not ministry homepage links', () => {
  const html = read('downloads.html');
  assert.ok(html.includes('href="/" aria-label="Heavenly Key App home"'));
  assert.ok(html.includes('href="/">App Home</a>'));
  assert.ok(html.includes('href="https://www.heavenlykey.org/">Main Website</a>'));
  assert.ok(html.includes('id="download"'));
  assert.ok(html.includes('id="choose-your-app"'));
  assert.ok(html.includes('href="https://apps.heavenlykey.org/downloads.html"'));
});
