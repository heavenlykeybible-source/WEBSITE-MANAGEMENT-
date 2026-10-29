import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
test('Approved app page uses top platform buttons and no contact menu',()=>{for(const name of ['index.html','downloads.html']){const html=read(name);assert.match(html,/data-return-main/);assert.match(html,/Global Christian Social Network/);assert.match(html,/data-download-app="all-in-one"/);assert.doesNotMatch(html,/Contact Us|>Contact</);assert.match(html,/href="\/experience.html"/);assert.match(html,/Together we take Christ/);}});
