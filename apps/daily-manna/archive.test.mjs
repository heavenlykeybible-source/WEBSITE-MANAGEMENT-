import assert from 'node:assert/strict';
import worker from './worker.mjs';
const calls=[];
const DB={prepare(sql){
 let args=[];return {bind(...xs){args=xs;return this},async all(){
  calls.push({sql,args});
  assert.match(sql,/status='published'/,'Never leak drafts or approved future content');
  assert.match(sql,/ORDER BY publish_date DESC LIMIT 25/);
  return {results:[{publish_date:'2026-10-31',title:'Published Example',scripture:'Psalm 1:1'}]};
 }};
}};
const run=(url)=>worker.fetch(new Request(url),{DB});
let res=await run('https://example.test/api/archive');
assert.equal(res.status,200);
let data=await res.json();
assert.equal(data.entries.length,1);
assert.deepEqual(Object.keys(data.entries[0]),['publish_date','title','scripture']);
assert.match(calls.at(-1).sql,/publish_date<=\?/);
assert.equal((await run('https://example.test/api/archive?before=invalid')).status,400);
res=await run('https://example.test/api/archive?before=2026-11-01');
assert.equal(res.status,200);
assert.match(calls.at(-1).sql,/publish_date<\?/,'Pagination must exclude the previous page last date');
console.log('PASS published-only archive, safe index fields, validation and pagination');
