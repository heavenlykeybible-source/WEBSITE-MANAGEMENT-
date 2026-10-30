import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const source=readFileSync(resolve(fileURLToPath(new URL('.',import.meta.url)),'../src/restream.ts'),'utf8');
const start=source.slice(source.indexOf('export async function startRestream'),source.indexOf('function egressStillActive'));
const reconcile=source.slice(source.indexOf('async function reconcileActive'),source.indexOf('export async function stopRestream'));
assert.ok(start.indexOf("callLiveKit(env,'StartEgress'") < start.indexOf("callLiveKit(env,'StopEgress'"),'Replacement must start before old broadcast stops');
assert.match(start,/const newEgressId=String\(result\.egress_id\?\?result\.egressId\?\?''\)/);
assert.match(reconcile,/if\(!item\)return \{active:/,'Unconfirmed provider response must preserve live state');
assert.doesNotMatch(source,/throw new Error\(data\?\.msg\|\|data\?\.message/,'Provider errors must not be passed through verbatim');
console.log('Account 2 broadcast handoff safety checks passed');
