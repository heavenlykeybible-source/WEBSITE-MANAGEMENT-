import test from 'node:test';
import assert from 'node:assert/strict';
import {safeMessage,mayJoinRoom} from '../src/meeting-policy.js';
test('rejects malformed and non-object WebSocket payloads',()=>{
 for(const input of ['','null','[]','true','42','{broken',JSON.stringify('hello')])assert.equal(safeMessage(input),null);
 assert.deepEqual(safeMessage('{"type":"chat","text":"hi"}'),{type:'chat',text:'hi'});
 assert.equal(safeMessage('{"a":1}',3),null);
});
test('room admission enforces capacity and closed state',()=>{
 assert.equal(mayJoinRoom({active:3,capacity:3}).status,429);
 assert.equal(mayJoinRoom({isClosed:true}).status,410);
 assert.equal(mayJoinRoom({isExpired:true}).status,403);
 assert.equal(mayJoinRoom({isLocked:true,role:'participant'}).status,403);
 assert.equal(mayJoinRoom({isLocked:true,role:'owner'}).allowed,true);
 assert.equal(mayJoinRoom({active:1,capacity:3}).allowed,true);
 assert.equal(mayJoinRoom({active:-1}).status,503);
});
