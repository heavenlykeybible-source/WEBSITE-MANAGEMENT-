import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../public/'+path,import.meta.url),'utf8');

test('My Walk with God has the approved spiritual-growth identity and mission',()=>{
 const html=read('walk-offline.html');
 assert.match(html,/<h1>My Walk with God<\/h1>/);
 assert.match(html,/Complete Spiritual Growth Application/);
 assert.match(html,/Preaching the gospel of the kingdom of heaven/);
 assert.match(html,/equipping the saints to be ready for the coming of Jesus/);
 assert.match(html,/Together we take Christ to the nations of the world/);
 assert.doesNotMatch(html,/My Walk with God Calculator/);
 assert.doesNotMatch(read('experience.html'),/My Walk with God Calculator/);
});

test('approved spiritual-growth modules are in the expected order with Radio before Website',()=>{
 const html=read('walk-offline.html');
 const labels=['Holy Bible','Bible Champion','Strength for Today','Bible Study','Prayer Journey','Spiritual Planner','Radio','Website &amp; Blog','E-Book &amp; Hymns','Other Ministry Apps'];
 const nav=html.match(/<nav class="walk-feature-grid"[\s\S]*?<\/nav>/)?.[0];
 assert.ok(nav,'Growth dashboard missing');
 let previous=-1;
 for(const label of labels){const pos=nav.indexOf('<strong>'+label+'</strong>');assert.ok(pos>previous,'Missing or misordered tile: '+label);previous=pos;}
 assert.match(read('walk-offline.css'),/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('retired local Bible questions quiz is absent but encrypted notebook and planner remain',()=>{
 const html=read('walk-offline.html'),js=read('walk-offline.js'),content=read('walk-offline-content.js');
 assert.doesNotMatch(html,/id="quiz-topic"|id="quiz-score"|id="questions"/);
 assert.doesNotMatch(js,/renderQuiz|QUESTIONS/);
 assert.doesNotMatch(content,/export const QUESTIONS/);
 assert.match(html,/id="walk-spiritual-planner"/);
 assert.match(html,/id="walk-prayer-journey"/);
 assert.match(js,/openNotebook/);
 assert.match(js,/sealNotebook/);
});
