import type {Env,SessionUser} from "./types";
import {moderateText,recordModeration} from "./moderation";
import {routeReport} from "./stewardship";
import {validatePostPresentation,REPORT_REASONS} from "../public/design-cards.js";

export const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-+|-+$/g,"").slice(0,80)||"space";
const clamp=(value:any,max:number)=>String(value??"").trim().slice(0,max);
const validVisibility=(v:string)=>["public","connections","private"].includes(v)?v:"public";

export async function mediaPolicy(env:Env){
  return {uploadsEnabled:false,videoEnabled:false,postLimits:{images:0,videos:0,audio:0,mixedMedia:false},message:"Community file uploads are disabled. Publish a Design Card, an Article or a Video Link."};
}

export async function publicProfile(env:Env,targetId:number,viewerId:number|null){
  const row=await env.DB.prepare("SELECT p.*,u.role,u.status FROM profiles p JOIN users u ON u.user_id=p.user_id WHERE p.user_id=? AND u.status='active'").bind(targetId).first<any>();
  if(!row)return null;
  if(viewerId&&viewerId!==targetId&&await env.DB.prepare("SELECT 1 FROM user_blocks WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)").bind(viewerId,targetId,targetId,viewerId).first())return null;
  const connected=viewerId?!!await env.DB.prepare("SELECT 1 FROM global_connections WHERE user_id=? AND target_type='profile' AND target_id=?").bind(targetId,viewerId).first():false;
  const can=(setting:string)=>setting==="public"||(setting==="connections"&&connected)||viewerId===targetId;
  const connectionCount=await env.DB.prepare("SELECT COUNT(*) c FROM global_connections WHERE target_type='profile' AND target_id=?").bind(targetId).first<any>();
  return {
    userId:row.user_id,fullName:viewerId===targetId?row.full_name:undefined,displayName:row.display_name,profilePhotoKey:row.profile_photo_key,coverPhotoKey:row.cover_photo_key,
    bio:row.bio,description:row.description,ministryCalling:row.ministry_calling,christianInterests:row.christian_interests,
    country:can(row.location_visibility)?row.country:null,stateRegion:can(row.location_visibility)?row.state_region:null,city:can(row.location_visibility)?row.city:null,
    church:can(row.church_visibility)?row.church:null,work:can(row.work_visibility)?row.work:null,
    dateOfBirth:viewerId===targetId||row.birth_display_mode==="full"?row.date_of_birth:null,
    birthday:row.birth_display_mode==="day_month"&&row.date_of_birth?String(row.date_of_birth).slice(5):null,
    age:row.birth_display_mode==="age"&&row.date_of_birth?Math.max(0,new Date().getUTCFullYear()-Number(String(row.date_of_birth).slice(0,4))-(new Date().toISOString().slice(5,10)<String(row.date_of_birth).slice(5,10)?1:0)):null,
    globalConnections:row.global_connections_visibility==="public"||viewerId===targetId?Number(connectionCount?.c||0):null,
    globalConnectionsVisible:row.global_connections_visibility==="public",
    messagingVisibility:viewerId===targetId?row.messaging_visibility:undefined,
    ...(viewerId===targetId?{birthDisplayMode:row.birth_display_mode,locationVisibility:row.location_visibility,churchVisibility:row.church_visibility,workVisibility:row.work_visibility,globalConnectionsVisibility:row.global_connections_visibility}:{})
  };
}

export async function updateProfile(env:Env,userId:number,input:any){
  const existing=await publicProfile(env,userId,userId);if(!existing)throw new Error("Profile unavailable.");
  input={...existing,...input};
  for(const key of ["locationVisibility","churchVisibility","workVisibility"])if(!["public","connections","private"].includes(input[key]))throw new Error("Choose a valid privacy setting.");
  if(!["public","private"].includes(input.globalConnectionsVisibility)||!["full","day_month","age","private"].includes(input.birthDisplayMode)||!["everyone","connections","groups","nobody"].includes(input.messagingVisibility))throw new Error("Choose a valid privacy setting.");
  if(clamp(input.fullName,100).length<2||clamp(input.displayName,60).length<2)throw new Error("Names must contain at least two characters.");
  if(input.dateOfBirth){const dob=String(input.dateOfBirth);if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||!Number.isFinite(Date.parse(dob))||new Date(dob).toISOString().slice(0,10)!==dob||dob>new Date().toISOString().slice(0,10))throw new Error("Enter a valid date of birth.");}
  const text=[input.fullName,input.displayName,input.bio,input.church,input.work,input.ministryCalling,input.christianInterests,input.description].filter(Boolean).join("\n");
  const mod=moderateText(text,"profile",env.COMMUNITY_BLOCKED_WORDS);if(["block","hold"].includes(mod.decision)){await recordModeration(env,userId,"profile",userId,mod);throw new Error("Profile update blocked by Community Standards.");}
  await env.DB.prepare(`UPDATE profiles SET full_name=?,display_name=?,country=?,state_region=?,city=?,date_of_birth=?,birth_display_mode=?,bio=?,church=?,work=?,ministry_calling=?,christian_interests=?,description=?,location_visibility=?,church_visibility=?,work_visibility=?,global_connections_visibility=?,messaging_visibility=?,updated_at=datetime('now') WHERE user_id=?`)
    .bind(clamp(input.fullName,100),clamp(input.displayName,60),clamp(input.country,80)||null,clamp(input.stateRegion,100)||null,clamp(input.city,100)||null,clamp(input.dateOfBirth,10)||null,
      ["full","day_month","age","private"].includes(input.birthDisplayMode)?input.birthDisplayMode:"private",clamp(input.bio,280)||null,clamp(input.church,160)||null,clamp(input.work,160)||null,
      clamp(input.ministryCalling,200)||null,clamp(input.christianInterests,500)||null,clamp(input.description,2000)||null,validVisibility(input.locationVisibility),validVisibility(input.churchVisibility),validVisibility(input.workVisibility),
      input.globalConnectionsVisibility==="private"?"private":"public",["everyone","connections","groups","nobody"].includes(input.messagingVisibility)?input.messagingVisibility:"connections",userId).run();
  if(mod.decision!=="allow")await recordModeration(env,userId,"profile",userId,mod);
}

export async function toggleGlobalConnect(env:Env,userId:number,targetType:"profile"|"space",targetId:number){
  if(targetType==="profile"&&userId===targetId)throw new Error("You cannot Global Connect to your own profile.");
  if(targetType==="profile"&&await env.DB.prepare("SELECT 1 FROM user_blocks WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)").bind(userId,targetId,targetId,userId).first())throw new Error("This profile is unavailable.");
  const exists=await env.DB.prepare("SELECT connection_id FROM global_connections WHERE user_id=? AND target_type=? AND target_id=?").bind(userId,targetType,targetId).first<any>();
  if(exists){await env.DB.prepare("DELETE FROM global_connections WHERE connection_id=?").bind(exists.connection_id).run();return {connected:false};}
  const valid=targetType==="profile"
    ?await env.DB.prepare("SELECT 1 FROM users WHERE user_id=? AND status='active'").bind(targetId).first()
    :await env.DB.prepare("SELECT 1 FROM spaces WHERE space_id=? AND status='active'").bind(targetId).first();
  if(!valid)throw new Error("This profile or Space is unavailable.");
  await env.DB.prepare("INSERT INTO global_connections(user_id,target_type,target_id) VALUES(?,?,?)").bind(userId,targetType,targetId).run();
  if(targetType==="profile")await notify(env,targetId,"global_connect","New Global Connection","Someone Global Connected with you.","/profile.html?id="+userId);
  return {connected:true};
}

export async function listConnections(env:Env,userId:number){
  const rows=await env.DB.prepare(`SELECT c.target_type,c.target_id,c.created_at,
    CASE WHEN c.target_type='profile' THEN p.display_name ELSE s.name END display_name
    FROM global_connections c
    LEFT JOIN profiles p ON c.target_type='profile' AND p.user_id=c.target_id
    LEFT JOIN spaces s ON c.target_type='space' AND s.space_id=c.target_id
    WHERE c.user_id=? ORDER BY c.created_at DESC LIMIT 300`).bind(userId).all<any>();
  return rows.results;
}

