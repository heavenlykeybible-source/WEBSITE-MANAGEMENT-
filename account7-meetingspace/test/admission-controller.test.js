import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeAdmission,joinAdmission,reviewAdmission,ejectAdmission,lockAdmission,canReceiveMeetingMedia} from '../src/admission-controller.js';
const owner={verified:true,role:'owner',userId:'owner1'};
const guest={verified:true,role:'participant',userId:'guest1'};
test('guest must wait for owner approval before receiving media',()=>{
 let room=initializeAdmission(owner);
 let result=joinAdmission(room,guest,'Guest');room=result.room;
 assert.equal(result.status,'waiting');
 assert.equal(canReceiveMeetingMedia(room,guest),false);
 room=reviewAdmission(room,owner,'guest1','admit');
 assert.equal(canReceiveMeetingMedia(room,guest),true);
 room=ejectAdmission(room,owner,'guest1');
 assert.equal(canReceiveMeetingMedia(room,guest),false);
});
test('unverified owner cannot admit guests',()=>{
 let room=initializeAdmission(owner);
 room=joinAdmission(room,guest,'Guest').room;
 assert.throws(()=>reviewAdmission(room,{...owner,verified:false},'guest1','admit'));
});
test('locked rooms reject new guests',()=>{
 let room=lockAdmission(initializeAdmission(owner),owner,true);
 assert.equal(joinAdmission(room,guest,'Guest').status,'locked');
});
test('participants cannot remove others or lock rooms',()=>{
 const room=initializeAdmission(owner);
 assert.throws(()=>ejectAdmission(room,guest,'owner1'));
 assert.throws(()=>lockAdmission(room,guest,true));
});
