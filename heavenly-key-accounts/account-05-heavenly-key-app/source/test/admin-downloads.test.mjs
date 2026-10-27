import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('admin statistics dashboard is not indexed or linked publicly',()=>{
 const html=read('admin-downloads.html');
 assert.match(html,/noindex,nofollow/);
 assert.match(html,/admin-downloads\.js/);
 assert.match(html,/type="password"/);
 assert.doesNotMatch(read('index.html'),/admin-downloads\.html/);
 assert.doesNotMatch(read('downloads.html'),/admin-downloads\.html/);
});
test('dashboard does not persist administrator credentials or render remote HTML',()=>{
 const source=read('admin-downloads.js');
 assert.match(source,/credentials:'omit'/);
 assert.match(source,/token\.value=''/);
 assert.match(source,/textContent/);
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|innerHTML/);
});
