import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStreamEndpoint,redactStreamDestination,validateCredentialRecord} from '../src/broadcast-credentials.js';
test('only secure streaming endpoints accepted',()=>{
 assert.equal(validateStreamEndpoint('rtmps://stream.example.com/live'),'rtmps://stream.example.com/live');
 assert.throws(()=>validateStreamEndpoint('rtmp://stream.example.com/live'));
 assert.throws(()=>validateStreamEndpoint('https://example.com/live'));
 assert.throws(()=>validateStreamEndpoint('rtmps://localhost/live'));
});
test('credential-bearing URLs rejected',()=>assert.throws(()=>validateStreamEndpoint('rtmps://user:pass@stream.example.com/live')));
test('public destination omits credentials',()=>{
 const output=redactStreamDestination({id:'a',platform:'youtube',label:'Main',state:'ready',streamKey:'secret',accessToken:'token'});
 assert.equal(output.streamKey,undefined);assert.equal(output.accessToken,undefined);
});
test('credential records require encrypted payload',()=>{
 assert.throws(()=>validateCredentialRecord({destinationId:'a',encryptedSecret:'plain',keyVersion:1}));
 assert.equal(validateCredentialRecord({destinationId:'a',encryptedSecret:'ciphertext-long-value',keyVersion:1}).keyVersion,1);
});
