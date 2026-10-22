import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {stripTypeScriptTypes} from 'node:module';
import {readFileSync,readdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
const base=fileURLToPath(new URL('..',import.meta.url));
test('Spaces: editing permissions, stable identity, validation, discovery and connection state',async()=>{
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
 const input={name:'Prayer outreach',description:'A Christian ministry praying and serving together.',category:'ministry',country:'Nigeria',stateRegion:'Delta',city:'Warri',website:'https://example.org'};
 const created=await S.createSpace(env,1,input),id=created.spaceId;
 const space=await S.getSpace(env,created.slug);assert.equal(space.name,input.name);
 await S.updateSpace(env,1,id,{...input,name:'Prayer and service'});assert.equal((await S.getSpace(env,created.slug)).name,'Prayer and service');
 await assert.rejects(S.updateSpace(env,2,id,input),/owner or administrator/);
 for(const [user,role]of [[2,'editor'],[3,'moderator'],[4,'administrator']])db.prepare('INSERT INTO space_members(space_id,user_id,role) VALUES(?,?,?)').run(id,user,role);
 await assert.rejects(S.updateSpace(env,2,id,input),/owner or administrator/);await assert.rejects(S.updateSpace(env,3,id,input),/owner or administrator/);
 await S.updateSpace(env,4,id,{...input,city:'Udu'});assert.equal((await S.getSpace(env,created.slug)).city,'Udu');
 for(const bad of ['javascript:alert(1)','https://user:password@example.org','not-a-link'])await assert.rejects(S.updateSpace(env,1,id,{...input,website:bad}),/valid https or http/);
 await assert.rejects(S.updateSpace(env,1,id,{...input,category:'unapproved'}),/valid Space category/);
 await assert.rejects(S.updateSpace(env,1,id,{...input,name:'x'}),/required/);
 const before=await S.getSpace(env,created.slug);await assert.rejects(S.updateSpace(env,1,id,{...input,description:'You are stupid'}),/Community Standards/);assert.equal((await S.getSpace(env,created.slug)).description,before.description);
 await S.createPost(env,{userId:2,role:'member'},{authorSpaceId:id,postFormat:'article',title:'A ministry update',body:'Serving together in Christian fellowship.'});
 const postCount=db.prepare('SELECT COUNT(*) c FROM posts WHERE author_space_id=?').get(id).c;
 await S.updateSpace(env,1,id,{...input,name:'Updated ministry'});assert.equal(db.prepare('SELECT COUNT(*) c FROM posts WHERE author_space_id=?').get(id).c,postCount);assert.equal((await S.getSpace(env,created.slug)).slug,created.slug);
 assert.equal((await S.listSpaces(env,undefined,1))[0].can_manage,1);assert.equal((await S.listSpaces(env,undefined,5))[0].can_manage,0);
 assert.equal((await S.toggleGlobalConnect(env,5,'space',id)).connected,true);assert.equal((await S.getSpace(env,created.slug)).global_connections,1);assert.equal((await S.listSpaces(env,undefined,null))[0].global_connections,1);
 assert.equal((await S.toggleGlobalConnect(env,5,'space',id)).connected,false);assert.equal((await S.getSpace(env,created.slug)).global_connections,0);
 db.prepare("UPDATE spaces SET status='suspended' WHERE space_id=?").run(id);assert.equal(await S.getSpace(env,created.slug),null);await assert.rejects(S.updateSpace(env,1,id,input),/owner or administrator/);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
