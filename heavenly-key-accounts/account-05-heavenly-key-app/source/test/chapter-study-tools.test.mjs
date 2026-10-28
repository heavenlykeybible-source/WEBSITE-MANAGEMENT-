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
