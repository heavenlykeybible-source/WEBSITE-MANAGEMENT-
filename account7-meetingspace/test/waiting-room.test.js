import test from 'node:test';
import assert from 'node:assert/strict';
import {createWaitingRoom,requestAdmission,decideAdmission,removeParticipant,setRoomLock} from '../src/waiting-room.js';
test('new participants wait for admission',()=>{
 const room=createWaitingRoom({ownerId:'owner'});
 const result=requestAdmission(room,{userId:'guest',displayName:'Guest'});
 assert.equal(result.status,'waiting');assert.equal(result.room.pending.length,1);
});
test('non-owner cannot admit',()=>{
 const room=requestAdmission(createWaitingRoom({ownerId:'owner'}),{userId:'guest',displayName:'Guest'}).room;
 assert.throws(()=>decideAdmission(room,{actorId:'guest',userId:'guest',decision:'admit'}));
});
test('owner can admit and remove',()=>{
 let room=requestAdmission(createWaitingRoom({ownerId:'owner'}),{userId:'guest',displayName:'Guest'}).room;
 room=decideAdmission(room,{actorId:'owner',userId:'guest',decision:'admit'});
 assert.deepEqual(room.admitted,['guest']);
 room=removeParticipant(room,{actorId:'owner',userId:'guest'});
 assert.deepEqual(room.admitted,[]);
});
test('denied users cannot immediately re-request',()=>{
 let room=requestAdmission(createWaitingRoom({ownerId:'owner'}),{userId:'guest',displayName:'Guest'}).room;
 room=decideAdmission(room,{actorId:'owner',userId:'guest',decision:'deny'});
 assert.equal(requestAdmission(room,{userId:'guest',displayName:'Guest'}).status,'denied');
});
test('locked room blocks new requests',()=>{
 const room=setRoomLock(createWaitingRoom({ownerId:'owner'}),{actorId:'owner',locked:true});
 assert.equal(requestAdmission(room,{userId:'guest',displayName:'Guest'}).status,'locked');
});
test('duplicate requests do not create multiple entries',()=>{
 let room=requestAdmission(createWaitingRoom({ownerId:'owner'}),{userId:'guest',displayName:'Guest'}).room;
 room=requestAdmission(room,{userId:'guest',displayName:'Guest'}).room;
 assert.equal(room.pending.length,1);
});
