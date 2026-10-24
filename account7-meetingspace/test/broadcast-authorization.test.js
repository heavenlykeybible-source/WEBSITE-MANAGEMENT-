import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeBroadcastAction,safeBroadcastCommand} from '../src/broadcast-authorization.js';
const host={verified:true,userId:'host1',roomId:'room1',role:'host'};
test('host can start authorized broadcast',()=>{
 assert.deepEqual(safeBroadcastCommand({roomId:'room1',action:'start',destinationId:'channel1'},host),{roomId:'room1',action:'start',destinationId:'channel1',requestedBy:'host1'});
});
test('unverified identities cannot start broadcast',()=>assert.throws(()=>authorizeBroadcastAction({...host,verified:false},'start','room1')));
test('participant cannot start broadcast',()=>assert.throws(()=>authorizeBroadcastAction({...host,role:'participant'},'start','room1')));
test('other room cannot be controlled',()=>assert.throws(()=>authorizeBroadcastAction(host,'start','room2')));
test('cohost may configure but cannot start',()=>{
 assert.equal(authorizeBroadcastAction({...host,role:'cohost'},'configure','room1'),true);
 assert.throws(()=>authorizeBroadcastAction({...host,role:'cohost'},'start','room1'));
});
