import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBroadcastDashboard,renderBroadcastDashboard} from '../src/broadcast-dashboard.js';
const actor={verified:true,roomId:'room1',role:'host',userId:'h1'};
test('host dashboard redacts credentials',()=>{
 const data=buildBroadcastDashboard([{id:'1',platform:'youtube',label:'Channel',state:'ready',streamKey:'top-secret',accessToken:'token'}],actor,'room1');
 assert.equal(data.destinations[0].streamKey,undefined);
 assert.equal(data.canControl,true);
 assert.doesNotMatch(renderBroadcastDashboard(data),/top-secret|token/);
});
test('participant cannot access dashboard',()=>{
 assert.throws(()=>buildBroadcastDashboard([],{...actor,role:'participant'},'room1'));
});
test('dashboard escapes untrusted labels',()=>{
 const data=buildBroadcastDashboard([{id:'1',platform:'youtube',label:'<script>alert(1)</script>',state:'ready'}],actor,'room1');
 assert.doesNotMatch(renderBroadcastDashboard(data),/<script>/);
});