export async function createSpace(env:Env,userId:number,input:any){
  const name=clamp(input.name,120),description=clamp(input.description,2000);if(name.length<2||description.length<10)throw new Error("Space name and Christian-purpose description are required.");
  const website=clamp(input.website,300);if(website){let link:URL;try{link=new URL(website);}catch{throw new Error("Website must be a valid https or http link.");}if(!["https:","http:"].includes(link.protocol)||link.username||link.password)throw new Error("Website must be a valid https or http link.");}
  const mod=moderateText(name+"\n"+description,"space",env.COMMUNITY_BLOCKED_WORDS);if(["block","hold"].includes(mod.decision)){await recordModeration(env,userId,"space",null,mod);throw new Error("This Space cannot be created because it violates Community Standards.");}
  const allowed=["ministry","church","christian_organization","mission_outreach","christian_business","christian_media","music_ministry","christian_project","fellowship_network","other_approved"];
  if(!allowed.includes(input.category))throw new Error("Choose a valid Space category.");
  let slug=slugify(input.slug||name),n=1;while(await env.DB.prepare("SELECT 1 FROM spaces WHERE slug=?").bind(slug).first())slug=slugify(name)+"-"+(++n);
  const row=await env.DB.prepare(`INSERT INTO spaces(slug,name,category,description,country,state_region,city,website,contact_email,owner_user_id)
    VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING space_id`).bind(slug,name,input.category,description,clamp(input.country,80)||null,clamp(input.stateRegion,100)||null,clamp(input.city,100)||null,clamp(input.website,300)||null,clamp(input.contactEmail,160)||null,userId).first<any>();
  if(!row)throw new Error("Space could not be created.");
  await env.DB.prepare("INSERT INTO space_members(space_id,user_id,role) VALUES(?,?,'owner')").bind(row.space_id,userId).run();
  if(mod.decision!=="allow")await recordModeration(env,userId,"space",row.space_id,mod);
  return {spaceId:Number(row.space_id),slug};
}
export async function updateSpace(env:Env,userId:number,spaceId:number,input:any){
  const allowed=await env.DB.prepare("SELECT 1 FROM space_members sm JOIN spaces s ON s.space_id=sm.space_id WHERE sm.space_id=? AND sm.user_id=? AND sm.role IN ('owner','administrator') AND s.status='active'").bind(spaceId,userId).first();
  if(!allowed)throw new Error("Space owner or administrator access required.");
  const name=clamp(input.name,120),description=clamp(input.description,2000),website=clamp(input.website,300);
  if(name.length<2||description.length<10)throw new Error("Space name and Christian-purpose description are required.");
  if(!["ministry","church","christian_organization","mission_outreach","christian_business","christian_media","music_ministry","christian_project","fellowship_network","other_approved"].includes(input.category))throw new Error("Choose a valid Space category.");
  if(website){let link:URL;try{link=new URL(website);}catch{throw new Error("Website must be a valid https or http link.");}if(!["https:","http:"].includes(link.protocol)||link.username||link.password)throw new Error("Website must be a valid https or http link.");}
  const country=clamp(input.country,80),state=clamp(input.stateRegion,100),city=clamp(input.city,100),mod=moderateText([name,description,country,state,city].join("\n"),"space",env.COMMUNITY_BLOCKED_WORDS);
  if(["block","hold"].includes(mod.decision)){await recordModeration(env,userId,"space",spaceId,mod);throw new Error("These Space details violate Community Standards.");}
  const result=await env.DB.prepare("UPDATE spaces SET name=?,description=?,category=?,website=?,country=?,state_region=?,city=?,updated_at=datetime('now') WHERE space_id=? AND status='active' AND EXISTS(SELECT 1 FROM space_members WHERE space_id=spaces.space_id AND user_id=? AND role IN ('owner','administrator'))").bind(name,description,input.category,website||null,country||null,state||null,city||null,spaceId,userId).run();
  if(!result.meta.changes)throw new Error("This Space could not be updated. Refresh and try again.");
  if(mod.decision!=="allow")await recordModeration(env,userId,"space",spaceId,mod);
  return {ok:true};
}
export async function listSpaces(env:Env,category?:string,userId:number|null=null){
  const r=await env.DB.prepare(`SELECT s.space_id,s.slug,s.name,s.category,s.description,s.country,s.state_region,s.city,s.verification_status,
    (SELECT COUNT(*) FROM global_connections WHERE target_type='space' AND target_id=s.space_id) global_connections,
    EXISTS(SELECT 1 FROM space_members WHERE space_id=s.space_id AND user_id=?) can_manage
    FROM spaces s WHERE s.status='active' AND (?='' OR s.category=?) ORDER BY s.created_at DESC LIMIT 100`).bind(userId,category||'',category||'').all<any>();return r.results;
}
export async function getSpace(env:Env,slug:string){
  const s=await env.DB.prepare("SELECT space_id,slug,name,category,description,country,state_region,city,website,owner_user_id,verification_status,created_at FROM spaces WHERE slug=? AND status='active'").bind(slug).first<any>();if(!s)return null;
  const c=await env.DB.prepare("SELECT COUNT(*) c FROM global_connections WHERE target_type='space' AND target_id=?").bind(s.space_id).first<any>();
  return {...s,global_connections:Number(c?.c||0)};
}

export async function createGroup(env:Env,userId:number,input:any){
  const name=clamp(input.name,120),description=clamp(input.description,1500),purpose=clamp(input.christianPurpose,1200);
  if(name.length<2||purpose.length<15)throw new Error("Every Group must have a clear Christian purpose.");
  const mod=moderateText(name+"\n"+description+"\n"+purpose,"group",env.COMMUNITY_BLOCKED_WORDS);if(["block","hold"].includes(mod.decision)){await recordModeration(env,userId,"group",null,mod);throw new Error("This Group cannot be created because it violates Community Standards.");}
  const types=["fellowship","prayer","bible_study","youth","women","men","family","pastors_ministers","new_converts","missions","country_city","service_team","other_christian"];
  if(!types.includes(input.groupType))throw new Error("Choose a valid Christian Group type.");
  let slug=slugify(input.slug||name),n=1;while(await env.DB.prepare("SELECT 1 FROM groups WHERE slug=?").bind(slug).first())slug=slugify(name)+"-"+(++n);
  const visibility=["public","private","hidden"].includes(input.visibility)?input.visibility:"private";
  const rules=clamp(input.rules,2000),joinApproval=input.joinApproval===true||visibility!=='public'?1:0,postingPolicy=input.postingPolicy==='managers'?'managers':'members';
  if(moderateText(rules,"group",env.COMMUNITY_BLOCKED_WORDS).decision==='block')throw new Error("Group rules violate Community Standards.");
  const row=await env.DB.prepare("INSERT INTO groups(name,slug,group_type,description,christian_purpose,visibility,owner_user_id,rules,join_approval,posting_policy) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING group_id")
    .bind(name,slug,input.groupType,description,purpose,visibility,userId,rules,joinApproval,postingPolicy).first<any>();
  if(!row)throw new Error("Group could not be created.");
  await env.DB.prepare("INSERT INTO group_members(group_id,user_id,role,join_status) VALUES(?,?,'owner','approved')").bind(row.group_id,userId).run();
  if(mod.decision!=="allow")await recordModeration(env,userId,"group",row.group_id,mod);
  return {groupId:Number(row.group_id),slug};
}
export async function listGroups(env:Env,userId:number|null){
  const r=await env.DB.prepare(`SELECT g.*,gm.join_status membership_status,gm.role member_role,
    CASE WHEN gm.join_status='approved' THEN 1 ELSE 0 END joined,
    (SELECT COUNT(*) FROM group_members WHERE group_id=g.group_id AND join_status='approved') member_count
    FROM groups g LEFT JOIN group_members gm ON gm.group_id=g.group_id AND gm.user_id=?
    WHERE g.status='active' AND (g.visibility IN ('public','private') OR gm.join_status='approved') ORDER BY g.created_at DESC LIMIT 100`).bind(userId).all<any>();return r.results;
}
export async function joinGroup(env:Env,userId:number,groupId:number){
  const g=await env.DB.prepare("SELECT visibility,status,join_approval FROM groups WHERE group_id=?").bind(groupId).first<any>();if(!g||g.status!=="active"||g.visibility==='hidden')throw new Error("Group not found.");
  const existing=await env.DB.prepare("SELECT join_status FROM group_members WHERE group_id=? AND user_id=?").bind(groupId,userId).first<any>();if(existing)return {status:existing.join_status};
  const status=g.visibility==="public"&&!g.join_approval?"approved":"pending";
  await env.DB.prepare("INSERT OR IGNORE INTO group_members(group_id,user_id,role,join_status) VALUES(?,?,'member',?)").bind(groupId,userId,status).run();return {status};
}
export async function groupRequests(env:Env,userId:number,groupId:number){
  await groupManager(env,userId,groupId);
  return (await env.DB.prepare("SELECT gm.user_id,p.display_name,p.profile_photo_key FROM group_members gm JOIN profiles p ON p.user_id=gm.user_id WHERE gm.group_id=? AND gm.join_status='pending' LIMIT 100").bind(groupId).all<any>()).results;
}
async function groupManager(env:Env,userId:number,groupId:number){
  if(!await env.DB.prepare("SELECT 1 FROM group_members gm JOIN groups g ON g.group_id=gm.group_id WHERE gm.group_id=? AND gm.user_id=? AND gm.join_status='approved' AND gm.role IN ('owner','administrator','moderator') AND g.status='active'").bind(groupId,userId).first())throw Object.assign(new Error("Group manager access required."),{status:403});
}
export async function decideGroupRequest(env:Env,userId:number,groupId:number,target:number,accept:boolean){
  await groupManager(env,userId,groupId);
  if(accept)await env.DB.prepare("UPDATE group_members SET join_status='approved' WHERE group_id=? AND user_id=? AND join_status='pending'").bind(groupId,target).run();
  else await env.DB.prepare("DELETE FROM group_members WHERE group_id=? AND user_id=? AND join_status='pending'").bind(groupId,target).run();return {ok:true};
}


