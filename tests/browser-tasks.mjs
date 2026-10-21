import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {browserServiceRoutes,proposeBrowserTask,startBrowserTask,readBrowserTask,reviewSnapshot,UI} from './worker-test.mjs';
const raw=new DatabaseSync(':memory:');raw.exec(fs.readFileSync('schema.sql','utf8'));raw.exec("INSERT INTO agents(id,name,token_hash) VALUES(1,'Browser agent','browser-test')");
const DB={prepare(sql){let args=[];const q=raw.prepare(sql);return {bind(...a){args=a;return this;},async first(){return q.get(...args)||null;},async all(){return {results:q.all(...args)};},async run(){const r=q.run(...args);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}};}};}},env={DB,VAULT_KEY:'test-browser-vault-key-123456789'},owner={id:1,role:'owner',kind:'staff',username:'owner'},actor={kind:'agent',agentId:1,a:{id:1,can_read:1,can_propose:1}};
let calls=[],failStart=false;const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{calls.push({url,init});assert.equal(init.redirect,'manual');assert.equal(init.headers['X-API-Key'],'private-test-api-key');if(url.endsWith('/v1/runs?limit=1'))return Response.json({data:[]});if(url.endsWith('/run-async')){if(failStart)throw Error('Connection lost');return Response.json({run_id:'job_123'});}return Response.json({run_id:'job_123',status:'COMPLETED',result:{title:'Website result'}});};
try{
 const req=()=>new Request('https://room',{method:'POST',body:JSON.stringify({api_key:'private-test-api-key',profile_id:'prof_test'})});
 await assert.rejects(browserServiceRoutes(req(),env,{...owner,role:'admin'},'browser-service','POST'),e=>e.status===403);
 await browserServiceRoutes(req(),env,owner,'browser-service','POST');assert.ok(!raw.prepare("SELECT value_json FROM settings WHERE key='browser:tinyfish'").get().value_json.includes('private-test-api-key'));
 const args={url:'https://example.com',goal:'Inspect this website and report its homepage title'};
 for(const url of ['http://example.com','https://localhost','https://127.0.0.1'])await assert.rejects(proposeBrowserTask(env,actor,{...args,url}));
 await assert.rejects(proposeBrowserTask(env,{...actor,a:{...actor.a,site_id:1}},args),e=>e.status===403);
 const before=calls.length,p=await proposeBrowserTask(env,actor,args);assert.equal(calls.length,before);assert.equal(p.status,'waiting');assert.equal(p.started,false);
 const P=raw.prepare('SELECT * FROM proposals WHERE id=?').get(p.proposal_id),snapshot=await reviewSnapshot(env,P);assert.match(snapshot.target,/browser-task:/);assert.match(snapshot.warnings.join(' '),/Approval starts an external browser/);
 const started=await startBrowserTask(env,P);assert.equal(started.status,'PENDING');const sent=JSON.parse(calls.at(-1).init.body);assert.equal(sent.profile_id,'prof_test');assert.equal(sent.goal,args.goal);assert.equal(sent.agent_config.max_duration_seconds,600);
 await assert.rejects(startBrowserTask(env,P),e=>e.status===409);const done=await readBrowserTask(env,actor,{proposal_id:p.proposal_id});assert.equal(done.status,'COMPLETED');assert.match(done.result,/Website result/);
 await assert.rejects(readBrowserTask(env,{...actor,agentId:9},{proposal_id:p.proposal_id}),e=>e.status===404);
 const p2=await proposeBrowserTask(env,actor,args),P2=raw.prepare('SELECT * FROM proposals WHERE id=?').get(p2.proposal_id);failStart=true;await assert.rejects(startBrowserTask(env,P2));const count=calls.length;await assert.rejects(startBrowserTask(env,P2),e=>e.status===409);assert.equal(calls.length,count);assert.equal((await readBrowserTask(env,actor,{proposal_id:p2.proposal_id})).status,'START_UNCERTAIN');
 assert.match(UI,/Connect and verify TinyFish/);console.log('PASS TinyFish: encrypted owner connection, no run before approval, exact reviewed goal/profile, async status, scoped access and uncertain-start replay blocked');
}finally{globalThis.fetch=original;raw.close();}
