import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chooseCurrentRelease,consolidateAccount9Releases,supersededAccount9Ids} from './account9-release-policy.mjs';

const rows=[
 {id:27,account:'account-09',version:'v4',created_at:'2026-10-25T09:00:00Z',worker:'heavenlykey-studio'},
 {id:28,account:'Account 9',version:'v5',created_at:'2026-10-25T10:00:00Z',worker:'heavenlykey-studio'},
 {id:29,account:'account8',version:'v2',worker:'meeting-space'}
];
assert.equal(chooseCurrentRelease(rows)?.id,28,'Latest version replaces previous release');
assert.deepEqual(supersededAccount9Ids(rows),[27],'Old Account 9 release is superseded');
const consolidated=consolidateAccount9Releases(rows);
assert.equal(consolidated.length,2,'Single Account 9 release remains');
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
