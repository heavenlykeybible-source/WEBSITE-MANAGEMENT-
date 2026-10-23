import type {Env} from './types';
import {feed} from './services';
const unavailable=()=>Object.assign(new Error('This ACTIVE content is unavailable.'),{status:404});
export async function preferences(env:Env,userId:number){
 const p=await env.DB.prepare('SELECT active_auto_share FROM profiles WHERE user_id=?').bind(userId).first<{active_auto_share:number}>();
 if(!p)throw unavailable();return {autoAdd:p.active_auto_share===1};
}
export async function updatePreferences(env:Env,userId:number,input:any){
 if(typeof input.autoAdd!=='boolean')throw new Error('Choose whether to automatically add eligible posts to ACTIVE.');
 await env.DB.batch([
  env.DB.prepare('UPDATE profiles SET active_auto_share=? WHERE user_id=?').bind(input.autoAdd?1:0,userId),
  env.DB.prepare("DELETE FROM active_entries WHERE author_user_id=? AND publication_mode='automatic' AND ?=0").bind(userId,input.autoAdd?1:0)
 ]);return preferences(env,userId);
}
export async function list(env:Env,userId:number,postId=0){
 // Viewer must connect to the author. Existing feed() additionally enforces the
 // author's visibility, block rules, account state and post availability.
 const rows=await env.DB.prepare(`SELECT a.post_id,a.published_at,a.expires_at FROM active_entries a
 JOIN posts po ON po.post_id=a.post_id JOIN users u ON u.user_id=a.author_user_id
 WHERE a.expires_at>datetime('now') AND po.status='active' AND po.moderation_state='allowed' AND u.status='active'
 AND a.author_user_id=po.author_user_id AND po.group_id IS NULL AND po.author_space_id IS NULL
 AND po.post_format IN ('design_card','article') AND po.visibility IN ('public','connections')
 AND (?=0 OR a.post_id=?)
 AND (a.author_user_id=? OR EXISTS(SELECT 1 FROM global_connections WHERE user_id=? AND target_type='profile' AND target_id=a.author_user_id))
 ORDER BY a.published_at DESC,a.post_id DESC LIMIT 20`).bind(postId,postId,userId,userId).all<any>();
 const items=[];for(const row of rows.results){const post=(await feed(env,userId,1,{postId:row.post_id}))[0];if(post)items.push({...post,active_published_at:row.published_at,active_expires_at:row.expires_at});}
 return items;
}
export async function publish(env:Env,userId:number,id:number){
 const post=(await feed(env,userId,1,{postId:id}))[0];
 if(!post||post.author_user_id!==userId||post.group_id||post.author_space_id||post.moderation_state!=='allowed'||!['design_card','article'].includes(post.post_format)||!['public','connections'].includes(post.visibility))throw unavailable();
 // Recheck ownership and eligibility within the write to close a moderation/edit race.
 const result=await env.DB.prepare(`INSERT INTO active_entries(post_id,author_user_id,publication_mode,expires_at)
 SELECT post_id,author_user_id,'manual',datetime('now','+24 hours') FROM posts
 WHERE post_id=? AND author_user_id=? AND status='active' AND moderation_state='allowed'
 AND group_id IS NULL AND author_space_id IS NULL AND post_format IN ('design_card','article') AND visibility IN ('public','connections')
 ON CONFLICT(post_id) DO UPDATE SET publication_mode='manual',published_at=datetime('now'),expires_at=datetime('now','+24 hours')`).bind(id,userId).run();
 if(!result.meta.changes)throw unavailable();return {ok:true};
}
export async function remove(env:Env,userId:number,id:number){await env.DB.prepare('DELETE FROM active_entries WHERE post_id=? AND author_user_id=?').bind(id,userId).run();return {ok:true};}
