import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
test('Apps Portal keeps approved minimal top navigation on both pages',()=>{
  for(const name of ['index.html','downloads.html']){
    const html=read(name);
    const header=html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1];
    assert.ok(header, name+' must have site header');
    assert.match(header,/data-return-main/);
    assert.match(header,/Back to Main Website/);
    assert.doesNotMatch(header,/Global Christian Social Network|Revival Radio|Holy Bible|Contact Us/);
    assert.doesNotMatch(header,/<nav/);
    assert.match(html,/data-download-app="all-in-one"/);
    assert.match(html,/href="\/experience.html"/);
    assert.match(html,/Together we take Christ/);
  }
});
