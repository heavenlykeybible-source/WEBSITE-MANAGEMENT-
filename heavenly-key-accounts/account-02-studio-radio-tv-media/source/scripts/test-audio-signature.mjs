import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const root=fileURLToPath(new URL('../',import.meta.url));
const load=p=>readFileSync(resolve(root,p),'utf8');
const compiled=ts.transpileModule(load('src/audio-signature.ts').replace(/^export /gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const valid=runInNewContext(compiled+';supportedAudioSignature', {});
const samples=[
 ['audio/mpeg',[73,68,51,4,0,0]],
 ['audio/mpeg',[255,251,144,100]],
 ['audio/mp4',[0,0,0,24,102,116,121,112,77,52,65,32]],
 ['audio/aac',[255,241,80,128]],
 ['audio/ogg',[79,103,103,83]],
 ['audio/wav',[82,73,70,70,0,0,0,0,87,65,86,69]],
 ['audio/x-wav',[82,73,70,70,0,0,0,0,87,65,86,69]],
 ['audio/webm',[26,69,223,163]],
 ['audio/flac',[102,76,97,67]]
];
for(const [mime,header] of samples) assert.equal(valid(mime,new Uint8Array(header)),true,mime);
for(const [mime] of samples)assert.equal(valid(mime,new Uint8Array([60,104,116,109,108,62,0,0,0,0,0,0])),false,'Reject HTML disguised as '+mime);
assert.equal(valid('audio/mpeg',new Uint8Array([0,0,0])),false);
assert.equal(valid('video/mp4',new Uint8Array(samples[2][1])),false);
const index=load('src/index.ts'),uploads=load('src/uploads.ts');
assert.ok(index.includes("supportedAudioSignature(row.mime_type,bytes.subarray(0,16))"),'Direct audio uploads must check headers');
assert.ok(uploads.includes('supportedAudioSignature(media.mime_type,sample)'),'Multipart completion must check headers');
assert.ok(uploads.includes("status='rejected'"),'Invalid multipart upload must be rejected');
console.log('Account 2 audio signature, spoofed file, direct and multipart approval checks passed');
