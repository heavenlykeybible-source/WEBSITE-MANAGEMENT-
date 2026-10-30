import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Execute the production validator, not a separate reimplementation.
const root=fileURLToPath(new URL('../',import.meta.url));
const source=readFileSync(resolve(root,'src/restream.ts'),'utf8');
const start=source.indexOf('function validStreamingOutput(');
const end=source.indexOf('// Authoritative D1 state:',start);
assert.ok(start>=0&&end>start,'Production destination validator must be present');
const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const validate=runInNewContext(js+';validStreamingOutput',{URL});
assert.equal(typeof validate,'function');

const accepted=[
 'rtmps://a.rtmp.youtube.com/live2/stream-key',
 'rtmps://live-api-s.facebook.com:443/rtmp/stream-key',
 'rtmps://global-live.example.org/ingest/key'
];
const rejected=[
 'rtmp://a.rtmp.youtube.com/live2/key',
 'http://example.org/live',
 'rtmps://localhost/live/key',
 'rtmps://localhost./live/key',
 'rtmps://127.0.0.1/live/key',
 'rtmps://2130706433/live/key',
 'rtmps://127.1/live/key',
 'rtmps://0x7f000001/live/key',
 'rtmps://017700000001/live/key',
 'rtmps://[::1]/live/key',
 'rtmps://gateway.internal/live/key',
 'rtmps://studio.local/live/key',
 'rtmps://user:pass@public.example.org/live/key',
 'rtmps://public.example.org/live/key#fragment',
 'rtmps://evil.test/live/key',
 'rtmps://host.invalid/live/key',
 'not-a-url',
 'rtmps://a.rtmp.youtube.com/'+('a'.repeat(2100))
];
for(const value of accepted)assert.equal(validate(value),true,'Expected approved RTMPS destination: '+value);
for(const value of rejected)assert.equal(validate(value),false,'Expected RTMPS destination to be rejected: '+value);

// Execute the production active-state parser to ensure corrupt D1/KV rows
// cannot be interpreted as an idle broadcaster.
const parserStart=source.indexOf('function parseActivePayload(');
const parserEnd=source.indexOf('// Authoritative D1 state:',parserStart);
assert.ok(parserStart>=0&&parserEnd>parserStart,'Production active-state parser must be present');
const parserJs=ts.transpileModule(source.slice(parserStart,parserEnd),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const parseActive=runInNewContext(parserJs+';parseActivePayload',{JSON,Error,Array});
assert.equal(parseActive('null'),null);
assert.equal(parseActive('{"egressId":"safe-egress"}').egressId,'safe-egress');
for(const value of ['','{}','false','123','[]','{"egressId":null}','{"egressId":3}','{"egressId":""}','{"egressId":"   "}','{"egressId":"'+('x'.repeat(257))+'"}','{broken']){
 assert.throws(()=>parseActive(value),/Stored broadcast state is invalid/,'Invalid active state must block stream replacement: '+value);
}

console.log('Account 2 live RTMPS URL and active-state integrity tests passed');
