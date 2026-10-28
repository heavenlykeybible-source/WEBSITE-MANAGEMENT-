import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../public/'+p,import.meta.url),'utf8');
test('all six study buttons are present once inside the collapsible Bible study panel',()=>{
 const html=read('bible.html');
 for(const key of ['summary','lessons','characters','important','cross','definitions']){
  assert.equal((html.match(new RegExp('data-study-tool="'+key+'"','g'))||[]).length,1,key);
 }
 assert.match(html,/<details id="bible-study-tools"/);
 assert.ok(html.includes('Lessons &amp; Guides'));
 assert.ok(html.includes('/walk-offline.html#walk-bible-study'));
 assert.ok(html.includes('Bible Tools'));
 assert.ok(html.includes('chapter-study-tools.js'));
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

test('only supported Quick Bible Tools are visible and uniquely wired',()=>{
 const html=read('bible.html');
 const original=['summary','lessons','characters','important','cross','definitions'];
 const additional=['search','notes','timeline','topical','promises'];
 for(const id of original)assert.equal((html.match(new RegExp('data-study-tool="'+id+'"','g'))||[]).length,1,id);
 for(const id of additional)assert.equal((html.match(new RegExp('data-extra-tool="'+id+'"','g'))||[]).length,1,id);
 for(const id of ['maps','verse-image','memory'])assert.ok(!html.includes('data-extra-tool="'+id+'"'),id+' must remain hidden until implemented');
 assert.ok(html.includes('href="/walk-offline.html#walk-bible-study"'));
 assert.ok(html.includes('src="/extra-bible-tools.js"'));
 assert.ok(html.includes('Quick Bible Tools'));
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
