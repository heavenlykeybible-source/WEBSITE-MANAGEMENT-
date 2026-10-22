import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/styles.css',import.meta.url),'utf8');

test('radio link respects the ministry website anti-framing policy',()=>{
  assert.doesNotMatch(html,/<iframe[^>]+Heavenly Key Radio/i,'Do not embed the radio page: the ministry site sends X-Frame-Options DENY and frame-ancestors none.');
  assert.match(html,/href="https:\/\/heavenlykey\.org\/pages\/radio\.html\?hk-player-window=1" target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/The radio site intentionally blocks iframe embedding/);
});

test('radio launch link remains accessible and touch-friendly',()=>{
  assert.match(html,/class="hk-app-radio-launch"/);
  assert.match(css,/\.hk-app-radio-launch\s*\{[^}]*min-height:52px/s);
  assert.match(css,/\.hk-app-radio-launch:focus-visible/);
});