export async function groupDetail(env:Env,userId:number|null,id:number){
 const g=await env.DB.prepare(`SELECT g.*,gm.join_status membership_status,gm.role member_role,CASE WHEN gm.join_status='approved' THEN 1 ELSE 0 END joined,
 (SELECT COUNT(*) FROM group_members WHERE group_id=g.group_id AND join_status='approved') member_count
 FROM groups g LEFT JOIN group_members gm ON gm.group_id=g.group_id AND gm.user_id=? WHERE g.group_id=? AND g.status='active' AND (g.visibility!='hidden' OR gm.join_status='approved')`).bind(userId,id).first<any>();
 if(!g)throw Object.assign(new Error("Group unavailable."),{status:404});return g;
}
async function groupAdministrator(env:Env,userId:number,id:number){
 const g=await groupDetail(env,userId,id);if(!g.joined||!['owner','administrator'].includes(g.member_role))throw Object.assign(new Error("Group administrator access required."),{status:403});return g;
}
export async function updateGroup(env:Env,userId:number,id:number,input:any){
 const g=await groupAdministrator(env,userId,id),name=clamp(input.name,120),purpose=clamp(input.christianPurpose,1200),description=clamp(input.description,1500),rules=clamp(input.rules,2000);
 if(name.length<2||purpose.length<15)throw new Error("Give your group a name and a clear Christian purpose.");
 // Privacy can be tightened, never loosened, to protect members' existing posts.
 const levels=['public','private','hidden'];if(!levels.includes(input.visibility)||levels.indexOf(input.visibility)<levels.indexOf(g.visibility))throw new Error("Privacy can only be made more restrictive.");
 if(!['members','managers'].includes(input.postingPolicy))throw new Error("Choose who can publish group posts.");
 const mod=moderateText(name+"\n"+purpose+"\n"+description+"\n"+rules,"group",env.COMMUNITY_BLOCKED_WORDS);if(['block','hold'].includes(mod.decision)){await recordModeration(env,userId,'group',null,mod);throw new Error('These details need a Community Standards review. Please revise them.');}
 const changed=await env.DB.prepare("UPDATE groups SET name=?,description=?,christian_purpose=?,rules=?,visibility=?,join_approval=?,posting_policy=? WHERE group_id=? AND status='active' AND (visibility=? OR visibility='public' OR (visibility='private' AND ?='hidden'))").bind(name,description,purpose,rules,input.visibility,input.visibility!=='public'||input.joinApproval===true?1:0,input.postingPolicy,id,input.visibility,input.visibility).run();
 if(!changed.meta.changes)throw new Error("The group changed. Refresh before saving settings.");
 if(mod.decision!=='allow')await recordModeration(env,userId,"group",id,mod);return {ok:true};
}
export async function groupMembers(env:Env,userId:number,id:number){
 const g=await groupDetail(env,userId,id);if(!g.joined)throw Object.assign(new Error("Join this group to view its members."),{status:403});
 return (await env.DB.prepare("SELECT gm.user_id,gm.role,p.display_name,p.profile_photo_key FROM group_members gm JOIN profiles p ON p.user_id=gm.user_id JOIN users u ON u.user_id=gm.user_id WHERE gm.group_id=? AND gm.join_status='approved' AND u.status='active' ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'administrator' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,p.display_name LIMIT 100").bind(id).all<any>()).results;
}
export async function manageGroupMember(env:Env,userId:number,id:number,target:number,input:any){
 const g=await groupAdministrator(env,userId,id);if(target===userId||target===g.owner_user_id)throw Object.assign(new Error("You cannot change your own role or the group owner."),{status:403});
 const member=await env.DB.prepare("SELECT role FROM group_members WHERE group_id=? AND user_id=? AND join_status='approved'").bind(id,target).first<any>();if(!member)throw new Error("Member unavailable.");
 if(g.member_role!=='owner'&&member.role!=='member')throw Object.assign(new Error("Only the owner can manage group managers."),{status:403});
 if(input.action==='remove'){const removed=await env.DB.prepare("UPDATE group_members SET join_status='rejected',role='member' WHERE group_id=? AND user_id=? AND role!='owner' AND (?='owner' OR role='member')").bind(id,target,g.member_role).run();if(!removed.meta.changes)throw new Error("The member changed. Refresh before trying again.");return {ok:true};}
 if(input.action!=='role'||g.member_role!=='owner'||!['member','moderator','administrator'].includes(input.role))throw Object.assign(new Error("Only the owner can assign valid member roles."),{status:403});
 await env.DB.prepare("UPDATE group_members SET role=? WHERE group_id=? AND user_id=? AND role!='owner'").bind(input.role,id,target).run();return {ok:true};
}
export async function leaveGroup(env:Env,userId:number,id:number){
 const g=await groupDetail(env,userId,id);if(g.owner_user_id===userId)throw new Error("The owner must remain to manage this group.");
 await env.DB.prepare("DELETE FROM group_members WHERE group_id=? AND user_id=? AND join_status IN ('approved','pending')").bind(id,userId).run();return {ok:true};
}

