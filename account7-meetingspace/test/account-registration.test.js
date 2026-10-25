import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedVerifiedIdentity,provisionVerifiedAccount} from '../src/account-registration.js';
const principal={authenticated:true,emailVerified:true,userId:'oidc:user_12345',email:'Member@Example.org'};
test('rejects self-reported identities without verified email',()=>{
 assert.throws(()=>normalizedVerifiedIdentity({...principal,emailVerified:false}),/Verified email/);
 assert.throws(()=>normalizedVerifiedIdentity({...principal,authenticated:false}),/Verified email/);
});
test('normalizes verified email and retains stable provider subject',()=>{
 assert.deepEqual(normalizedVerifiedIdentity(principal),{id:'oidc:user_12345',email:'member@example.org'});
});
test('provisions verified user without storing a password',async()=>{
 let user=null;
 const db={prepare(sql){return {bind(...args){return {
  run:async()=>{user={id:args[0],email:args[1],disabledAt:null};return {success:true}},
  first:async()=>user
 }}}}};
 assert.deepEqual(await provisionVerifiedAccount(db,principal,{now:1782300000000}),{id:'oidc:user_12345',email:'member@example.org'});
});
test('refuses identity conflicts and disabled accounts',async()=>{
 const db={prepare(sql){return {bind(){return {run:async()=>({success:true}),first:async()=>({id:'oidc:user_12345',email:'someone@example.org',disabledAt:null})}}}}};
 await assert.rejects(provisionVerifiedAccount(db,principal),/conflict/);
});
