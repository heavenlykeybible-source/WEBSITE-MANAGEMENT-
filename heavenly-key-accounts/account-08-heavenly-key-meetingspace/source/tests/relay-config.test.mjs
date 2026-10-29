import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=(await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../site/_worker.js',import.meta.url))).toString('base64'))).default;
const health=async vars=>(await(await app.fetch(new Request('https://meeting.test/api/health'),vars,{})).json()).relayConfigured;
test('broadcast readiness rejects weak secrets, plaintext URLs and credentials in relay URLs',async()=>{
 for(const vars of [{},{RELAY_URL:'wss://relay.test',RELAY_SECRET:'short'},{RELAY_URL:'ws://relay.test',RELAY_SECRET:'x'.repeat(40)},{RELAY_URL:'wss://name:secret@relay.test',RELAY_SECRET:'x'.repeat(40)}])assert.equal(await health(vars),false);
 assert.equal(await health({RELAY_URL:'wss://relay.test/broadcast',RELAY_SECRET:'x'.repeat(40)}),true);
});
