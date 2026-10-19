import test from 'node:test';import assert from 'node:assert/strict';import{pbkdf2Sync}from'node:crypto';
import {centralOwnerLogin} from '../src/services/central-owner-login.ts';
const password='strong-example-password-for-test',salt='test-salt',hash=pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex');
const environment=count=>({OWNER_DASHBOARD_PASSWORD_HASH:hash,OWNER_DASHBOARD_PASSWORD_SALT:salt,DB:{prepare:()=>({all:async()=>({results:Array.from({length:count},(_,i)=>({user_id:i+7}))})})}});
test('owner alias verifies local credential and unique existing owner without modifying members',async()=>{
 assert.equal(await centralOwnerLogin(environment(0),password),null);assert.equal(await centralOwnerLogin(environment(2),password),null);
 assert.equal(await centralOwnerLogin(environment(1),password),7);assert.equal(await centralOwnerLogin(environment(1),'wrong-password-value'),null);
 assert.equal(await centralOwnerLogin({...environment(1),OWNER_DASHBOARD_PASSWORD_HASH:undefined},password),null);
});