export async function createPost(env:Env,user:SessionUser,input:any){
  const presentation=validatePostPresentation({...input,postFormat:input.postFormat||(input.title?"article":"design_card")});
  const {body,title,scripture}=presentation;
  const mod=moderateText(title+"\n"+body+"\n"+scripture,"post",env.COMMUNITY_BLOCKED_WORDS);
  if(mod.decision==="block"){await recordModeration(env,user.userId,"post",null,mod);throw new Error("This post cannot be published because it violates the Christian Community Standards.");}
  let authorSpaceId:number|null=null;
  if(input.authorSpaceId){const can=await env.DB.prepare("SELECT 1 FROM space_members sm JOIN spaces s ON s.space_id=sm.space_id WHERE sm.space_id=? AND sm.user_id=? AND s.status='active'").bind(Number(input.authorSpaceId),user.userId).first();if(!can)throw new Error("You do not manage this Space.");authorSpaceId=Number(input.authorSpaceId);}
  let groupId:number|null=null;
  if(input.groupId){const can=await env.DB.prepare("SELECT 1 FROM group_members gm JOIN groups g ON g.group_id=gm.group_id WHERE gm.group_id=? AND gm.user_id=? AND gm.join_status='approved' AND g.status='active' AND (g.posting_policy='members' OR gm.role IN ('owner','administrator','moderator'))").bind(Number(input.groupId),user.userId).first();if(!can)throw new Error("Join the Group before posting.");groupId=Number(input.groupId);}
  const types=["fellowship","prayer","testimony","bible_question","bible_answer","encouragement","mission","salvation","announcement"];
  const type=types.includes(input.postType)?input.postType:"fellowship";
  const visibility=groupId?"group":input.visibility==="connections"?"connections":"public";
  const state=mod.decision==="hold"?"held":mod.decision==="warn"?"warned":"allowed",status=mod.decision==="hold"?"held":"active";
  const row=await env.DB.prepare("INSERT INTO posts(author_user_id,author_space_id,group_id,post_type,title,body,visibility,status,moderation_state,post_format,design_category,design_settings,scripture,video_url,video_provider) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING post_id")
    .bind(user.userId,authorSpaceId,groupId,type,title||null,body,visibility,status,state,presentation.format,presentation.category,presentation.design?JSON.stringify(presentation.design):null,scripture||null,presentation.video?.url||null,presentation.video?.provider||null).first<any>();
  if(!row)throw new Error("Post could not be created.");
  if(mod.decision!=="allow")await recordModeration(env,user.userId,"post",row.post_id,mod);
  return {postId:Number(row.post_id),status,state};
}
export async function editPost(env:Env,user:SessionUser,id:number,input:any){
  const existing=await env.DB.prepare("SELECT post_id FROM posts WHERE post_id=? AND author_user_id=? AND status IN ('active','held')").bind(id,user.userId).first();
  if(!existing)throw Object.assign(new Error("You can edit only your own available posts."),{status:403});
  const p=validatePostPresentation(input),mod=moderateText(p.title+"\n"+p.body+"\n"+p.scripture,"post",env.COMMUNITY_BLOCKED_WORDS);
  if(mod.decision==="block"){await recordModeration(env,user.userId,"post",id,mod);throw new Error("This edit violates the Christian Community Standards.");}
  const state=mod.decision==="hold"?"held":mod.decision==="warn"?"warned":"allowed",status=mod.decision==="hold"?"held":"active";
  const changed=await env.DB.prepare("UPDATE posts SET title=?,body=?,post_format=?,design_category=?,design_settings=?,scripture=?,video_url=?,video_provider=?,background_style=NULL,status=?,moderation_state=?,updated_at=datetime('now') WHERE post_id=? AND author_user_id=? AND status IN ('active','held')")
    .bind(p.title||null,p.body,p.format,p.category,p.design?JSON.stringify(p.design):null,p.scripture||null,p.video?.url||null,p.video?.provider||null,status,state,id,user.userId).run();
  if(!changed.meta.changes)throw new Error("Post is no longer available for editing.");
  if(mod.decision!=="allow")await recordModeration(env,user.userId,"post",id,mod);
  return {postId:id,status,state};
}
export async function feed(env:Env,userId:number|null,limit=20,options:any={}){
  const take=Math.min(Math.max(Number(limit)||20,1),50),before=Number(options.before)||Number.MAX_SAFE_INTEGER;
  const r=await env.DB.prepare(`SELECT po.*,p.display_name profile_name,s.name space_name,g.name group_name,
    (SELECT COUNT(*) FROM comments WHERE post_id=po.post_id AND status='active') comment_count,
    EXISTS(SELECT 1 FROM saved_posts WHERE post_id=po.post_id AND user_id=?) saved
    FROM posts po JOIN profiles p ON p.user_id=po.author_user_id JOIN users u ON u.user_id=p.user_id
    LEFT JOIN spaces s ON s.space_id=po.author_space_id LEFT JOIN groups g ON g.group_id=po.group_id
    WHERE po.status='active' AND u.status='active' AND po.post_id<?
    AND (?=0 OR po.group_id=?) AND (?=0 OR po.author_space_id=?) AND (?=0 OR po.post_id=?)
    AND (?='' OR po.post_type=? OR po.post_format=?)
    AND (?=0 OR EXISTS(SELECT 1 FROM saved_posts WHERE user_id=? AND post_id=po.post_id))
    AND (?=0 OR po.author_user_id=? OR EXISTS(SELECT 1 FROM global_connections WHERE user_id=? AND target_type='profile' AND target_id=po.author_user_id))
    AND NOT EXISTS(SELECT 1 FROM user_blocks WHERE (blocker_user_id=? AND blocked_user_id=po.author_user_id) OR (blocker_user_id=po.author_user_id AND blocked_user_id=?))
    AND (po.author_space_id IS NULL OR s.status='active')
    AND (po.group_id IS NULL OR (g.status='active' AND (g.visibility='public' OR EXISTS(SELECT 1 FROM group_members WHERE group_id=po.group_id AND user_id=? AND join_status='approved'))))
    AND (po.author_user_id=? OR po.visibility='public'
      OR (po.visibility='connections' AND EXISTS(SELECT 1 FROM global_connections WHERE user_id=po.author_user_id AND target_type='profile' AND target_id=?))
      OR (po.visibility='group' AND EXISTS(SELECT 1 FROM group_members WHERE group_id=po.group_id AND user_id=? AND join_status='approved')))
    ORDER BY po.post_id DESC LIMIT ?`).bind(userId,before,Number(options.groupId)||0,Number(options.groupId)||0,Number(options.spaceId)||0,Number(options.spaceId)||0,Number(options.postId)||0,Number(options.postId)||0,
    options.type||'',options.type||'',options.type||'',options.saved?1:0,userId,options.connections?1:0,userId,userId,userId,userId,userId,userId,userId,userId,take).all<any>();
  if(!r.results.length)return [];
  const ids=r.results.map(x=>x.post_id),marks=ids.map(()=>'?').join(',');
  const rx=await env.DB.prepare(`SELECT post_id,reaction_type,COUNT(*) c,MAX(CASE WHEN user_id=? THEN 1 ELSE 0 END) mine FROM reactions WHERE post_id IN (${marks}) GROUP BY post_id,reaction_type`).bind(userId,...ids).all<any>();
  return r.results.map(row=>({...row,reactions:Object.fromEntries(rx.results.filter(x=>x.post_id===row.post_id).map(x=>[x.reaction_type,Number(x.c)])),my_reactions:rx.results.filter(x=>x.post_id===row.post_id&&x.mine).map(x=>x.reaction_type),media:[]}));
}

export async function toggleReaction(env:Env,userId:number,postId:number,type:string){
  const allowed=["amen","hallelujah","glory_to_god","praying","encouraged","thank_god","helpful","i_will_go","challenge_accepted"];if(!allowed.includes(type))throw new Error("Unknown reaction.");
  const post=(await feed(env,userId,1,{postId}))[0];if(!post)throw new Error("Post is unavailable.");
  const ex=await env.DB.prepare("SELECT reaction_id FROM reactions WHERE user_id=? AND post_id=? AND reaction_type=?").bind(userId,postId,type).first<any>();
  if(ex){await env.DB.prepare("DELETE FROM reactions WHERE reaction_id=?").bind(ex.reaction_id).run();return {active:false};}
  await env.DB.prepare("INSERT INTO reactions(user_id,post_id,reaction_type) VALUES(?,?,?)").bind(userId,postId,type).run();return {active:true};
}

