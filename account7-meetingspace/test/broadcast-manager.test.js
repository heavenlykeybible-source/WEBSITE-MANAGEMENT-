import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {addDestination,updateDestination,broadcastSummary} from '../src/broadcast-manager.js';
test('two Facebook pages can be managed independently',()=>{
 let outputs=[];
 outputs=addDestination(outputs,{platform:'facebook',accountId:'page1',label:'First page'});
 outputs=addDestination(outputs,{platform:'facebook',accountId:'page2',label:'Second page'});
 const first=outputs[0].id;
 outputs=updateDestination(outputs,first,'starting');
 outputs=updateDestination(outputs,first,'live');
 assert.equal(outputs[0].state,'live');
 assert.equal(outputs[1].state,'ready');
 assert.deepEqual(broadcastSummary(outputs),{total:2,live:1,failed:0,starting:0});
});
test('duplicate destination is rejected',()=>{
 const outputs=addDestination([],{platform:'youtube',accountId:'channel1',label:'Channel'});
 assert.throws(()=>addDestination(outputs,{platform:'youtube',accountId:'channel1',label:'Again'}));
});
test('failed output requires reason',()=>{
 const outputs=addDestination([],{platform:'youtube',accountId:'channel1',label:'Channel'});
 assert.throws(()=>updateDestination(outputs,outputs[0].id,'failed'));
});
