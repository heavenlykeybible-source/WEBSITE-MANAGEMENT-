import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const db=new DatabaseSync(':memory:');
for(const migration of ['0006_restream_operation_lock.sql','0007_restream_active_state.sql']){
 db.exec(readFileSync(resolve(root,'migrations',migration),'utf8'));
}
const acquire=db.prepare("INSERT INTO restream_operation_lock (lock_name,owner,expires_at) VALUES ('social-distribution',?,unixepoch()+180) ON CONFLICT(lock_name) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE restream_operation_lock.expires_at <= unixepoch()");
const release=db.prepare("DELETE FROM restream_operation_lock WHERE lock_name='social-distribution' AND owner=?");
assert.equal(acquire.run('owner-a').changes,1,'First operator must acquire the lock');
assert.equal(acquire.run('owner-b').changes,0,'Concurrent operator must be rejected');
assert.equal(release.run('owner-b').changes,0,'Other operator cannot release the lock');
assert.equal(acquire.run('owner-b').changes,0,'Lock must survive an unauthorized release');
assert.equal(release.run('owner-a').changes,1,'Owner must release the lock');
assert.equal(acquire.run('owner-b').changes,1,'Released lock must be reusable');
db.prepare("UPDATE restream_operation_lock SET expires_at=unixepoch()-1").run();
assert.equal(acquire.run('owner-c').changes,1,'Expired lock must be recoverable');
assert.equal(release.run('owner-b').changes,0,'Expired owner cannot release new lock');

const insert=db.prepare("INSERT INTO restream_active_state (state_key,payload,updated_at) VALUES ('active',?,unixepoch()) ON CONFLICT(state_key) DO NOTHING");
const update=db.prepare("INSERT INTO restream_active_state (state_key,payload,updated_at) VALUES ('active',?,unixepoch()) ON CONFLICT(state_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at");
const get=()=>JSON.parse(db.prepare("SELECT payload FROM restream_active_state WHERE state_key='active'").get().payload);
assert.equal(insert.run(JSON.stringify({egressId:'legacy'})).changes,1,'Legacy state must be adopted once');
assert.equal(insert.run(JSON.stringify({egressId:'stale'})).changes,0,'Legacy state must not replace newer D1 state');
assert.equal(get().egressId,'legacy');
update.run(JSON.stringify({egressId:'replacement'}));
assert.equal(get().egressId,'replacement','Replacement must be authoritative');
update.run('null');
assert.equal(get(),null,'Tombstone must prevent legacy resurrection');
assert.equal(insert.run(JSON.stringify({egressId:'legacy'})).changes,0,'Legacy record cannot overwrite tombstone');
assert.equal(get(),null);
db.close();
console.log('Account 2 D1 locking, state adoption and tombstone tests passed');