async function areConnected(env:Env,a:number,b:number){return !!await env.DB.prepare("SELECT 1 FROM global_connections WHERE user_id=? AND target_type='profile' AND target_id=?").bind(a,b).first();}
async function shareGroup(env:Env,a:number,b:number){return !!await env.DB.prepare(`SELECT 1 FROM group_members x JOIN group_members y ON y.group_id=x.group_id WHERE x.user_id=? AND y.user_id=? AND x.join_status='approved' AND y.join_status='approved' LIMIT 1`).bind(a,b).first();}
export async function requestConversation(env:Env,from:number,to:number){
  if(!Number.isSafeInteger(to)||to<1||from===to)throw new Error("Choose another member.");
  if(await env.DB.prepare("SELECT 1 FROM user_blocks WHERE (blocker_user_id=? AND blocked_user_id=?) OR (blocker_user_id=? AND blocked_user_id=?)").bind(from,to,to,from).first())throw new Error("This conversation is unavailable.");
  const p=await env.DB.prepare("SELECT p.messaging_visibility FROM profiles p JOIN users u ON u.user_id=p.user_id WHERE p.user_id=? AND u.status='active'").bind(to).first<any>();if(!p)throw new Error("Member not found.");
  if(p.messaging_visibility==="nobody")throw new Error("This member is not accepting messages.");
  if(p.messaging_visibility==="connections"&&!await areConnected(env,to,from))throw new Error("This member accepts message requests only from Global Connections.");
  if(p.messaging_visibility==="groups"&&!await shareGroup(env,from,to))throw new Error("This member accepts messages only from shared Groups.");
  let row=await env.DB.prepare("SELECT conversation_id,status FROM conversations WHERE (requester_user_id=? AND recipient_user_id=?) OR (requester_user_id=? AND recipient_user_id=?) ORDER BY conversation_id LIMIT 1").bind(from,to,to,from).first<any>();
  if(row)return row;
  if(!row){row=await env.DB.prepare("INSERT INTO conversations(requester_user_id,recipient_user_id,status) SELECT ?,?,'requested' WHERE NOT EXISTS(SELECT 1 FROM conversations WHERE (requester_user_id=? AND recipient_user_id=?) OR (requester_user_id=? AND recipient_user_id=?)) RETURNING conversation_id,status").bind(from,to,from,to,to,from).first<any>();
    if(!row)return await env.DB.prepare("SELECT conversation_id,status FROM conversations WHERE (requester_user_id=? AND recipient_user_id=?) OR (requester_user_id=? AND recipient_user_id=?) ORDER BY conversation_id LIMIT 1").bind(from,to,to,from).first<any>();}
  await notify(env,to,"message_request","New message request","A member would like to connect with you in fellowship.","/messages");
  return row;
}

async function conversationAccess(env:Env,userId:number,id:number,required='accepted'){
 const c=await env.DB.prepare(`SELECT c.* FROM conversations c JOIN users a ON a.user_id=c.requester_user_id JOIN users b ON b.user_id=c.recipient_user_id
 WHERE c.conversation_id=? AND c.status=? AND (c.requester_user_id=? OR c.recipient_user_id=?) AND a.status='active' AND b.status='active'
 AND NOT EXISTS(SELECT 1 FROM user_blocks WHERE (blocker_user_id=c.requester_user_id AND blocked_user_id=c.recipient_user_id) OR (blocker_user_id=c.recipient_user_id AND blocked_user_id=c.requester_user_id))`).bind(id,required,userId,userId).first<any>();
 if(!c)throw Object.assign(new Error("Conversation unavailable."),{status:403});return c;
}
export async function decideConversation(env:Env,userId:number,id:number,accept:boolean){
  const c=await conversationAccess(env,userId,id,"requested");if(c.recipient_user_id!==userId)throw Object.assign(new Error("Only the recipient can respond."),{status:403});
  const r=await env.DB.prepare("UPDATE conversations SET status=?,updated_at=datetime('now') WHERE conversation_id=? AND recipient_user_id=? AND status='requested'").bind(accept?"accepted":"declined",id,userId).run();
  if(!r.meta.changes)throw new Error("Message request is unavailable.");return {status:accept?"accepted":"declined"};
}
export async function sendMessage(env:Env,userId:number,id:number,bodyRaw:string,requestKey?:string){
  if(typeof bodyRaw!=='string'||bodyRaw.length>3000)throw new Error("Messages must contain no more than 3000 characters.");
  const body=clamp(bodyRaw,3000);if(!body)throw new Error("Message cannot be empty.");
  const c=await conversationAccess(env,userId,id);
  const key=requestKey===undefined?null:requestKey;
  if(key!==null&&(typeof key!=='string'||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i).test(key)))throw new Error("Invalid message retry identifier.");
  const retry=async()=>{const previous=await env.DB.prepare("SELECT message_id,body,status FROM messages WHERE conversation_id=? AND sender_user_id=? AND client_request_id=?").bind(id,userId,key).first<any>();if(previous){if(previous.body!==body)throw Object.assign(new Error("This retry identifier belongs to a different message."),{status:409});if(!['delivered','held'].includes(previous.status))throw new Error("This message is unavailable.");return {messageId:Number(previous.message_id),status:previous.status};}return null;};
  if(key){const previous=await retry();if(previous)return previous;}

  const mod=moderateText(body,"message",env.COMMUNITY_BLOCKED_WORDS);if(mod.decision==="block"){await recordModeration(env,userId,"message",null,mod);throw new Error("This message was blocked by the Christian Community safety rules.");}
  const status=mod.decision==="hold"?"held":"delivered",state=mod.decision==="hold"?"held":mod.decision==="warn"?"warned":"allowed";
  const row=await env.DB.prepare("INSERT INTO messages(conversation_id,sender_user_id,body,status,moderation_state,client_request_id) VALUES(?,?,?,?,?,?) ON CONFLICT(conversation_id,sender_user_id,client_request_id) DO NOTHING RETURNING message_id").bind(id,userId,body,status,state,key).first<any>();
  if(!row){const previous=await retry();if(previous)return previous;throw new Error("Message could not be saved.");}
  if(mod.decision!=="allow")await recordModeration(env,userId,"message",row?.message_id||null,mod);
  await env.DB.prepare("UPDATE conversations SET updated_at=datetime('now') WHERE conversation_id=?").bind(id).run();
  if(status==="delivered"){const to=c.requester_user_id===userId?c.recipient_user_id:c.requester_user_id;await notify(env,to,"message","New fellowship message","You have a new message.","/messages.html?conversation="+id);}
  return {messageId:Number(row?.message_id),status};
}
export async function inbox(env:Env,userId:number){
  const r=await env.DB.prepare(`SELECT c.*,p1.display_name requester_name,p2.display_name recipient_name,p1.profile_photo_key requester_photo,p2.profile_photo_key recipient_photo,
 (SELECT substr(body,1,160) FROM messages WHERE conversation_id=c.conversation_id AND status='delivered' ORDER BY message_id DESC LIMIT 1) last_message,
 (SELECT created_at FROM messages WHERE conversation_id=c.conversation_id AND status='delivered' ORDER BY message_id DESC LIMIT 1) last_message_at FROM conversations c JOIN profiles p1 ON p1.user_id=c.requester_user_id JOIN profiles p2 ON p2.user_id=c.recipient_user_id JOIN users u1 ON u1.user_id=c.requester_user_id JOIN users u2 ON u2.user_id=c.recipient_user_id WHERE (c.requester_user_id=? OR c.recipient_user_id=?) AND c.status!='blocked' AND u1.status='active' AND u2.status='active' AND NOT EXISTS(SELECT 1 FROM user_blocks WHERE (blocker_user_id=c.requester_user_id AND blocked_user_id=c.recipient_user_id) OR (blocker_user_id=c.recipient_user_id AND blocked_user_id=c.requester_user_id)) ORDER BY c.updated_at DESC LIMIT 100`).bind(userId,userId).all<any>();return r.results;
}
export async function messages(env:Env,userId:number,id:number,before?:number){
  await conversationAccess(env,userId,id);
  const cursor=before===undefined?Number.MAX_SAFE_INTEGER:before;if(!Number.isSafeInteger(cursor)||cursor<1)throw new Error("Choose a valid message history cursor.");
  const r=await env.DB.prepare("SELECT message_id,sender_user_id,body,created_at FROM messages WHERE conversation_id=? AND status='delivered' AND message_id<? ORDER BY message_id DESC LIMIT 100").bind(id,cursor).all<any>();return r.results.reverse();
}

