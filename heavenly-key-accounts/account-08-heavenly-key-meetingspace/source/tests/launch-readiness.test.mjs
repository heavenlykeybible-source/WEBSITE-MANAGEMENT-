import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blockers} from '../scripts/check-live.mjs';
import {turnConfig} from '../server/deploy/prepare-turn.mjs';
test('live gate blocks missing infrastructure without requiring optional social OAuth',()=>{
 const h={ok:true,accountsConfigured:true,databaseReady:true,meetingConfigured:true,turnConfigured:false,relayConfigured:false};
 assert.deepEqual(blockers(h),['turnConfigured']);
 assert.deepEqual(blockers(h,true),['turnConfigured','relayConfigured']);
 assert.deepEqual(blockers({...h,turnConfigured:true,relayConfigured:true},true),[]);
 assert.ok(blockers({...h,ok:'true'}).includes('ok'));
});
test('TURN configuration supports existing HMAC credentials and rejects config injection',()=>{
 const config={host:'turn.example.org',publicIP:'203.0.113.10',listenIP:'10.0.0.2',secret:'a'.repeat(48)};
 const text=turnConfig(config);
 assert.match(text,/use-auth-secret/);assert.match(text,/external-ip=203.0.113.10\/10.0.0.2/);
 assert.match(text,/no-cli/);assert.match(text,/denied-peer-ip=169.254/);
 for(const bad of [{secret:'weak'},{secret:'a'.repeat(40)+'\nno-auth'},{host:'turn.example.org\nno-auth'},{publicIP:'bad'},{listenIP:'::1'}])assert.throws(()=>turnConfig({...config,...bad}));
});
