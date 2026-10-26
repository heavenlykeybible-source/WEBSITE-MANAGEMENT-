import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const temp=new URL('./mcp-review-worker-fixture.mjs',import.meta.url);fs.writeFileSync(temp,fs.readFileSync('control-room-worker.js','utf8')+'\nexport {mcp,sha256};');
try{
 const {mcp,sha256}=await import(temp.href),db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('schema.sql','utf8'));
 const token='fixture-agent-token';db.prepare("INSERT INTO agents(id,name,token_hash,can_read,can_propose,status) VALUES(1,'First AI',?,1,1,'active')").run(await sha256(token));
 db.exec("INSERT INTO agents(id,name,token_hash,can_read,can_propose,status) VALUES(2,'Second AI','other',1,1,'active');INSERT INTO proposals(id,agent_id,kind,title,status) VALUES(1,1,'github','Reviewed change','waiting'),(2,2,'github','Private other work','waiting');");
 const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}};
 const call=(method,params={},session,auth=token)=>mcp(new Request('https://control.test/mcp',{method:'POST',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json',...(session?{'Mcp-Session-Id':session}:{})},body:JSON.stringify({jsonrpc:'2.0',id:7,method,params})}),{DB});
 const initialize=await call('initialize',{protocolVersion:'2025-11-25',capabilities:{elicitation:{url:{}}}}),session=initialize.headers.get('mcp-session-id');assert.match(session,/^[a-f0-9-]{36}$/);assert.equal((await initialize.json()).result.serverInfo.version,'2.1');
 const listed=await (await call('tools/list')).json();assert.ok(listed.result.tools.some(x=>x.name==='request_owner_review'));
 const review=await (await call('tools/call',{name:'request_owner_review',arguments:{proposal_id:1}},session)).json();assert.equal(review.error.code,-32042);const elicitation=review.error.data.elicitations[0];assert.equal(elicitation.mode,'url');assert.equal(elicitation.url,'https://control.test/?review_proposal=1');assert.ok(!elicitation.url.includes(token));
 assert.equal(db.prepare('SELECT status FROM proposals WHERE id=1').get().status,'waiting','Host prompt must not approve anything');
 const fallback=await (await call('tools/call',{name:'request_owner_review',arguments:{proposal_id:1}})).json();assert.equal(fallback.result.structuredContent.review_url,elicitation.url);
 for(const args of [{proposal_id:2},{proposal_id:'1'},{proposal_id:0}])assert.equal((await (await call('tools/call',{name:'request_owner_review',arguments:args},session)).json()).result.isError,true);
 db.prepare("UPDATE proposals SET status='approved' WHERE id=1").run();assert.equal((await (await call('tools/call',{name:'request_owner_review',arguments:{proposal_id:1}},session)).json()).result.structuredContent.status,'approved');
 db.prepare("UPDATE proposals SET status='rejected' WHERE id=1").run();assert.equal((await (await call('tools/call',{name:'request_owner_review',arguments:{proposal_id:1}},session)).json()).result.structuredContent.status,'rejected');
 db.prepare("UPDATE proposals SET status='waiting' WHERE id=1").run();db.prepare("UPDATE settings SET value_json=json_set(value_json,'$.expires',0) WHERE key=?").run('mcp:review-session:'+session);assert.ok((await (await call('tools/call',{name:'request_owner_review',arguments:{proposal_id:1}},session)).json()).result.structuredContent);
 db.prepare("UPDATE agents SET status='revoked' WHERE id=1").run();assert.equal((await call('tools/call',{name:'request_owner_review',arguments:{proposal_id:1}},session)).status,401);
 assert.ok(!fs.readFileSync('workspace/mcp-review.js','utf8').includes('proposals SET'));
 db.close();console.log('PASS MCP owner review: negotiated native URL elicitation, secure link fallback, exact-agent proposal scope, terminal-state retry, expired sessions, revoked agents and no automatic approval/publication.');
}finally{fs.unlinkSync(temp)}