export async function createPrayerCircle(env:Env,userId:number,input:any){
  const name=clamp(input.name,100),description=clamp(input.description,1000);if(name.length<2||description.length<10)throw new Error("Prayer Circle name and purpose are required.");
  const mod=moderateText(name+"\n"+description,"group",env.COMMUNITY_BLOCKED_WORDS);if(["block","hold"].includes(mod.decision))throw new Error("Prayer Circle violates Community Standards.");
  const max=Math.min(Math.max(Number(input.maxMembers)||20,3),50),visibility=input.visibility==="public"?"public":"private";
  const row=await env.DB.prepare("INSERT INTO prayer_circles(name,description,owner_user_id,max_members,visibility) VALUES(?,?,?,?,?) RETURNING circle_id").bind(name,description,userId,max,visibility).first<any>();
  await env.DB.prepare("INSERT INTO prayer_circle_members(circle_id,user_id,role) VALUES(?,?,'owner')").bind(row.circle_id,userId).run();return {circleId:Number(row.circle_id)};
}
export async function listPrayerCircles(env:Env,userId:number|null){
  const r=userId?await env.DB.prepare(`SELECT pc.*,CASE WHEN pm.user_id IS NULL THEN 0 ELSE 1 END joined FROM prayer_circles pc LEFT JOIN prayer_circle_members pm ON pm.circle_id=pc.circle_id AND pm.user_id=? WHERE pc.status='active' AND (pc.visibility='public' OR pm.user_id IS NOT NULL) ORDER BY pc.created_at DESC`).bind(userId).all<any>()
  :await env.DB.prepare("SELECT *,0 joined FROM prayer_circles WHERE status='active' AND visibility='public' ORDER BY created_at DESC").all<any>();return r.results;
}

