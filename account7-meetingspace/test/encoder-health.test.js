import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretEncoderHealth,publicEncoderStatus} from '../src/encoder-health.js';
test('fresh confirmed encoder report is reflected',()=>{
 const health=interpretEncoderHealth({connected:true,observedAt:1000,destinations:[{state:'live',confirmedByEncoder:true},{state:'live',confirmedByEncoder:false}]},{now:2000});
 assert.deepEqual(health,{encoder:'connected',liveDestinations:1,readyToStream:true});
});
test('stale encoder report fails closed',()=>{
 assert.equal(interpretEncoderHealth({connected:true,observedAt:1000,destinations:[{state:'live',confirmedByEncoder:true}]},{now:40000}).liveDestinations,0);
});
test('future timestamp fails closed',()=>assert.equal(interpretEncoderHealth({connected:true,observedAt:5000},{now:1000}).encoder,'disconnected'));
test('missing encoder report never claims live',()=>assert.deepEqual(publicEncoderStatus(null),{configured:true,encoder:'disconnected',liveDestinations:0,readyToStream:false}));
