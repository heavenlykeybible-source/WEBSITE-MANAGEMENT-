import assert from 'node:assert/strict';
import {handleReadPray} from '../read-pray-server.js';
const origin='https://bible.example';
const endpoint='https://fcm.googleapis.com/fcm/send/example-test';
const goodKeys={p256dh:'a'.repeat(50),auth:'b'.repeat(25)};
let stored=null,sqls=[];
const env={READ_PRAY_VAPID_PUBLIC:'test',PUSH_DISPATCHER:{},READ_PRAY_DB:{prepare(sql){sqls.push(sql);return {bind(...args){return {async run(){const current={p256dh:args[2],auth:args[3],time:args[4]};if(!stored){stored=current;return {meta:{changes:1}};}if(stored.auth!==current.auth||stored.p256dh!==current.p256dh)return {meta:{changes:0}};stored=current;return {meta:{changes:1}};}};}}}}};
async function subscribe(keys,time='06:00'){const url=new URL(origin+'/api/read-pray/subscribe');return handleReadPray(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({subscription:{endpoint,keys},time,zone:'Africa/Lagos'})}),env,url);}
assert.equal((await subscribe(goodKeys)).status,200);
assert.equal((await subscribe({...goodKeys,auth:'c'.repeat(25)},'07:00')).status,409,'wrong key must not take over the same endpoint');
assert.equal(stored.time,'06:00','original reminder time remains');
assert.equal((await subscribe(goodKeys,'08:00')).status,200,'valid subscriber may update schedule');
assert.equal(stored.time,'08:00');
assert(sqls.every(sql=>sql.includes('read_pray_push.auth=excluded.auth')&&sql.includes('read_pray_push.p256dh=excluded.p256dh')));
console.log('PASS: subscription takeover blocked, legitimate reminder-time updates preserved');
