import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('legacy Bible link redirects to the maintained reader without stale study controls',()=>{
 const html=read('bible.html');
 assert.match(html,/https:\/\/onlinebible\.heavenlykey\.org\//);
 assert.match(html,/http-equiv="refresh"/);
 assert.doesNotMatch(html,/data-study-tool=/);
 assert.match(read('chapter-study-tools.js'),/latestRequest/);
});
test('chapter study actions load controls on demand and guard failed or stale requests',()=>{
 const js=read('chapter-study-tools.js');
 assert.match(js,/document\.getElementById\('kjv-book-picker'\)/);
 assert.match(js,/document\.getElementById\('kjv-chapter-picker'\)/);
 assert.match(js,/request!==latestRequest/);
 assert.match(js,/manifestResponse\.ok/);
 assert.match(js,/bookResponse\.ok/);
 for(const id of ['genesis:1','psalms:23','john:3'])assert.ok(js.includes("'"+id+"'"));
});

test('cross references link to the KJV reader and chapter switches invalidate results',()=>{
 const js=read('chapter-study-tools.js');
 assert.ok(js.includes("kind==='cross'"));
 assert.ok(js.includes("link.href='/bible.html?book='"));
 assert.ok(js.includes('latestRequest++'));
 assert.ok(js.includes("book.value+':'+chapter.value!==key"));
});

test('legacy handoff exposes no nonfunctional local Bible quick-tool controls',()=>{
 const html=read('bible.html');
 assert.doesNotMatch(html,/data-extra-tool=/);
 assert.match(html,/onlinebible\.heavenlykey\.org/);
 const extra=read('extra-bible-tools.js');
 assert.match(extra,/activeToolRequest/);
 assert.doesNotMatch(extra,/if\(type==='verse-image'\)/);
});
test('study links and async cancellations are guarded',()=>{
 const core=read('chapter-study-tools.js'),extra=read('extra-bible-tools.js');
 assert.ok(core.includes('latestRequest++'));
 assert.ok(core.includes('referenceBooks[match[1]]'));
 assert.ok(extra.includes('activeToolRequest++'));
 assert.ok(extra.includes('request!==activeToolRequest'));
 assert.ok(extra.includes('type===\'search\''));
 assert.ok(!extra.includes("if(type==='verse-image')"));
 assert.ok(!extra.includes("if(type==='memory')"));
});

test('chapter summary renders a complete paragraph instead of individual letters',()=>{
 const core=read('chapter-study-tools.js');
 assert.ok(core.includes("kind==='summary'?(info?.summary?[info.summary]:null)"));
});