export async function today(env:Env){
  const date=new Date().toISOString().slice(0,10);const existing=await env.DB.prepare("SELECT * FROM daily_spiritual_prompts WHERE prompt_date=?").bind(date).first<any>();
  if(existing)return existing;
  return {prompt_date:date,scripture_reference:"John 15:5",scripture_text:"",reflection:"Abide in Christ today. Let your words, choices and service flow from fellowship with Him.",prayer_focus:"Ask God for a heart that loves Christ and strengthens another believer.",action_challenge:"Encourage one person in Christ today.",mission_focus:"Pray for someone who does not yet know Jesus."};
}
export async function saveCheckin(env:Env,userId:number,input:any){
  const date=new Date().toISOString().slice(0,10);await env.DB.prepare(`INSERT INTO growth_checkins(user_id,checkin_date,bible_read,prayed,encouraged_someone,shared_christ,challenge_completed,reflection) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id,checkin_date) DO UPDATE SET bible_read=excluded.bible_read,prayed=excluded.prayed,encouraged_someone=excluded.encouraged_someone,shared_christ=excluded.shared_christ,challenge_completed=excluded.challenge_completed,reflection=excluded.reflection`)
    .bind(userId,date,input.bibleRead?1:0,input.prayed?1:0,input.encouragedSomeone?1:0,input.sharedChrist?1:0,input.challengeCompleted?1:0,clamp(input.reflection,1000)||null).run();return {date};
}
export async function growthSummary(env:Env,userId:number){
  const [r,l]=await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) days,SUM(bible_read) bible_days,SUM(prayed) prayer_days,SUM(encouraged_someone) encouragements,SUM(shared_christ) evangelism_actions,SUM(challenge_completed) challenges FROM growth_checkins WHERE user_id=?`).bind(userId).first<any>(),
    env.DB.prepare("SELECT COUNT(*) c FROM discipleship_progress WHERE user_id=?").bind(userId).first<any>()
  ]);
  return {...(r||{}),lessons_completed:Number(l?.c||0)};
}
export async function salvationDecision(env:Env,userId:number|null,input:any){
  const types=["give_life_to_christ","rededication","need_prayer","questions_about_christ"];if(!types.includes(input.decisionType))throw new Error("Choose how we can help you.");
  const row=await env.DB.prepare("INSERT INTO salvation_decisions(user_id,name,email,country,decision_type,message) VALUES(?,?,?,?,?,?) RETURNING decision_id")
    .bind(userId,clamp(input.name,120)||null,clamp(input.email,160)||null,clamp(input.country,80)||null,input.decisionType,clamp(input.message,2000)||null).first<any>();return {decisionId:Number(row?.decision_id)};
}

export async function notify(env:Env,userId:number,kind:string,title:string,body:string,href:string){
  await env.DB.prepare("INSERT INTO notifications(user_id,kind,title,body,href) VALUES(?,?,?,?,?)").bind(userId,kind,title,body,href).run();
}
export async function notifications(env:Env,userId:number){
  const r=await env.DB.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY notification_id DESC LIMIT 100").bind(userId).all<any>();return r.results;
}
export async function unreadNotificationCount(env:Env,userId:number){return Number((await env.DB.prepare("SELECT COUNT(*) count FROM notifications WHERE user_id=? AND read_at IS NULL").bind(userId).first<any>())?.count||0);}
export async function readNotifications(env:Env,userId:number,ids:any){
 if(!Array.isArray(ids)||ids.length>100||ids.some(x=>!Number.isSafeInteger(x)||x<1))throw new Error("Choose valid notifications.");
 const unique=[...new Set(ids)];if(unique.length)await env.DB.prepare("UPDATE notifications SET read_at=datetime('now') WHERE user_id=? AND read_at IS NULL AND notification_id IN ("+unique.map(()=>'?').join(',')+")").bind(userId,...unique).run();
 return {unreadCount:await unreadNotificationCount(env,userId)};
}
export async function moderationQueue(env:Env){
  const r=await env.DB.prepare("SELECT * FROM moderation_events WHERE decision IN ('hold','block') ORDER BY moderation_event_id DESC LIMIT 200").all<any>();return r.results;
}


export async function discoverProfiles(env:Env,viewerId:number|null,q:string,country:string){
  const term=clamp(q,80),ctry=clamp(country,80);const like="%"+term.replace(/[%_]/g,"")+"%";
  const rows=await env.DB.prepare(`SELECT p.user_id,p.display_name,p.bio,
    CASE WHEN p.location_visibility='public' THEN p.country ELSE NULL END country,
    CASE WHEN p.location_visibility='public' THEN p.city ELSE NULL END city,
    p.ministry_calling,p.global_connections_visibility,
    (SELECT COUNT(*) FROM global_connections c WHERE c.target_type='profile' AND c.target_id=p.user_id) connection_count
    FROM profiles p JOIN users u ON u.user_id=p.user_id
    WHERE u.status='active'
      AND (?='' OR p.display_name LIKE ? OR COALESCE(p.bio,'') LIKE ? OR COALESCE(p.ministry_calling,'') LIKE ?)
      AND (?='' OR (p.location_visibility='public' AND p.country=?))
      AND (? IS NULL OR NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=? AND b.blocked_user_id=p.user_id) OR (b.blocker_user_id=p.user_id AND b.blocked_user_id=?)))
    ORDER BY p.display_name LIMIT 80`)
    .bind(term,like,like,like,ctry,ctry,viewerId,viewerId,viewerId).all<any>();
  return rows.results.map((r:any)=>({...r,connection_count:r.global_connections_visibility==="public"?Number(r.connection_count):null}));
}

export async function addComment(env:Env,userId:number,postId:number,bodyRaw:string,parentCommentId?:number){
  const body=clamp(bodyRaw,2500);if(!body)throw new Error("Reply cannot be empty.");
  const post=(await feed(env,userId,1,{postId}))[0];if(!post)throw new Error("Post is unavailable.");
  if(parentCommentId){const parent=await env.DB.prepare("SELECT 1 FROM comments WHERE comment_id=? AND post_id=? AND status='active'").bind(parentCommentId,postId).first();if(!parent)throw new Error("Reply target is unavailable.");}
  const mod=moderateText(body,"post",env.COMMUNITY_BLOCKED_WORDS);if(mod.decision==="block"){await recordModeration(env,userId,"post",null,mod,"comment");throw new Error("This reply cannot be published because it violates Christian Community Standards.");}
  const status=mod.decision==="hold"?"held":"active",state=mod.decision==="hold"?"held":mod.decision==="warn"?"warned":"allowed";
  const row=await env.DB.prepare("INSERT INTO comments(post_id,user_id,parent_comment_id,body,status,moderation_state) VALUES(?,?,?,?,?,?) RETURNING comment_id")
    .bind(postId,userId,parentCommentId||null,body,status,state).first<any>();
  if(mod.decision!=="allow")await recordModeration(env,userId,"post",Number(row?.comment_id)||null,mod,"comment");
  return {commentId:Number(row?.comment_id),status};
}
export async function listComments(env:Env,postId:number,userId:number|null=null){
  if(!(await feed(env,userId,1,{postId})).length)throw new Error("Post is unavailable.");
  const r=await env.DB.prepare(`SELECT c.comment_id,c.parent_comment_id,c.body,c.created_at,p.display_name
    FROM comments c JOIN profiles p ON p.user_id=c.user_id JOIN users u ON u.user_id=c.user_id WHERE c.post_id=? AND c.status='active' AND u.status='active' AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=? AND b.blocked_user_id=c.user_id) OR (b.blocker_user_id=c.user_id AND b.blocked_user_id=?)) ORDER BY c.created_at LIMIT 200`).bind(postId,userId,userId).all<any>();return r.results;
}

export async function blockMember(env:Env,userId:number,targetId:number){
  if(userId===targetId)throw new Error("You cannot block yourself.");
  await env.DB.prepare("INSERT OR IGNORE INTO user_blocks(blocker_user_id,blocked_user_id) VALUES(?,?)").bind(userId,targetId).run();
  await env.DB.prepare("DELETE FROM global_connections WHERE target_type='profile' AND ((user_id=? AND target_id=?) OR (user_id=? AND target_id=?))").bind(userId,targetId,targetId,userId).run();
  await env.DB.prepare("UPDATE conversations SET status='blocked',updated_at=datetime('now') WHERE (requester_user_id=? AND recipient_user_id=?) OR (requester_user_id=? AND recipient_user_id=?)").bind(userId,targetId,targetId,userId).run();
  return {blocked:true};
}
export async function reportContent(env:Env,userId:number,input:any){
  const types=["post","comment","message","profile","space","group"],reasons=REPORT_REASONS.map(([id])=>id);
  if(!types.includes(input.targetType)||!reasons.includes(input.reason)||(!Number.isSafeInteger(Number(input.targetId))||Number(input.targetId)<1))throw new Error("Choose a valid report reason.");
  const targetId=Number(input.targetId);let accessible=false;
  if(input.targetType==="post")accessible=!!(await feed(env,userId,1,{postId:targetId}))[0];
  if(input.targetType==="comment"){const comment=await env.DB.prepare("SELECT post_id FROM comments WHERE comment_id=? AND status='active'").bind(targetId).first<any>();accessible=!!comment&&!!(await feed(env,userId,1,{postId:comment.post_id}))[0];}
  if(input.targetType==="message")accessible=!!await env.DB.prepare("SELECT 1 FROM messages m JOIN conversations c ON c.conversation_id=m.conversation_id WHERE m.message_id=? AND m.status='delivered' AND (c.requester_user_id=? OR c.recipient_user_id=?)").bind(targetId,userId,userId).first();
  if(input.targetType==="profile")accessible=!!await publicProfile(env,targetId,userId);
  if(input.targetType==="space")accessible=!!await env.DB.prepare("SELECT 1 FROM spaces WHERE space_id=? AND status='active'").bind(targetId).first();
  if(input.targetType==="group")accessible=!!await env.DB.prepare("SELECT 1 FROM groups g WHERE group_id=? AND status='active' AND (visibility='public' OR EXISTS(SELECT 1 FROM group_members gm WHERE gm.group_id=g.group_id AND gm.user_id=? AND gm.join_status='approved'))").bind(targetId,userId).first();
  if(!accessible)throw new Error("This content is unavailable.");
  return routeReport(env,userId,input);
}
export async function reportQueue(env:Env){
  const r=await env.DB.prepare(`SELECT cr.*,COALESCE(p.author_user_id,co.user_id,m.sender_user_id,sp.owner_user_id,g.owner_user_id,pr.user_id) subject_user_id,COALESCE(p.title,sp.name,g.name,pr.display_name) target_title,COALESCE(p.body,co.body,m.body,sp.description,g.description,pr.bio) target_body,p.video_url
    FROM content_reports cr LEFT JOIN posts p ON cr.target_type='post' AND p.post_id=cr.target_id
    LEFT JOIN comments co ON cr.target_type='comment' AND co.comment_id=cr.target_id
    LEFT JOIN messages m ON cr.target_type='message' AND m.message_id=cr.target_id
    LEFT JOIN spaces sp ON cr.target_type='space' AND sp.space_id=cr.target_id
    LEFT JOIN groups g ON cr.target_type='group' AND g.group_id=cr.target_id
    LEFT JOIN profiles pr ON cr.target_type='profile' AND pr.user_id=cr.target_id
    WHERE cr.status='pending' ORDER BY cr.report_id DESC LIMIT 200`).all<any>();return r.results;
}

export async function reviewPostReport(env:Env,moderator:SessionUser,id:number,input:any){
  if(!["moderator","administrator","owner"].includes(moderator.role))throw Object.assign(new Error("Moderator access required."),{status:403});
  const action=input.action,note=clamp(input.note,500);if(!["dismiss","remove","escalate"].includes(action)||note.length<10)throw new Error("Choose an action and explain the decision in at least 10 characters.");
  const report=await env.DB.prepare("SELECT * FROM content_reports WHERE report_id=? AND status='pending'").bind(id).first<any>();
  if(!report)throw new Error("Pending report not found.");
  if(action==="escalate"){
    await env.DB.batch([env.DB.prepare("UPDATE content_reports SET status='reviewed' WHERE report_id=? AND status='pending'").bind(id),env.DB.prepare("INSERT INTO safety_requests(user_id,kind,details) VALUES(?,'safety',?)").bind(report.reporter_user_id,"Escalated report #"+id+" for "+report.target_type+" #"+report.target_id+". "+report.reason+". "+note),env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,'escalate',?,?,?)").bind(moderator.userId,report.target_type,report.target_id,note)]);return {status:'reviewed'};
  }
  const targets:Record<string,[string,string,string,string]>={post:["posts","post_id","author_user_id","removed"],comment:["comments","comment_id","user_id","removed"],message:["messages","message_id","sender_user_id","removed"],profile:["users","user_id","user_id","suspended"],space:["spaces","space_id","owner_user_id","suspended"],group:["groups","group_id","owner_user_id","suspended"]};
  const [table,key,ownerColumn,status]=targets[report.target_type];
  const target=await env.DB.prepare(`SELECT ${ownerColumn} owner FROM ${table} WHERE ${key}=?`).bind(report.target_id).first<any>();
  if(action==="remove"&&report.target_type==="profile")throw new Error("Profile restrictions require a separate account-safety review. Record the concern in an administrator safety request.");
  const queries=[env.DB.prepare("UPDATE content_reports SET status=? WHERE report_id=? AND status='pending'").bind(action==="remove"?"actioned":"dismissed",id)];
  if(action==="remove")queries.push(env.DB.prepare(`UPDATE ${table} SET status=? WHERE ${key}=?`).bind(status,report.target_id));
  queries.push(env.DB.prepare("INSERT INTO safety_audit(actor_user_id,action,target_type,target_id,reason) VALUES(?,?,?,?,?)").bind(moderator.userId,action,report.target_type,report.target_id,note));
  queries.push(env.DB.prepare("INSERT INTO safety_decisions(report_id,subject_user_id,actor_user_id,action,reason) VALUES(?,?,?,?,?)").bind(id,target?.owner||null,moderator.userId,action,note));
  await env.DB.batch(queries);
  if(target?.owner&&action==="remove")await notify(env,target.owner,"moderation","Content restricted",note+" You can request review in Safety & privacy.","/safety.html");
  return {status:action==="remove"?"actioned":"dismissed"};
}

export async function addPrayerItem(env:Env,userId:number,input:any){
  const title=clamp(input.title,160),requestText=clamp(input.requestText,3000);if(!title||requestText.length<3)throw new Error("Prayer title and request are required.");
  const mod=moderateText(title+"\n"+requestText,"post",env.COMMUNITY_BLOCKED_WORDS);if(['block','hold'].includes(mod.decision)){await recordModeration(env,userId,'post',null,mod);throw new Error('Prayer request text needs Community Standards review. Please revise it.');}
  let circleId:number|null=input.circleId?Number(input.circleId):null;if(circleId){const member=await env.DB.prepare("SELECT 1 FROM prayer_circle_members WHERE circle_id=? AND user_id=?").bind(circleId,userId).first();if(!member)throw new Error("Join this Prayer Circle first.");}
  const visibility=["community","connections","circle","private_ministry"].includes(input.visibility)?input.visibility:"private_ministry";if(visibility==="circle"&&!circleId)throw new Error("Choose a Prayer Circle before posting to it.");
  const row=await env.DB.prepare(env.COMMUNITY_CARE==='enabled'?"INSERT INTO prayer_items(circle_id,user_id,title,request_text,visibility,care_reminder_at) VALUES(?,?,?,?,?,?) RETURNING prayer_item_id":"INSERT INTO prayer_items(circle_id,user_id,title,request_text,visibility) VALUES(?,?,?,?,?) RETURNING prayer_item_id")
    .bind(circleId,userId,title,requestText,visibility,...(env.COMMUNITY_CARE==='enabled'?[input.followup===true?Date.now()+3*86400000:null]:[])).first<any>();return {prayerItemId:Number(row?.prayer_item_id)};
}
export async function listPrayerItems(env:Env,userId:number|null){
  const r=await env.DB.prepare(`SELECT pi.prayer_item_id,pi.circle_id,pi.user_id,pi.title,pi.request_text,pi.visibility,pi.answered,pi.answer_testimony,pi.created_at,p.display_name
    FROM prayer_items pi JOIN profiles p ON p.user_id=pi.user_id
    JOIN users u ON u.user_id=pi.user_id
    WHERE u.status='active' AND NOT EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id=? AND b.blocked_user_id=pi.user_id) OR (b.blocker_user_id=pi.user_id AND b.blocked_user_id=?)) AND (pi.visibility='community'
      OR (? IS NOT NULL AND pi.user_id=?)
      OR (? IS NOT NULL AND pi.visibility='connections' AND EXISTS(SELECT 1 FROM global_connections c WHERE c.user_id=pi.user_id AND c.target_type='profile' AND c.target_id=?))
      OR (? IS NOT NULL AND pi.visibility='circle' AND EXISTS(SELECT 1 FROM prayer_circle_members pcm WHERE pcm.circle_id=pi.circle_id AND pcm.user_id=?))
     ) ORDER BY pi.created_at DESC LIMIT 100`).bind(userId,userId,userId,userId,userId,userId,userId,userId).all<any>();return r.results;
}
export async function markPrayerAnswered(env:Env,userId:number,id:number,testimony:string){
  const r=await env.DB.prepare("UPDATE prayer_items SET answered=1,answer_testimony=? WHERE prayer_item_id=? AND user_id=?").bind(clamp(testimony,2500)||null,id,userId).run();
  if(!r.meta.changes)throw new Error("Prayer item not found.");return {answered:true};
}

export async function registerMedia(env:Env,userId:number,input:any):Promise<any>{
  throw new Error("Community file uploads are disabled. Use a Design Card or a video link.");
}
export async function uploadMedia(env:Env,userId:number,id:number,request:Request):Promise<any>{
  throw new Error("Community file uploads are disabled. Use a Design Card or a video link.");
}
export async function reviewMedia(env:Env,id:number,approve:boolean,reason:string){
  const row=await env.DB.prepare("SELECT object_key FROM community_media WHERE media_id=?").bind(id).first<any>();if(!row)throw new Error("Media not found.");
  await env.DB.prepare("UPDATE community_media SET safety_status=?,safety_reason=?,reviewed_at=datetime('now') WHERE media_id=?").bind(approve?"approved":"rejected",clamp(reason,500)||null,id).run();
  if(!approve){await env.MEDIA.delete(row.object_key);await env.DB.prepare("UPDATE community_media SET upload_status='failed' WHERE media_id=?").bind(id).run();}return {status:approve?"approved":"rejected"};
}


export async function joinPrayerCircle(env:Env,userId:number,circleId:number){
  const c=await env.DB.prepare("SELECT max_members,visibility,status FROM prayer_circles WHERE circle_id=?").bind(circleId).first<any>();if(!c||c.status!=="active")throw new Error("Prayer Circle not found.");
  const count=await env.DB.prepare("SELECT COUNT(*) c FROM prayer_circle_members WHERE circle_id=?").bind(circleId).first<any>();if(Number(count?.c||0)>=Number(c.max_members))throw new Error("This Prayer Circle is full.");
  if(c.visibility!=="public")throw new Error("Private Prayer Circles require an invitation from a leader.");
  await env.DB.prepare("INSERT OR IGNORE INTO prayer_circle_members(circle_id,user_id,role) VALUES(?,?,'member')").bind(circleId,userId).run();return {joined:true};
}
export async function listMyMedia(env:Env,userId:number){
  const r=await env.DB.prepare("SELECT media_id,file_name,mime_type,media_type,size_bytes,upload_status,safety_status,safety_reason,created_at FROM community_media WHERE owner_user_id=? ORDER BY media_id DESC LIMIT 100").bind(userId).all<any>();return r.results;
}
export async function pendingMedia(env:Env){
  const r=await env.DB.prepare("SELECT cm.media_id,cm.file_name,cm.mime_type,cm.media_type,cm.size_bytes,cm.created_at,p.display_name FROM community_media cm JOIN profiles p ON p.user_id=cm.owner_user_id WHERE cm.upload_status='uploaded' AND cm.safety_status='pending_review' ORDER BY cm.media_id LIMIT 100").all<any>();return r.results;
}
export async function publicMedia(_env:Env,_id:number):Promise<{body:ReadableStream;mimeType:string;etag?:string}|null>{return null;}

export async function discipleshipTracks(env:Env,userId:number|null){
  const tracks=await env.DB.prepare("SELECT track_id,slug,title,description,audience FROM discipleship_tracks WHERE active=1 ORDER BY sort_order,track_id").all<any>();
  const out=[] as any[];
  for(const t of tracks.results){
    const lessons=await env.DB.prepare(`SELECT l.lesson_id,l.lesson_order,l.title,l.scripture_reference,l.lesson_text,l.reflection_question,l.action_step,
      CASE WHEN ? IS NOT NULL AND EXISTS(SELECT 1 FROM discipleship_progress p WHERE p.user_id=? AND p.lesson_id=l.lesson_id) THEN 1 ELSE 0 END completed
      FROM discipleship_lessons l WHERE l.track_id=? ORDER BY l.lesson_order`).bind(userId,userId,t.track_id).all<any>();
    out.push({...t,lessons:lessons.results});
  }
  return out;
}
export async function completeLesson(env:Env,userId:number,lessonId:number,reflection:string){
  const lesson=await env.DB.prepare("SELECT lesson_id FROM discipleship_lessons WHERE lesson_id=?").bind(lessonId).first();if(!lesson)throw new Error("Lesson not found.");
  await env.DB.prepare(`INSERT INTO discipleship_progress(user_id,lesson_id,reflection) VALUES(?,?,?) ON CONFLICT(user_id,lesson_id) DO UPDATE SET reflection=excluded.reflection,completed_at=datetime('now')`)
    .bind(userId,lessonId,clamp(reflection,1200)||null).run();return {completed:true};
}

export async function savePost(env:Env,userId:number,postId:number){
  if(!(await feed(env,userId,1,{postId})).length)throw new Error('Post unavailable.');
  const old=await env.DB.prepare('SELECT 1 FROM saved_posts WHERE user_id=? AND post_id=?').bind(userId,postId).first();
  if(old)await env.DB.prepare('DELETE FROM saved_posts WHERE user_id=? AND post_id=?').bind(userId,postId).run();
  else await env.DB.prepare('INSERT OR IGNORE INTO saved_posts(user_id,post_id) VALUES(?,?)').bind(userId,postId).run();return {saved:!old};
}


