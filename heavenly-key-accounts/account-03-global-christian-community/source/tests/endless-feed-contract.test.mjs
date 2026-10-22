import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const promo=fs.readFileSync(new URL('../public/community-app-promo.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');

test('near-end sentinel delegates to existing pagination control',()=>{
 assert.match(promo,/hk-feed-near-end/);
 assert.match(promo,/\[data-load-more\]/);
 assert.match(promo,/more\.click\(\)/);
 assert.match(promo,/aria-busy=\\?"true\\?"/);
});

test('feed retains cursor pagination and deduplication',()=>{
 assert.match(app,/data\.nextBefore/);
 assert.match(app,/q\.set\('before',host\.dataset\.nextBefore\)/);
 assert.match(app,/new Set\(\[\.\.\.feed\.querySelectorAll\('\[data-post-id\]'\)\]/);
});
