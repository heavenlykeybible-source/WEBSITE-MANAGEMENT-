import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url)),cli=cwd+'node_modules/wrangler/bin/wrangler.js',environment={...process.env},directory=mkdtempSync(tmpdir()+'/network-audit-'),config=directory+'/wrangler.toml';
delete environment.CLOUDFLARE_API_TOKEN;delete environment.CLOUDFLARE_ACCOUNT_ID;
writeFileSync(config,`name="network-audit"\nmain="${cwd}src/index.ts"\ncompatibility_date="2025-01-01"\n[assets]\ndirectory="${cwd}public"\nrun_worker_first=["/api/*"]\n[[d1_databases]]\nbinding="DB"\ndatabase_name="network-audit-db"\ndatabase_id="00000000-0000-0000-0000-000000000007"\nmigrations_dir="${cwd}migrations"\n[[kv_namespaces]]\nbinding="SESSIONS"\nid="00000000000000000000000000000007"\n[[r2_buckets]]\nbinding="MEDIA"\nbucket_name="network-audit-local-only"\n[vars]\nPASSWORD_PEPPER="disposable-test-only-pepper"\n`);
const migrated=spawnSync(process.execPath,[cli,'d1','migrations','apply','network-audit-db','--local','--config',config,'--persist-to',directory+'/state'],{cwd,env:environment,encoding:'utf8'});assert.equal(migrated.status,0,migrated.stderr);
const child=spawn(process.execPath,[cli,'dev','--local','--config',config,'--persist-to',directory+'/state','--port','8788','--ip','127.0.0.1'],{cwd,env:environment,stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
const base='http://127.0.0.1:8788',source=String(Date.now());
async function req(path,data,cookie,method=data?'POST':'GET',headers={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json','CF-Connecting-IP':source,...(cookie?{Cookie:cookie}: {}),...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
function sql(command){const result=spawnSync(process.execPath,[cli,'d1','execute','network-audit-db','--local','--config',config,'--persist-to',directory+'/state','--command',command],{cwd,env:environment,encoding:'utf8'});assert.equal(result.status,0,result.stderr);}
try{
 for(let i=0;i<100;i++){try{if((await req('/api/health')).status===200)break;}catch{}await new Promise(r=>setTimeout(r,200));if(i===99)throw Error(output.slice(-2000));}
 assert.equal((await req('/api/auth/register',{email:'underage@example.invalid',password:'TestingAudit8825',fullName:'Age test',ageConfirmed:false,standardsAccepted:true})).status,400);
 const accounts=[];for(let i=0;i<4;i++){const a=await req('/api/auth/register',{ageConfirmed:true,standardsAccepted:true,email:`audit-${source}-${i}@example.invalid`,password:'TestingAudit8825',fullName:i===0?'Unsearchable Legal Identity':'Audit User '+i,displayName:'Audit display '+i,country:'Nigeria'});assert.equal(a.status,201,JSON.stringify(a));accounts.push(a);}
 const [a,b,admin,independent]=accounts,uid=a.data.userId,bid=b.data.userId;
 const mine=(await req('/api/me',null,a.cookie)).data.profile;assert.equal(mine.locationVisibility,'private');assert.equal(mine.messagingVisibility,'connections');
 await req('/api/me/profile',{city:'Private city',church:'Private church',work:'Private job',locationVisibility:'connections',churchVisibility:'private',workVisibility:'private'},a.cookie,'PATCH');
 await req('/api/me/profile',{bio:'Changed bio only'},a.cookie,'PATCH');
 assert.equal((await req('/api/me',null,a.cookie)).data.profile.churchVisibility,'private');
 assert.equal((await req('/api/me/profile',{locationVisibility:'invalid'},a.cookie,'PATCH')).status,400);
 const guest=(await req('/api/profiles/'+uid)).data.profile;assert.equal(guest.fullName,undefined);assert.equal(guest.city,null);assert.equal((await req('/api/discover?q=Unsearchable%20Legal%20Identity')).data.items.length,0);
 await req('/api/global-connect/profile/'+uid,{},b.cookie);
 assert.equal((await req('/api/profiles/'+uid,null,b.cookie)).data.profile.city,null);
 const post=await req('/api/posts',{postFormat:'design_card',body:'Connections teaching in Christ',visibility:'connections'},a.cookie);assert.equal(post.status,201,JSON.stringify(post));const pid=post.data.postId;
 assert.equal((await req('/api/feed?postId='+pid,null,b.cookie)).data.items.length,0);assert.equal((await req('/api/feed?postId='+pid,null,a.cookie)).data.items.length,1);
 const prayer=await req('/api/prayer-items',{title:'Prayer',requestText:'Connections prayer to God',visibility:'connections'},a.cookie);assert.equal(prayer.status,201);
 assert.ok(!(await req('/api/prayer-items',null,b.cookie)).data.items.some(x=>x.prayer_item_id===prayer.data.prayerItemId));
 await req('/api/global-connect/profile/'+bid,{},a.cookie);
 assert.equal((await req('/api/profiles/'+uid,null,b.cookie)).data.profile.city,'Private city');assert.equal((await req('/api/feed?postId='+pid,null,b.cookie)).data.items.length,1);
 assert.ok((await req('/api/prayer-items',null,b.cookie)).data.items.some(x=>x.prayer_item_id===prayer.data.prayerItemId));
 const spaceInput={name:'Audit space',category:'ministry',description:'A ministry for Christians.',website:'javascript:alert(1)'};assert.equal((await req('/api/spaces',spaceInput,a.cookie)).status,400);const space=await req('/api/spaces',{...spaceInput,website:'https://example.org',contactEmail:'private@example.invalid'},a.cookie);assert.equal(space.status,201);assert.equal((await req('/api/spaces/'+space.data.slug)).data.space.contact_email,undefined);
 assert.equal((await req('/api/reports',{targetType:'message',targetId:999999,reason:'harassment'},b.cookie)).status,400);
 const conversation=await req('/api/messages/requests',{recipientUserId:bid},a.cookie);await req('/api/messages/'+conversation.data.conversation_id+'/decision',{decision:'accept'},b.cookie);
 const msg=await req('/api/messages/'+conversation.data.conversation_id,{body:'A reported message'},a.cookie);assert.equal(msg.status,201);
 assert.equal((await req('/api/reports',{targetType:'message',targetId:msg.data.messageId,reason:'harassment'},independent.cookie)).status,400);
 const mr=await req('/api/reports',{targetType:'message',targetId:msg.data.messageId,reason:'harassment'},b.cookie);assert.equal(mr.status,201);
 const group=await req('/api/groups',{name:'Audit private group',groupType:'prayer',christianPurpose:'Prayer and fellowship with Christ.',visibility:'private'},a.cookie);const gp=await req('/api/posts',{postFormat:'design_card',body:'Private group message',groupId:group.data.groupId},a.cookie);assert.equal(gp.status,201);
 assert.equal((await req('/api/reports',{targetType:'post',targetId:gp.data.postId,reason:'harassment'},b.cookie)).status,400);
 assert.equal((await req('/api/reports',{targetType:'group',targetId:group.data.groupId,reason:'harassment'},b.cookie)).status,400);
 await req('/api/reports',{targetType:'post',targetId:pid,reason:'harassment'},b.cookie);
 sql(`UPDATE users SET role='administrator' WHERE user_id IN (${admin.data.userId},${independent.data.userId})`);
 const queue=(await req('/api/moderation/reports',null,admin.cookie)).data.items;const report=queue.find(x=>x.target_type==='post'&&x.target_id===pid),messageReport=queue.find(x=>x.target_type==='message'&&x.target_id===msg.data.messageId);assert.equal(messageReport.target_body,'A reported message');
 assert.equal((await req('/api/moderation/reports/'+report.report_id+'/review',{action:'remove'},admin.cookie)).status,400);
 assert.equal((await req('/api/moderation/reports/'+report.report_id+'/review',{action:'remove',note:'Removed for local safety verification.'},admin.cookie)).status,200);
 const decision=(await req('/api/me/safety',null,a.cookie)).data.decisions[0];assert.ok(decision.reason);assert.equal((await req('/api/me/requests',{kind:'appeal',decisionId:decision.decision_id,details:'I request another human review.'},b.cookie)).status,400);
 const appeal=await req('/api/me/requests',{kind:'appeal',decisionId:decision.decision_id,details:'I request another human review.'},a.cookie);assert.equal(appeal.status,201);
 assert.equal((await req('/api/moderation/requests',null,b.cookie)).status,403);
 assert.equal((await req('/api/moderation/requests/'+appeal.data.requestId,{response:'Review complete.',restore:true},admin.cookie)).status,403);
 assert.equal((await req('/api/moderation/requests/'+appeal.data.requestId,{response:'Appeal accepted after independent review.',restore:true},independent.cookie)).status,200);
 assert.equal((await req('/api/feed?postId='+pid,null,a.cookie)).data.items.length,1);
 assert.equal((await req('/api/me/safety',null,b.cookie)).data.requests.length,0);
 const rewrite=spawnSync(process.execPath,[cli,'d1','execute','network-audit-db','--local','--config',config,'--persist-to',directory+'/state','--command',"UPDATE safety_audit SET reason='changed'"],{cwd,env:environment,encoding:'utf8'});assert.notEqual(rewrite.status,0);assert.match(rewrite.stderr+rewrite.stdout,/append-only/);
 assert.equal((await req('/api/moderation/reports/'+messageReport.report_id+'/review',{action:'remove',note:'Removed after local verification.'},admin.cookie)).status,200);
 assert.equal((await req('/api/messages/'+conversation.data.conversation_id,null,b.cookie)).data.items.length,0);
 await req('/api/members/'+uid+'/block',{},b.cookie);assert.equal((await req('/api/profiles/'+uid,null,b.cookie)).status,404);assert.equal((await req('/api/global-connect/profile/'+uid,{},b.cookie)).status,400);
 assert.equal((await req('/api/me',null,'gc_session=%ZZ')).status,401);
 assert.equal((await req('/api/me/profile',{bio:'hello'},a.cookie,'PATCH',{'Sec-Fetch-Site':'cross-site'})).status,403);
 assert.equal((await req('/api/me/profile',{description:'a'.repeat(140000)},a.cookie,'PATCH')).status,413);
 assert.equal((await req('/api/media/1')).status,404);
 console.log('PASS: privacy consent direction, defaults, partial updates, search, block boundaries, Space URLs, private reporting, message removal, independent appeals and request isolation');
}finally{if(child.exitCode===null&&child.signalCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await exited;}rmSync(directory,{recursive:true,force:true});}
