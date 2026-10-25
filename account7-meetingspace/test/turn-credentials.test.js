import test from 'node:test';
import assert from 'node:assert/strict';
import {issueTurnCredentials} from '../src/turn-credentials.js';
const options={userId:'owner-123',turnUrls:['turns:relay.example.org:5349?transport=tcp'],sharedSecret:'dev-test-turn-shared-secret-must-stay-server-side',now:1800000000,ttlSeconds:600};
test('TURN relay credentials use limited lifetime and do not return secret',async()=>{
 const credentials=await issueTurnCredentials(options);
 assert.equal(credentials.username,'1800000600:owner-123');
 assert.equal(credentials.expiresAt,1800000600000);
 assert.equal(credentials.credentialType,'password');
 assert.ok(credentials.credential.length>=20);
 assert.equal(Object.hasOwn(credentials,'sharedSecret'),false);
});
test('TURN credential issuance validates identity, relay URLs and lifetime',async()=>{
 await assert.rejects(issueTurnCredentials({...options,userId:'invalid value'}),/identity/);
 await assert.rejects(issueTurnCredentials({...options,turnUrls:['https://example.org']}),/URLs/);
 await assert.rejects(issueTurnCredentials({...options,ttlSeconds:7200}),/lifetime/);
 await assert.rejects(issueTurnCredentials({...options,sharedSecret:'short'}),/not configured/);
});
