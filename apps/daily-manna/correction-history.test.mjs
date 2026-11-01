import assert from 'node:assert/strict';
import worker from './worker.mjs';
const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
let entry={id,publish_date:'2026-10-31',title:'Original',scripture:'John 1:1',body:'Original message',prayer:'Original prayer',status:'published',revision:1};
const history=[],audits=[];
const DB={
 prepare(sql){
  let args=[];
  return {bind(...values){args=values;return this},async first(){
   if(sql.includes('SELECT * FROM manna_entries'))return {...entry};
   throw Error('Unexpected select '+sql)
  },async run(){
   if(sql.includes('INSERT INTO manna_audit')){audits.push(args);return {meta:{changes:1}}}
   throw Error('Unexpected statement '+sql)
  },get args(){return args},get sql(){return sql}};
 },
 async batch(statements){
  const [snapshot,update]=statements;
  assert.ok(snapshot.sql.includes('INSERT OR IGNORE INTO manna_entry_revisions'));
  assert.ok(update.sql.includes('revision=revision+1'));
  if(entry.revision!==update.args.at(-1))return [{meta:{changes:0}},{meta:{changes:0}}];
  history.push({...entry});
  entry={...entry,title:update.args[0],scripture:update.args[1],body:update.args[2],prayer:update.args[3],revision:entry.revision+1};
  return [{meta:{changes:1}},{meta:{changes:1}}];
 }
};
const env={DB,EDITOR_TOKEN:'secret'};
const request=(revision,title)=>new Request('https://example.test/api/entries/'+id,{method:'PUT',headers:{authorization:'Bearer secret','content-type':'application/json'},body:JSON.stringify({publish_date:'2026-10-31',title,scripture:'John 1:1',body:'Corrected text',prayer:'Prayer',expected_revision:revision})});
let res=await worker.fetch(request(1,'Corrected'),env);
assert.equal(res.status,200);
assert.equal(entry.status,'published');
assert.equal(entry.revision,2);
assert.equal(history.length,1);
assert.equal(history[0].body,'Original message');
assert.equal(audits.length,1);
res=await worker.fetch(request(1,'Stale'),env);
assert.equal(res.status,409);
assert.equal(history.length,1);
assert.equal(entry.title,'Corrected');
console.log('PASS correction keeps previous published content, increments revision and rejects stale writes');
