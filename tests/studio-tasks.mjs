import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const fixture=new URL('./studio-tasks-fixture.mjs',import.meta.url);
fs.writeFileSync(fixture,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {studioTaskRoutes,studioAITask,studioTaskInput};');
try{
 const {studioTaskRoutes,studioAITask,studioTaskInput}=await import(fixture.href);
 const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));
 raw.exec("INSERT INTO users(id,username,role,kind,status)VALUES(1,'owner','owner','staff','active'),(2,'admin','admin','staff','active');INSERT INTO cf_connections(id,label,account_id,token_enc)VALUES(4,'Account 4','account-four','secret');INSERT INTO agents(id,name,token_hash,status,can_read,can_propose)VALUES(1,'AI One','one','active',1,1),(2,'AI Two','two','active',1,1),(3,'AI Three','three','active',1,1);");
 const prepared=(sql)=>{let args=[];return {bind(...v){args=v;return this},async first(){return raw.prepare(sql).get(...args)||null},async all(){return {results:raw.prepare(sql).all(...args)}},async run(){const x=raw.prepare(sql).run(...args);return {meta:{changes:x.changes,last_row_id:x.lastInsertRowid}}},syncRun(){return raw.prepare(sql).run(...args)}}};
 const DB={prepare:prepared,async batch(stmts){raw.exec('BEGIN IMMEDIATE');try{const results=stmts.map(x=>x.syncRun());raw.exec('COMMIT');return results;}catch(e){raw.exec('ROLLBACK');throw e}}};
 const env={DB},owner={id:1,username:'owner',role:'owner',kind:'staff'};
 async function endpoint(sub,method,b,user=owner){
  const u=new URL('https://room.test/api/owner/'+sub);
  const req=new Request(u,{method,body:b?JSON.stringify(b):undefined});
  const r=await studioTaskRoutes(req,env,user,sub,method);return r.json();
 }
 for(const invalid of [
  {connection:0,worker:'one',instruction:'x',agents:[1]},
  {connection:4,worker:'../../bad',instruction:'x',agents:[1]},
  {connection:4,worker:'one',instruction:'',agents:[1]},
  {connection:4,worker:'one',instruction:'x',agents:[1,1]},
  {connection:4,worker:'one',instruction:'x',agents:Array.from({length:26},(_,i)=>i+1)}
 ])assert.throws(()=>studioTaskInput(invalid));
 const first=await endpoint('studio/tasks','POST',{connection:4,worker:'social-network',instruction:'Fix navigation',agents:[1,2,3]});
 assert.equal(first.assigned,3);assert.equal(first.tasks.length,3);assert.equal(new Set(first.tasks.map(x=>x.id)).size,3);
 const second=await endpoint('studio/tasks','POST',{connection:4,worker:'social-network',instruction:'Improve accessibility',agents:[1,2,3]});
 assert.equal(second.assigned,3,'No global cap on independently assigned tasks');
 const list=await endpoint('studio/tasks','GET');assert.equal(list.tasks.length,6);
 await assert.rejects(endpoint('studio/tasks','POST',{connection:4,worker:'social-network',instruction:'Test',agents:[99]}),e=>e.status===403);
 await assert.rejects(endpoint('studio/tasks','GET',null,{id:2,role:'admin',kind:'staff'}),e=>e.status===403);
 raw.prepare('INSERT INTO settings(key,value_json)VALUES(?,?)').run('ai:permissions:1',JSON.stringify({mode:'work',connections:[4],expires_at:Date.now()+3600000,all_agents:true,max_tools:12}));
 const grant={mode:'work',connections:[4],expires_at:Date.now()+3600000};
 const a1={agentId:1,a:{id:1,can_read:1,can_propose:1},aiPolicy:grant};
 const a2={agentId:2,a:{id:2,can_read:1,can_propose:1},aiPolicy:grant};
 await assert.rejects(studioAITask(env,a2,'claim_studio_assignment',{task_id:first.tasks[0].id}),e=>e.status===403);
 await assert.rejects(studioAITask(env,a1,'update_studio_progress',{task_id:first.tasks[0].id,progress:'Ready'}),e=>e.status===409);
 const claimed=await studioAITask(env,a1,'claim_studio_assignment',{task_id:first.tasks[0].id});
 assert.equal(claimed.status,'working');
 assert.equal((await studioAITask(env,a1,'claim_studio_assignment',{task_id:first.tasks[0].id})).status,'working');
 const progress=await studioAITask(env,a1,'update_studio_progress',{task_id:first.tasks[0].id,progress:'Source inspection 60% complete'});
 assert.equal(progress.progress,'Source inspection 60% complete');
 await assert.rejects(studioAITask(env,a1,'update_studio_progress',{task_id:first.tasks[0].id,progress:''}),e=>e.status===400);
 await assert.rejects(studioAITask(env,a2,'update_studio_progress',{task_id:first.tasks[0].id,progress:'Unauthorized'}),e=>e.status===403);
 assert.equal((await studioAITask(env,a1,'my_studio_assignments',{})).tasks.length,2);
 assert.equal((await studioAITask(env,a2,'my_studio_assignments',{})).tasks.length,2);
 await assert.rejects(studioAITask(env,a2,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:1}),e=>e.status===403);
 raw.exec("INSERT INTO proposals(id,agent_id,kind,title,note,new_content_json,status,sealed) VALUES (100,1,'worker','Fix','', '{\"connection_id\":4,\"name\":\"social-network\"}','waiting',1), (101,2,'worker','Wrong owner','', '{\"connection_id\":4,\"name\":\"social-network\"}','waiting',1), (102,1,'worker','Wrong target','', '{\"connection_id\":4,\"name\":\"other-worker\"}','waiting',1)");
 await assert.rejects(studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:101}),e=>e.status===403);
 await assert.rejects(studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:102}),e=>e.status===409);
 await assert.rejects(studioAITask(env,{...a1,aiPolicy:{...grant,expires_at:Date.now()-1000}},'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 await assert.rejects(studioAITask(env,{...a1,aiPolicy:{...grant,connections:[7]}},'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 await assert.rejects(studioAITask(env,{...a1,aiPolicy:{...grant,mode:'read'}},'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 const sharedRow=raw.prepare("SELECT value_json FROM settings WHERE key='ai:permissions:1'").get();
 raw.prepare("UPDATE settings SET value_json=? WHERE key='ai:permissions:1'").run(JSON.stringify({...JSON.parse(sharedRow.value_json),all_agents:false}));
 await assert.rejects(studioAITask(env,{...a1,aiPolicy:undefined},'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 raw.prepare("UPDATE settings SET value_json=? WHERE key='ai:permissions:1'").run(sharedRow.value_json);
 const policyRow=raw.prepare("SELECT value_json FROM settings WHERE key='ai:permissions:1'").get();
 raw.prepare("UPDATE settings SET value_json=? WHERE key='ai:permissions:1'").run(JSON.stringify({...JSON.parse(policyRow.value_json),mode:'chat',connections:[]}));
 await assert.rejects(studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 raw.prepare("UPDATE settings SET value_json=? WHERE key='ai:permissions:1'").run(policyRow.value_json);
 raw.prepare("UPDATE agents SET status='revoked' WHERE id=1").run();
 await assert.rejects(studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 raw.prepare("UPDATE agents SET status='active',can_propose=0 WHERE id=1").run();
 await assert.rejects(studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 raw.prepare("UPDATE agents SET can_propose=1 WHERE id=1").run();
 const submitted=await studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100});
 assert.equal(submitted.status,'submitted');assert.equal(submitted.proposal_id,100);
 await assert.rejects(studioAITask(env,a1,'submit_studio_assignment',{task_id:first.tasks[0].id,proposal_id:100}),e=>e.status===403);
 assert.equal((await studioAITask(env,a1,'my_studio_assignments',{})).tasks.length,1);
 const reported=await endpoint('studio/tasks','GET');
 assert.equal(reported.tasks.find(t=>t.id===first.tasks[0].id).progress,'Source inspection 60% complete');
 assert.equal((await endpoint('studio/tasks/'+first.tasks[1].id+'/cancel','POST')).status,'cancelled');
 assert.equal((await studioAITask(env,a2,'my_studio_assignments',{})).tasks.length,1);
 // More than 100 assignments must not disappear behind a global database limit.
 for(let i=0;i<51;i++)await endpoint('studio/tasks','POST',{connection:4,worker:'social-network',instruction:'Independent task batch '+i,agents:[1,2,3]});
 const ownerPage0=await endpoint('studio/tasks','GET');
 assert.equal(ownerPage0.tasks.length,50);assert.equal(ownerPage0.next_page,1);
 const ownPage1Response=await studioTaskRoutes(new Request('https://room.test/api/owner/studio/tasks?page=1'),env,owner,'studio/tasks','GET');
 const ownerPage1=await ownPage1Response.json();
 assert.equal(ownerPage1.tasks.length,50);assert.equal(ownerPage1.next_page,2);
 const aiPage0=await studioAITask(env,a1,'my_studio_assignments',{page:0});
 assert.equal(aiPage0.tasks.length,50);assert.equal(aiPage0.next_page,1);
 const aiPage1=await studioAITask(env,a1,'my_studio_assignments',{page:1});
 assert.ok(aiPage1.tasks.length>0);assert.equal(aiPage1.next_page,null);
 assert.ok(aiPage0.tasks.every(t=>t.agent===1&&t.status==='assigned'));
 assert.ok(aiPage1.tasks.every(t=>t.agent===1&&t.status==='assigned'));
 await assert.rejects(studioAITask(env,a1,'my_studio_assignments',{page:-1}),e=>e.status===400);
 raw.close();
 console.log('PASS Multi AI Studio: independent simultaneous assignments, unlimited queued batches, isolation, unauthorized account rejection, Waiting-only submission and cancellation');
}finally{fs.unlinkSync(fixture);}
