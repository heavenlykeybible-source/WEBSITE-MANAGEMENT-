import assert from 'node:assert/strict';
import fs from 'node:fs';
import {dispatchReadPray} from '../read-pray-server.js';
const statements=[];let attempts=0;let dispatched=0;let claimed=false;let fail=false;
const db={prepare(sql){const item={sql,bind(...args){this.args=args;return this},async all(){return {results:sql.includes('WHERE id>?')?[{id:'z',endpoint:'https://fcm.googleapis.com/fcm/send/x',p256dh:'x',auth:'y',local_time:'06:30',timezone:'Africa/Lagos',last_sent_day:null}]:[]}},async run(){statements.push({sql,args:this.args});if(sql.includes('SET claim_until=?')){if(claimed)return {meta:{changes:0}};claimed=true;return {meta:{changes:1}};}if(sql.includes('SET claim_until=NULL')){claimed=false;return {meta:{changes:1}}}return {meta:{changes:1}}}};return item}};
const dispatcher={async fetch(){dispatched++;return {status:fail?503:201,ok:!fail}}};
const env={READ_PRAY_DB:db,PUSH_DISPATCHER:dispatcher};
let result=await dispatchReadPray(env,new Date('2026-10-22T05:30:00Z'));
assert.equal(result.delivered,1);assert.equal(dispatched,1);
assert(statements.some(x=>x.sql.includes('SET claim_until=?')));
// Two overlapping cycles should respect a non-expired database claim.
claimed=true;result=await dispatchReadPray(env,new Date('2026-10-22T05:30:00Z'));
assert.equal(result.delivered,0);assert.equal(dispatched,1);
claimed=false;fail=true;result=await dispatchReadPray(env,new Date('2026-10-23T05:30:00Z'));
assert.equal(result.failed,1);assert.equal(claimed,false);
const client=fs.readFileSync('heavenly-key-website/bible/read-pray-push.js','utf8');
assert(client.indexOf("Save your Read & Pray preferences before enabling push")<client.indexOf('Notification.requestPermission()'));
console.log('PASS: scheduler dispatch lease, overlap prevention, retry release, consent precheck');
