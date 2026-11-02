import assert from 'node:assert/strict';
import worker from './worker.mjs';

const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const date='2026-11-02';
let entryStatus='approved',releaseMode=null,revision=1;
const deliveryRows=new Map();
const DB={
 prepare(sql){
  let args=[];
  return {
   bind(...values){args=values;return this},
   async first(){throw Error('Unexpected first '+sql)},
   async all(){
    if(sql.includes('SELECT e.id FROM manna_entries e WHERE e.status=')){
      return {results:[{id}]};
    }
    if(sql.includes('SELECT id,publish_date FROM manna_entries WHERE publish_date<=?')){
      assert.equal(args[0],date);
      return {results:entryStatus==='approved'?[{id,publish_date:date}]:[]};
    }
    throw Error('Unexpected SELECT '+sql);
   },
   async run(){
    if(sql.includes("INSERT OR IGNORE INTO manna_deliveries")){
      if(!deliveryRows.has(args[2]))deliveryRows.set(args[2],{id:args[0],entry_id:args[1],destination:args[2],status:'pending'});
      return {meta:{changes:1}};
    }
    if(sql.startsWith('UPDATE manna_entries SET status=')){
      if(entryStatus!=='approved')return {meta:{changes:0}};
      entryStatus='published';
      releaseMode='reviewed';
      return {meta:{changes:1}};
    }
    if(sql.startsWith('INSERT INTO manna_audit'))return {meta:{changes:1}};
    throw Error('Unexpected update '+sql);
   }
  };
 }
};
const env={DB,EDITOR_TOKEN:'editor-secret',ALLOW_UNREVIEWED_PUBLICATION:'false'};
const url='https://example.test/api/publish-check';
const req=()=>new Request(url,{method:'POST',headers:{authorization:'Bearer editor-secret'}});
let response=await worker.fetch(req(),env);
assert.equal(response.status,200);
assert.equal((await response.json()).published,1);
assert.equal(releaseMode,'reviewed');
assert.deepEqual([...deliveryRows.keys()].sort(),['community','studio'],'New publication must queue Studio, never obsolete Facebook, Buffer or email');
response=await worker.fetch(req(),env);
assert.equal((await response.json()).published,0,'Repeated publication is idempotent');
assert.deepEqual([...deliveryRows.keys()].sort(),['community','studio']);
console.log('PASS publishing creates Studio delivery exactly once and cannot re-publish on recovery');
