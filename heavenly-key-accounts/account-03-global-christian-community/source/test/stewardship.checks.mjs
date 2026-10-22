import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('..',import.meta.url));
test('Dual report routing, separate group review, flag decisions and administrator account locks',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'stewardship-')),db=new DatabaseSync(':memory:');
 try{
 for(const f of readdirSync(path.join(base,'migrations')).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(path.join(base,'migrations',f),'utf8'));
 for(let id=1;id<=6;id++){db.prepare('INSERT INTO users(user_id,email,password_hash,password_salt,role) VALUES(?,?,?,?,?)').run(id,id+'@example.invalid','unused','unused',id===5?'administrator':id===6?'moderator':'member');db.prepare('INSERT INTO profiles(user_id,full_name,display_name) VALUES(?,?,?)').run(id,'Member '+id,'Member '+id);}
 const stmt=(sql,p=[])=>({bind(...params){return stmt(sql,params);},async first(){return db.prepare(sql).get(...p)||null;},async all(){return {results:db.prepare(sql).all(...p)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...p).changes)}};}});
 const env={COMMUNITY_BLOCKED_WORDS:'forbiddenword;bad phrase',DB:{prepare:sql=>stmt(sql),async batch(queries){db.exec('BEGIN');try{const results=[];for(const q of queries)results.push(await q.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}}};
 for(const name of ['stewardship','moderation','auth'])writeFileSync(path.join(dir,name+'.mjs'),stripTypeScriptTypes(readFileSync(path.join(base,'src',name+'.ts'),'utf8')));
 let src=stripTypeScriptTypes(readFileSync(path.join(base,'src/services.ts'),'utf8')).replace(/from "\.\/moderation"/,'from "./moderation.mjs"').replace(/from "\.\/stewardship"/,'from "./stewardship.mjs"').replace('from "../public/design-cards.js"','from '+JSON.stringify(pathToFileURL(path.join(base,'public/design-cards.js')).href));writeFileSync(path.join(dir,'services.mjs'),src);
 const H=await import(pathToFileURL(path.join(dir,'stewardship.mjs'))),M=await import(pathToFileURL(path.join(dir,'moderation.mjs'))),S=await import(pathToFileURL(path.join(dir,'services.mjs'))),A=await import(pathToFileURL(path.join(dir,'auth.mjs')));
 const user=id=>({userId:id,role:id===5?'administrator':id===6?'moderator':'member',status:'active'});
 const group=(await S.createGroup(env,1,{name:'Faith fellowship',christianPurpose:'We grow together in Christ.',groupType:'fellowship',visibility:'public',postingPolicy:'members'})).groupId;
 await S.joinGroup(env,2,group);
 await assert.rejects(S.createPost(env,user(2),{postFormat:'article',title:'Filter test',body:'F.o.r.b.i.d.d.e.n.w.o.r.d'}),/cannot be published/);
 const post=(await S.createPost(env,user(2),{groupId:group,postFormat:'article',title:'Our faith',body:'Christ gives us hope.'})).postId;
 await assert.rejects(S.addComment(env,2,post,'bad---phrase'),/cannot be published/);
 const filterConversation=Number(db.prepare("INSERT INTO conversations(requester_user_id,recipient_user_id,status) VALUES(1,2,'accepted') RETURNING conversation_id").get().conversation_id);
 await assert.rejects(S.sendMessage(env,1,filterConversation,'F.o.r.b.i.d.d.e.n.w.o.r.d'),/blocked/);
 assert.equal((await S.reportContent(env,2,{targetType:'post',targetId:post,reason:'other'})).routing,'group_and_site');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id IN (1,5,6) AND kind IN ('group_report','safety_report')").get().n,3);
 await S.reportContent(env,2,{targetType:'post',targetId:post,reason:'other'});assert.equal(db.prepare('SELECT COUNT(*) n FROM content_reports').get().n,1);
 await assert.rejects(H.groupReports(env,user(3),group),/manager access/);
 const report=(await H.groupReports(env,user(1),group))[0];assert.equal(report.target_body,'Christ gives us hope.');assert.equal(report.reporter_user_id,undefined);
 await assert.rejects(H.reviewGroupReport(env,user(1),group+1,report.report_id,{action:'remove',note:'Reviewed carefully.'}),/manager access/);
 await H.reviewGroupReport(env,user(1),group,report.report_id,{action:'remove',note:'This content breaks our group rules.'});
 assert.equal(db.prepare('SELECT status FROM posts WHERE post_id=?').get(post).status,'removed');assert.equal(db.prepare('SELECT status,group_review_status FROM content_reports').get().status,'pending');assert.equal((await S.reportQueue(env)).length,1);
 await assert.rejects(H.reviewGroupReport(env,user(1),group,report.report_id,{action:'dismiss',note:'Another decision.'}),/unavailable/);
 await S.reviewPostReport(env,user(5),report.report_id,{action:'dismiss',note:'Reviewed the group decision.'});
 const racePost=(await S.createPost(env,user(2),{groupId:group,postFormat:'article',title:'Concurrent review',body:'Our Christian fellowship.'})).postId;
 await S.reportContent(env,2,{targetType:'post',targetId:racePost,reason:'other'});const raceReport=(await H.groupReports(env,user(1),group))[0];
 const originalBatch=env.DB.batch;env.DB.batch=async queries=>{db.prepare("UPDATE content_reports SET status='dismissed' WHERE report_id=?").run(raceReport.report_id);return originalBatch(queries);};
 await H.reviewGroupReport(env,user(1),group,raceReport.report_id,{action:'remove',note:'A concurrent group review.'});env.DB.batch=originalBatch;
 assert.equal(db.prepare('SELECT status FROM posts WHERE post_id=?').get(racePost).status,'active');
 const held=(await S.createPost(env,user(2),{postFormat:'article',title:'A testimony',body:'Christ helped me overcome pornography addiction.'})).postId;
 assert.equal(db.prepare('SELECT status FROM posts WHERE post_id=?').get(held).status,'held');
 const flag=(await H.flagQueue(env,user(6)))[0];await assert.rejects(H.reviewFlag(env,user(3),flag.moderation_event_id,{action:'approve',note:'A genuine testimony.'}),/moderator/);
 await H.reviewFlag(env,user(6),flag.moderation_event_id,{action:'approve',note:'A testimony about recovery, without explicit content.'});assert.equal(db.prepare('SELECT status FROM posts WHERE post_id=?').get(held).status,'active');
 assert.equal(M.moderateText('Jesus gives us hope.','post').decision,'allow');assert.equal(M.moderateText('Join Islam and debate Christianity','post').decision,'hold');assert.equal(M.moderateText('watch porn video','post').decision,'block');
 assert.equal(M.moderateText('FORBIDDENWORD','post','forbiddenword').category,'unapproved_word');
 assert.equal(M.moderateText('bad---phrase','message','bad phrase').decision,'block');
 assert.equal(M.moderateText('notforbiddenwordinside','post','forbiddenword').decision,'allow');assert.equal(db.prepare('SELECT status FROM users WHERE user_id=2').get().status,'active');
 await assert.rejects(H.restrictAccount(env,user(6),2,{action:'lock',note:'Repeated confirmed violations.'}),/Only a site administrator/);
 await assert.rejects(H.restrictAccount(env,user(5),6,{action:'lock',note:'Lock a staff account.'}),/Staff accounts/);
 await H.restrictAccount(env,user(5),2,{action:'lock',note:'Repeated confirmed community violations.'});assert.equal(db.prepare('SELECT status FROM users WHERE user_id=2').get().status,'restricted');
 const cookie='a'.repeat(64);env.SESSIONS={get:async()=>JSON.stringify(user(2))};assert.equal((await A.getSession(new Request('https://example.invalid',{headers:{Cookie:'gc_session='+cookie}}),env)).status,'restricted');
 assert.equal(await A.requireRole(new Request('https://example.invalid',{headers:{Cookie:'gc_session='+cookie}}),env,'member'),null);
 await H.restrictAccount(env,user(5),2,{action:'unlock',note:'Reviewed appeal and restored access.'});assert.equal(db.prepare('SELECT status FROM users WHERE user_id=2').get().status,'active');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM safety_audit WHERE action IN ('account_lock','account_unlock')").get().n,2);
 const restored=db.prepare("SELECT title,body FROM notifications WHERE user_id=2 AND kind='account_review_update' AND href LIKE '/safety.html#review-account-%'").get();assert.equal(restored.title,'Your account has been reactivated');assert.match(restored.body,/We are pleased to inform you/);assert.match(restored.body,/Together we take Christ to the nations of the world/);
 await assert.rejects(H.restrictAccount(env,user(5),2,{action:'unlock',note:'Retrying the same completed review.'}),/Active account lock unavailable/);assert.equal(db.prepare("SELECT COUNT(*) n FROM notifications WHERE user_id=2 AND kind='account_review_update' AND href LIKE '/safety.html#review-account-%'").get().n,1);

 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

