import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseHistory} from 'file:///tmp/account4-release-history.mjs';
const sha=n=>n.toString(16).padStart(40,'0');
const good=(n,time,prefix='Account 1 approved release · ')=>({status:'completed',conclusion:'success',display_title:prefix+sha(n),updated_at:'2026-10-0'+time+'T12:00:00Z',html_url:'https://github.com/example/actions/'+n});
const history=(prod,restore=[])=>releaseHistory(prod,restore,'Account 1 approved release · ','Account 1 emergency restore · ');
test('up to five previous successful and unique versions; date and url retained',()=>{
 const p=[...Array(9)].map((_,i)=>good(9-i,9-i));
 const r=history([...p,p[2],{...good(55,9),conclusion:'failure'}]);
 assert.equal(r.liveRelease.sha,sha(9));
 assert.equal(r.liveRelease.completedAt,'2026-10-09T12:00:00Z');
 assert.deepEqual(r.previous.map(x=>x.sha),[8,7,6,5,4].map(sha));
 assert.equal(r.previous.length,5);
});
test('most recent successful rollback becomes currently recorded release',()=>{
 const p=[good(3,3),good(2,2),good(1,1)];
 const restored={...good(2,9,'Account 1 emergency restore · ')};
 const r=history(p,[restored]);
 assert.equal(r.liveRelease.sha,sha(2));
 assert.equal(r.liveRelease.source,'restore');
 assert.deepEqual(r.previous.map(x=>x.sha),[sha(3),sha(1)]);
});
test('do not count failed, unknown or duplicated records as restorable',()=>{
 const p=[good(4,4),{...good(3,3),status:'queued'},good(2,2)];
 const r=history(p,[good(123,9,'Account 1 emergency restore · ')]);
 assert.deepEqual(r.previous.map(x=>x.sha),[sha(2)]);
 assert.equal(r.liveRelease.sha,sha(4));
});
