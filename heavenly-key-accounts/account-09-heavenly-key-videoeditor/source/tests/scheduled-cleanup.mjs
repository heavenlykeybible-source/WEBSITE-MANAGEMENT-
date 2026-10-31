import { strict as assert } from 'node:assert';
import cleanup from '../scripts/media-cleanup-worker.mjs';

const records = [
  {id:'a',user_id:'alice',r2_key:'alice/file-a'},
  {id:'b',user_id:'bob',r2_key:'other/file-b'},
  {id:'c',user_id:'alice',r2_key:'alice/file-c'}
];
const deleted = [];
let retryCount = 0;
const env = {
  DB: { prepare(sql) {
    return {
      all: async()=>({results:records.map(x=>({...x}))}),
      bind(id,user,key) {
        return {run:async()=>{
          const i=records.findIndex(x=>x.id===id&&x.user_id===user&&x.r2_key===key);
          if(i>=0)records.splice(i,1);
          return {meta:{changes:i>=0?1:0}};
        }};
      }
    };
  }},
  MEDIA: {async delete(key) {
    deleted.push(key);
    if(key==='alice/file-c'&&retryCount++===0)throw Error('Temporary R2 failure');
  }}
};
await cleanup.scheduled({},env);
assert.deepEqual(deleted,['alice/file-a','alice/file-c','alice/file-c']);
assert.deepEqual(records.map(x=>x.id),['b']);
console.log('Scheduled media cleanup ownership and retry tests passed');
