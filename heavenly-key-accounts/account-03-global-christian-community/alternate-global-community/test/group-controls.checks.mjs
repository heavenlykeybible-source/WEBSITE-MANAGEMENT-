import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('..',import.meta.url));
test('Messaging and groups: privacy, retry safety, posting permissions and manager boundaries',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'group-controls-')),db=new DatabaseSync(':memory:');
 try{
 for(const file of readdirSync(path.join(base,'migrations')).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(path.join(base,'migrations',file),'utf8'));
 for(let id=1;id<=5;id++){db.prepare("INSERT INTO users(user_id,email,password_hash,password_salt) VALUES(?,?,?,?)").run(id,'group-test-'+id+'@example.invalid','unused','unused');db.prepare("INSERT INTO profiles(user_id,full_name,display_name) VALUES(?,?,?)").run(id,'Member '+id,'Member '+id);}
 const statement=(sql,params=[])=>({bind(...p){return statement(sql,p);},async first(){return db.prepare(sql).get(...params)||null;},async all(){return {results:db.prepare(sql).all(...params)};},async run(){const result=db.prepare(sql).run(...params);return {meta:{changes:Number(result.changes)}};}});
 const env={DB:{prepare:sql=>statement(sql)},SESSIONS:{},MEDIA:{}};
 const mod=stripTypeScriptTypes(readFileSync(path.join(base,'src/moderation.ts'),'utf8'));writeFileSync(path.join(dir,'moderation.mjs'),mod);writeFileSync(path.join(dir,'stewardship.mjs'),stripTypeScriptTypes(readFileSync(path.join(base,'src/stewardship.ts'),'utf8')));
 let src=stripTypeScriptTypes(readFileSync(path.join(base,'src/services.ts'),'utf8'));
 src=src.replace(/from ["']\.\/stewardship["']/,'from "./stewardship.mjs"');
 src=src.replace(/from "\.\/moderation(?:\.ts)?"/,'from "./moderation.mjs"').replace('from "../public/design-cards.js"','from '+JSON.stringify(pathToFileURL(path.join(base,'public/design-cards.js')).href));
 writeFileSync(path.join(dir,'services.mjs'),src);const S=await import(pathToFileURL(path.join(dir,'services.mjs')).href);
 const input={name:'Prayer fellowship',description:'Pray together',christianPurpose:'Christian prayer and fellowship together.',groupType:'prayer',visibility:'public',joinApproval:true,postingPolicy:'managers',rules:'Respect other members.'};
 const id=(await S.createGroup(env,1,input)).groupId;
 assert.equal((await S.groupDetail(env,null,id)).rules,input.rules);
 assert.equal((await S.joinGroup(env,2,id)).status,'pending');
 await assert.rejects(S.groupMembers(env,2,id),/Join this group/);
 await assert.rejects(S.decideGroupRequest(env,2,id,2,true),/manager access/);
 await S.decideGroupRequest(env,1,id,2,true);
 assert.equal((await S.groupMembers(env,2,id)).length,2);
 await assert.rejects(S.updateGroup(env,2,id,input),/administrator access/);
 await assert.rejects(S.createPost(env,{userId:2,role:'member'}, {groupId:id,postFormat:'article',title:'Fellowship announcement',body:'A Christian fellowship announcement.'}),/Join the Group/);
 await S.manageGroupMember(env,1,id,2,{action:'role',role:'moderator'});
 await S.createPost(env,{userId:2,role:'member'}, {groupId:id,postFormat:'article',title:'Fellowship announcement',body:'A Christian fellowship announcement.'});
 await assert.rejects(S.manageGroupMember(env,2,id,1,{action:'remove'}),/administrator access/);
 await S.updateGroup(env,1,id,{...input,visibility:'private'});
 await assert.rejects(S.updateGroup(env,1,id,input),/Privacy can only/);
 assert.equal((await S.joinGroup(env,3,id)).status,'pending');
 await S.decideGroupRequest(env,2,id,3,true);
 await S.manageGroupMember(env,1,id,3,{action:'role',role:'administrator'});
 await assert.rejects(S.manageGroupMember(env,3,id,2,{action:'remove'}),/Only the owner/);
 await assert.rejects(S.manageGroupMember(env,3,id,1,{action:'remove'}),/group owner/);
 await assert.rejects(S.manageGroupMember(env,3,id,3,{action:'role',role:'owner'}),/own role/);
 await S.manageGroupMember(env,1,id,2,{action:'remove'});
 assert.equal((await S.joinGroup(env,2,id)).status,'rejected');
 await assert.rejects(S.groupMembers(env,2,id),/Join this group/);
 await assert.rejects(S.createPost(env,{userId:2,role:'member'}, {groupId:id,postFormat:'article',title:'Fellowship announcement',body:'A Christian fellowship announcement.'}),/Join the Group/);
 await assert.rejects(S.leaveGroup(env,1,id),/owner must remain/);
 await S.leaveGroup(env,3,id);assert.equal((await S.groupDetail(env,3,id)).joined,0);

 // Messaging must enforce consent, participant scope and live safety boundaries.
 db.exec("UPDATE profiles SET messaging_visibility='everyone' WHERE user_id IN (4,5)");
 const [request1,request2]=await Promise.all([S.requestConversation(env,4,5),S.requestConversation(env,4,5)]);assert.equal(request1.conversation_id,request2.conversation_id);const chat=request1.conversation_id;assert.equal(db.prepare('SELECT COUNT(*) total FROM conversations').get().total,1);
 await assert.rejects(S.messages(env,4,chat),/unavailable/);
 await assert.rejects(S.sendMessage(env,4,chat,'Before approval'),/unavailable/);
 await assert.rejects(S.decideConversation(env,4,chat,true),/Only the recipient/);
 await S.decideConversation(env,5,chat,true);
 await assert.rejects(S.messages(env,1,chat),/unavailable/);
 await assert.rejects(S.sendMessage(env,1,chat,'Outside sender'),/unavailable/);
 await assert.rejects(S.sendMessage(env,4,chat,'x'.repeat(3001)),/3000/);
 const key=crypto.randomUUID(),body='A thoughtful message in Christian fellowship.';
 const first=await S.sendMessage(env,4,chat,body,key),second=await S.sendMessage(env,4,chat,body,key);
 assert.equal(first.messageId,second.messageId);
 await assert.rejects(S.sendMessage(env,4,chat,'Different message',key),/different message/);
 const held=await S.sendMessage(env,4,chat,'You are stupid',crypto.randomUUID());assert.equal(held.status,'held');
 assert.ok(!(await S.messages(env,5,chat)).some(m=>m.message_id===held.messageId));
 // If the message was saved but notification failed, retry must not duplicate it.
 let notificationFailed=false;
 const failing={...env,DB:{prepare(sql){if(sql.startsWith('INSERT INTO notifications')&&!notificationFailed){notificationFailed=true;return {bind(){return {async run(){throw new Error('Simulated notification failure');}};}};}return statement(sql);}}};
 const retryKey=crypto.randomUUID();
 await assert.rejects(S.sendMessage(failing,4,chat,'Retry after a lost response.',retryKey),/Simulated/);
 await S.sendMessage(env,4,chat,'Retry after a lost response.',retryKey);
 assert.equal(db.prepare("SELECT COUNT(*) total FROM messages WHERE client_request_id=?").get(retryKey).total,1);
 // A direct block must take effect even if a conversation status is stale.
 db.prepare("INSERT INTO user_blocks(blocker_user_id,blocked_user_id) VALUES(?,?)").run(5,4);
 await assert.rejects(S.messages(env,4,chat),/unavailable/);
 await assert.rejects(S.sendMessage(env,4,chat,body,crypto.randomUUID()),/unavailable/);
 assert.equal((await S.inbox(env,4)).length,0);
 db.prepare("DELETE FROM user_blocks WHERE blocker_user_id=5 AND blocked_user_id=4").run();
 db.exec("UPDATE users SET status='suspended' WHERE user_id=5");
 await assert.rejects(S.messages(env,4,chat),/unavailable/);
 await assert.rejects(S.sendMessage(env,4,chat,body,crypto.randomUUID()),/unavailable/);
 assert.equal((await S.inbox(env,4)).length,0);
 db.exec("UPDATE users SET status='active' WHERE user_id=5");


 const noticeId=Number(db.prepare("INSERT INTO notifications(user_id,kind,title,body,href) VALUES(1,'message','New message','Hello','/messages.html?conversation=1')").run().lastInsertRowid);
 assert.equal(await S.unreadNotificationCount(env,1),1);
 await S.readNotifications(env,2,[noticeId]);assert.equal(await S.unreadNotificationCount(env,1),1);
 await assert.rejects(S.readNotifications(env,1,['invalid']),/valid notifications/);
 await assert.rejects(S.readNotifications(env,1,Array(101).fill(noticeId)),/valid notifications/);
 await S.readNotifications(env,1,[noticeId,noticeId]);assert.equal(await S.unreadNotificationCount(env,1),0);
 await S.readNotifications(env,1,[]);assert.equal(await S.unreadNotificationCount(env,1),0);
 const hidden=(await S.createGroup(env,1,{...input,name:'Hidden prayer',visibility:'hidden'})).groupId;
 await assert.rejects(S.groupDetail(env,4,hidden),/unavailable/);
 assert.ok(!(await S.listGroups(env,4)).some(g=>g.group_id===hidden));
 await assert.rejects(S.joinGroup(env,4,hidden),/not found/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

