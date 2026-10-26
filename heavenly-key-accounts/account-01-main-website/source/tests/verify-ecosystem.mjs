// Run from any directory: node tests/verify-ecosystem.mjs
// Static regression checks for the approved Account 1 ecosystem.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(site, 'index.html'), 'utf8');
const css = readFileSync(resolve(site, 'css/heavenly-ecosystem.css'), 'utf8');
const index = html.indexOf('data-cms-section="ecosystem"');
const welcome = html.indexOf('data-cms-section="welcome"');
const assignment = html.indexOf('data-cms-section="assignment"');
assert.ok(welcome >= 0 && index > welcome && assignment > index, 'Ecosystem must follow welcome slider, before assignment');
const section = html.slice(index, assignment);
const categories = ['network','bible','radio','apps','blog','studio','control','editor','meeting'];
for (const category of categories) assert.match(section, new RegExp('hk-eco-card hk-eco-' + category + '(?=[">])'));
assert.equal((section.match(/<article class="hk-eco-card/g)||[]).length, 9, 'Exactly nine ecosystem cards');
assert.match(section, /One Platform • Multiple Kingdom Solutions/);
assert.match(section, /equipping the saints to be ready for the coming of Jesus Christ/);
assert.match(section, /Taking Christ to the Nations of the World/);
assert.match(section, /Join Live Meeting/);
assert.match(section, /https:\/\/global\\.heavenlykey\\.org\//, 'Social network must link to verified public domain');
assert.ok(!section.includes('community.heavenlykey.org'), 'Broken social domain should not return');
assert.match(section, /Upcoming Meetings/);
assert.match(section, /Zoom-style live meetings for fellowship, Bible study and prayer/);
assert.equal((section.match(/Ministry Use Only/g)||[]).length,3);
assert.equal((section.match(/target="_blank" rel="noopener noreferrer"/g)||[]).length, 7, 'All public calls to action must open safe new tabs');
assert.match(section, /class="hk-eco-connections"/);
assert.match(css, /@keyframes hk-land-drift/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /grid-template-areas/);
assert.match(css, /@media\(max-width:580px\)/);
assert.ok(existsSync(resolve(site,'assets/ministry/rotating-world-land.svg')),'The existing map texture must be deployed alongside CSS');
for (const image of css.matchAll(/url\("\.\.\/assets\/ministry\/([^"]+)"\)/g)) {
  assert.ok(existsSync(resolve(site,'assets/ministry',image[1])), 'Missing photo asset: '+image[1]);
}
console.log('Heavenly Key ecosystem checks passed (9 nodes, 7 public actions, 3 restricted tools, globe, assets and responsive layout).');
