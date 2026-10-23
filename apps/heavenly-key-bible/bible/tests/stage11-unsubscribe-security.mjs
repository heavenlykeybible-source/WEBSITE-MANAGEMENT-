import assert from 'node:assert/strict';
import fs from 'node:fs';
import {handleReadPray} from '../read-pray-server.js';
const origin='https://bible.example', endpoint='https://fcm.googleapis.com/fcm/send/private-test';
const good='abcdefghijklmnopqrstuvwxyz012345';
let calls=[];
const env={READ_PRAY_DB:{prepare(sql){return {bind(...args){calls.push({sql,args});return {async run(){return {meta:{changes:args[1]===good?1:0}};}};}}}}};
async function remove(auth){const url=new URL(origin+'/api/read-pray/unsubscribe');return handleReadPray(new Request(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({endpoint,auth})}),env,url);}
assert.equal((await remove(undefined)).status,400,'anonymous endpoint-only unsubscribe forbidden');
assert.equal((await remove('not-the-valid-auth-key')).status,403,'incorrect auth forbidden');
assert.equal((await remove(good)).status,200,'actual subscriber may unsubscribe');
assert(calls.every(x=>x.sql.includes('WHERE id=? AND auth=?')),'deletion must verify endpoint and auth');
assert(fs.readFileSync('heavenly-key-website/bible/read-pray-push.js','utf8').includes('auth:sub.toJSON().keys.auth'),'client sends matching auth key');
console.log('PASS: unsubscribe demands valid subscription authorization');
