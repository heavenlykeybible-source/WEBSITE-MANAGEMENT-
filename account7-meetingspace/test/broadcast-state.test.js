import test from 'node:test';
import assert from 'node:assert/strict';
import {nextBroadcastState} from '../src/broadcast-state.js';
test('normal broadcast lifecycle',()=>{let state='ready';for(const next of ['starting','live','stopping','ready'])state=nextBroadcastState(state,next);assert.equal(state,'ready')});
test('invalid transitions are rejected',()=>{assert.throws(()=>nextBroadcastState('ready','live'));assert.throws(()=>nextBroadcastState('failed','live'))});
test('failed broadcast can reset',()=>{assert.equal(nextBroadcastState('failed','ready'),'ready')});
