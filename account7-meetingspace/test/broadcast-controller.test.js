import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
import {addDestination} from '../src/broadcast-manager.js';
import {requestBroadcastOperation,applyEncoderReport} from '../src/broadcast-controller.js';
const host={verified:true,userId:'host1',roomId:'room1',role:'host'};
test('host start requests encoder confirmation, not immediate live state',()=>{
 const outputs=addDestination([],{platform:'youtube',accountId:'channel1',label:'Channel'});
 const result=requestBroadcastOperation(outputs,{roomId:'room1',action:'start',destinationId:outputs[0].id},host);
 assert.equal(result.outputs[0].state,'starting');
 assert.equal(result.command.status,'pending_encoder_confirmation');
 assert.throws(()=>applyEncoderReport(result.outputs,{destinationId:outputs[0].id,state:'live'}));
 assert.equal(applyEncoderReport(result.outputs,{destinationId:outputs[0].id,state:'live'},{verifiedEncoder:true})[0].state,'live');
});
test('participant cannot request a broadcast',()=>{
 const outputs=addDestination([],{platform:'youtube',accountId:'channel1',label:'Channel'});
 assert.throws(()=>requestBroadcastOperation(outputs,{roomId:'room1',action:'start',destinationId:outputs[0].id},{...host,role:'participant'}));
});
