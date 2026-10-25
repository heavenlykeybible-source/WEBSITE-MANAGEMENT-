import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseCurrentRelease,consolidateAccount9Releases,supersededAccount9Ids,projectAccount9Queue,upsertAccount9Release} from './account9-release-policy.mjs';

const rows=[
 {id:27,account:'account-09',version:'v4',created_at:'2026-10-25T09:00:00Z',worker:'heavenlykey-studio'},
 {id:28,account:'Account 9',version:'v5',created_at:'2026-10-25T10:00:00Z',worker:'heavenlykey-studio'},
 {id:29,account:'account8',version:'v2',worker:'meeting-space'}
];
assert.equal(chooseCurrentRelease(rows)?.id,28,'Latest version replaces previous release');
assert.equal(chooseCurrentRelease([{id:3,account:'account9',version:'v9'},{id:4,account:'account9',version:'v10'}])?.id,4,'v10 supersedes v9');
assert.equal(chooseCurrentRelease([{id:3,account:'account9',version:'v5.9'},{id:4,account:'account9',version:'v5.10'}])?.id,4,'v5.10 supersedes v5.9');

assert.deepEqual(supersededAccount9Ids(rows),[27],'Old Account 9 release is superseded');
const controlRoomRows=[
 {id:27,kind:'worker',name:'heavenlykey-studio',connection:8,version:'v4'},
 {id:28,kind:'worker',name:'heavenlykey-studio',connection:'8',version:'v5'},
 {id:30,kind:'worker',name:'heavenlykey-studio',connection:4,version:'v1'},
 {id:31,account_name:'Account 09',worker:'heavenlykey-studio',version:'v2'}
];
const roomQueue=projectAccount9Queue(controlRoomRows);
assert.equal(roomQueue.active.filter(x=>x.name==='heavenlykey-studio'&&String(x.connection)==='8').length,1,'Control Room connection 8 must have one active Worker proposal');
assert.deepEqual(roomQueue.history.map(x=>x.id).sort((a,b)=>a-b),[27,31],'Previous target proposals must be superseded');
assert.ok(roomQueue.active.some(x=>x.id===30),'Identical Worker names on a different account stay untouched');
const mismatched=[
  {id:81,account:'account9',worker:'meeting-space',connection:8,version:'v9'},
  {id:82,account:'account9',worker:'heavenlykey-studio',connection:4,version:'v10'},
  {id:83,account:'account9',worker:'heavenlykey-studio',connection:8,version:'v5'}
];
const protectedQueue=projectAccount9Queue(mismatched);
assert.deepEqual(protectedQueue.active.map(x=>x.id),[81,82,83],'Never swallow different Workers or Cloudflare accounts because of a mistaken label');
assert.equal(protectedQueue.history.length,0,'No unrelated deployments are superseded');


const consolidated=consolidateAccount9Releases(rows);
assert.equal(consolidated.length,2,'Single Account 9 release remains');
const queue=projectAccount9Queue(rows);
assert.equal(queue.active.length,2,'Queue shows one current Account 9 and preserves another account');
assert.equal(queue.active.filter(item=>item.worker==='heavenlykey-studio').length,1,'Only one Account 9 is actionable');
assert.equal(queue.history.length,1,'Previous release retained in history');
assert.equal(queue.history[0].status,'superseded','Older release cannot be deployed as active');
assert.equal(queue.history[0].superseded_by,28,'Audit history points to the current release');
const v6={id:30,account:'account9',version:'v6',created_at:'2026-10-25T12:00:00Z',worker:'heavenlykey-studio'};
const upgraded=upsertAccount9Release(queue,v6);
assert.equal(upgraded.active.filter(is=>is.worker==='heavenlykey-studio').length,1,'New upload replaces old Account 9 slot');
assert.equal(upgraded.active.find(is=>is.account==='account9').id,30,'Version 6 supersedes Version 5');
assert.equal(upgraded.history.length,2,'Old versions are retained only in release history');
assert.equal(upsertAccount9Release(upgraded,v6).history.length,2,'Retrying same release does not duplicate history');
const stale=upsertAccount9Release(upgraded,{id:31,account:'account9',version:'v4'});
assert.equal(stale.active.find(is=>is.account==='account9').id,30,'Older upload cannot downgrade active release');

assert.equal(rows[0].status,undefined,'Original proposal rows stay untouched');
const canceledLatest=[
  {id:40,account:'account9',version:'v5',status:'waiting',worker:'heavenlykey-studio'},
  {id:41,account:'account9',version:'v6',status:'cancelled',worker:'heavenlykey-studio'},
  {id:42,account:'account9',version:'v7',status:'failed',worker:'heavenlykey-studio'},
  {id:43,account:'account8',version:'v1',status:'waiting',worker:'meeting-space'}
];
const safeQueue=projectAccount9Queue(canceledLatest);
assert.deepEqual(safeQueue.active.map(x=>x.id),[40,43],'Failed latest release must not displace last actionable version');
assert.equal(safeQueue.history.length,2,'Closed releases stay visible in history');
assert.equal(safeQueue.history[0].status,'cancelled','Existing cancellation reason is preserved');
assert.equal(safeQueue.history[1].status,'failed','Existing failure reason is preserved');
assert.deepEqual(projectAccount9Queue([]),{active:[],history:[],canonical_account:null},'Empty queue handled');
assert.deepEqual(consolidateAccount9Releases(consolidated),consolidated,'Deduplication is idempotent');


assert.equal(consolidated.filter(x=>x.account==='account9').length,1,'One canonical Account 9');
assert.ok(consolidated.some(x=>x.id===29),'Unrelated accounts remain unchanged');
assert.equal(consolidated.find(x=>x.id===28).worker,'heavenlykey-studio','Worker target is preserved');
assert.equal(rows[0].account,'account-09','Input rows are not mutated');
const manifest=JSON.parse(readFileSync('release-packages/account9-active-release.json','utf8'));
assert.equal(manifest.account,'account9');
assert.equal(manifest.worker,'heavenlykey-studio');
assert.equal(manifest.max_active_deployments,1);
assert.equal(manifest.strategy,'replace-in-place');
assert.ok(manifest.supersedes_proposals.includes(27));
console.log('PASS Account 9 releases replace in place, latest version wins, unrelated accounts preserved');
