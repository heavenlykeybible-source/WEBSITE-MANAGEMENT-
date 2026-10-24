import test from 'node:test';
import assert from 'node:assert/strict';
import {canPerform,validateRoomSettings,resolveAdmission} from '../src/meeting-access.js';
test('participants cannot manage other users',()=>{
 for(const action of ['admit','deny','remove','mute-all','lock','start-broadcast','end-meeting'])assert.equal(canPerform('participant',action),false);
});
test('cohosts have limited permissions',()=>{
 assert.equal(canPerform('cohost','admit'),true);
 assert.equal(canPerform('cohost','end-meeting'),false);
});
test('settings default to safer options',()=>{
 const settings=validateRoomSettings({});
 assert.equal(settings.waitingRoom,true);
 assert.equal(settings.guestsCanShareScreen,false);
 assert.equal(settings.maxParticipants,12);
});
test('locked meetings deny admission',()=>{
 const settings=validateRoomSettings({locked:true});
 assert.deepEqual(resolveAdmission({settings,authenticated:true,role:'host'}),{admitted:false,reason:'locked'});
});
test('guests must authenticate before admission',()=>{
 const settings=validateRoomSettings({waitingRoom:false});
 assert.equal(resolveAdmission({settings,authenticated:false,role:'participant'}).reason,'authentication-required');
 assert.equal(resolveAdmission({settings,authenticated:true,role:'participant'}).admitted,true);
});
test('waiting room applies to authenticated participants',()=>{
 const settings=validateRoomSettings({});
 assert.equal(resolveAdmission({settings,authenticated:true,role:'participant'}).reason,'waiting-room');
});
