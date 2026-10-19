import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

export interface CreateGroupInput {
  creatorId: number;
  name: string;
  description: string;
  purposeStatement: string;
  type: string;
  visibility: "public" | "private" | "hidden";
}

export async function createGroup(env: Env, input: CreateGroupInput): Promise<ServiceResult<{ groupId: number }>> {
  // "Every group must clearly state its Christian purpose" — enforced here,
  // not just documented in the wireframe. No group can be created without it.
  if (!input.purposeStatement || input.purposeStatement.length < 10) {
    return { success: false, error: "Please describe this group's Christian purpose (at least 10 characters)." };
  }
  if (typeof input.name!=="string" || input.purposeStatement.length > MAX_LENGTHS.postBody || input.name.length > MAX_LENGTHS.shortText) {
    return { success: false, error: `Purpose statement must be under ${MAX_LENGTHS.postBody} characters and name under ${MAX_LENGTHS.shortText}.` };
  }
  if (!input.name) return { success: false, error: "Group name is required." };
  if (!["public", "private", "hidden"].includes(input.visibility)) {
    return { success: false, error: "Invalid privacy level." };
  }

  const row = await env.DB.prepare(
    `INSERT INTO groups (name, description, purpose_statement, type, visibility, creator_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active') RETURNING group_id`
  )
    .bind(input.name, input.description ?? "", input.purposeStatement, input.type, input.visibility, input.creatorId)
    .first<{ group_id: number }>();

  if (!row) return { success: false, error: "Failed to create group." };

  // Creator becomes Owner automatically.
  await env.DB.prepare(
    `INSERT INTO group_members (group_id, user_id, role, join_status) VALUES (?, ?, 'owner', 'approved')`
  )
    .bind(row.group_id, input.creatorId)
    .run();

  return { success: true, data: { groupId: row.group_id } };
}

export async function listGroupDirectory(env: Env, typeFilter?: string): Promise<any[]> {
  // HIDDEN groups NEVER appear here — this is the enforcement of the
  // "not listed anywhere" rule from the Module 5 wireframe, not just a UI
  // convention that a client could bypass by calling the API directly.
  const query = typeFilter
    ? `SELECT group_id, name, description, type, visibility FROM groups WHERE status = 'active' AND visibility IN ('public','private') AND type = ? ORDER BY name`
    : `SELECT group_id, name, description, type, visibility FROM groups WHERE status = 'active' AND visibility IN ('public','private') ORDER BY name LIMIT 100`;
  const stmt = typeFilter ? env.DB.prepare(query).bind(typeFilter) : env.DB.prepare(query).bind();
  const result = await (stmt as any).all();
  return result.results as any[];
}

export async function requestOrJoinGroup(env: Env, groupId: number, userId: number): Promise<ServiceResult<{ status: "approved" | "requested" }>> {
  const group = await env.DB.prepare("SELECT group_id, visibility FROM groups WHERE group_id = ? AND status = 'active'").bind(groupId).first<any>();
  if (!group) return { success: false, error: "Group not found." };

  const existing = await env.DB.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND join_status='approved'").bind(groupId, userId).first();
  if (existing) return { success: false, error: "You are already a member of this group." };

  if (group.visibility === "public") {
    await env.DB.prepare("INSERT INTO group_members (group_id, user_id, role, join_status) VALUES (?, ?, 'member', 'approved')")
      .bind(groupId, userId)
      .run();
    return { success: true, data: { status: "approved" } };
  }

  // private or hidden — requires owner approval
  const existingRequest = await env.DB.prepare("SELECT 1 FROM group_join_requests WHERE group_id = ? AND user_id = ? AND status = 'pending'")
    .bind(groupId, userId)
    .first();
  if (existingRequest) return { success: false, error: "You already have a pending request to join this group." };

  await env.DB.prepare("INSERT INTO group_join_requests (group_id, user_id, status) VALUES (?, ?, 'pending')").bind(groupId, userId).run();
  return { success: true, data: { status: "requested" } };
}

/** MUST be called only from a route verifying the caller is Owner/Administrator of THIS group. */
export async function approveJoinRequest(env: Env, requestId: number, approverId: number): Promise<ServiceResult> {
  const request = await env.DB.prepare(
    `SELECT r.group_id, r.user_id
     FROM group_join_requests r
     JOIN group_members gm ON gm.group_id = r.group_id AND gm.user_id = ?
     WHERE r.request_id = ? AND r.status = 'pending'
       AND gm.join_status = 'approved'
       AND gm.role IN ('owner', 'administrator')`
  )
    .bind(approverId, requestId)
    .first<{ group_id: number; user_id: number }>();
  if (!request) return { success: false, error: "Request not found or you do not manage this group." };

  await env.DB.prepare("UPDATE group_join_requests SET status = 'approved' WHERE request_id = ? AND status = 'pending'")
    .bind(requestId)
    .run();
  await env.DB.prepare("INSERT INTO group_members (group_id, user_id, role, join_status) VALUES (?, ?, 'member', 'approved')")
    .bind(request.group_id, request.user_id)
    .run();

  return { success: true };
}

export interface GroupPostInput {
  groupId: number;
  userId: number;
  postType: "discussion" | "prayer" | "announcement";
  title?: string;
  body: string;
  anonymous: boolean;
}

export async function createGroupPost(env: Env, input: GroupPostInput): Promise<ServiceResult<{ postId: number }>> {
  const membership = await env.DB.prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND join_status='approved' AND EXISTS(SELECT 1 FROM groups WHERE groups.group_id=group_members.group_id AND groups.status='active')")
    .bind(input.groupId, input.userId)
    .first();
  if (!membership) return { success: false, error: "You must be a member of this group to post." };
  if (!input.body) return { success: false, error: "Post body is required." };
  if (input.body.length > MAX_LENGTHS.postBody) {
    return { success: false, error: `Post must be under ${MAX_LENGTHS.postBody} characters.` };
  }

  const row = await env.DB.prepare(
    `INSERT INTO group_posts (group_id, user_id, post_type, title, body, anonymous, status) VALUES (?, ?, ?, ?, ?, ?, 'active') RETURNING post_id`
  )
    .bind(input.groupId, input.userId, input.postType, input.title ?? null, input.body, input.anonymous ? 1 : 0)
    .first<{ post_id: number }>();

  return row ? { success: true, data: { postId: row.post_id } } : { success: false, error: "Failed to create post." };
}

// ---------- Polls ----------
export async function createPoll(env: Env, groupId: number, createdBy: number, question: string, options: string[]): Promise<ServiceResult<{ pollId: number }>> {
  const membership = await env.DB.prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ? AND join_status='approved' AND EXISTS(SELECT 1 FROM groups WHERE groups.group_id=group_members.group_id AND groups.status='active')").bind(groupId, createdBy).first();
  if (!membership) return { success: false, error: "You must be a member to create a poll." };
  if (!question || options.length < 2) return { success: false, error: "A poll needs a question and at least 2 options." };

  const row = await env.DB.prepare("INSERT INTO polls (group_id, created_by, question, status) VALUES (?, ?, ?, 'open') RETURNING poll_id")
    .bind(groupId, createdBy, question)
    .first<{ poll_id: number }>();
  if (!row) return { success: false, error: "Failed to create poll." };

  for (const opt of options) {
    await env.DB.prepare("INSERT INTO poll_options (poll_id, option_text) VALUES (?, ?)").bind(row.poll_id, opt).run();
  }
  return { success: true, data: { pollId: row.poll_id } };
}

export async function voteOnPoll(env: Env, pollId: number, userId: number, optionId: number): Promise<ServiceResult> {
  const poll = await env.DB.prepare("SELECT status FROM polls WHERE poll_id = ?").bind(pollId).first<{ status: string }>();
  if (!poll || poll.status !== "open") return { success: false, error: "This poll is not open for voting." };

  const membership=await env.DB.prepare("SELECT 1 FROM polls p JOIN groups g ON g.group_id=p.group_id JOIN group_members m ON m.group_id=g.group_id WHERE p.poll_id=? AND g.status='active' AND m.user_id=? AND m.join_status='approved'").bind(pollId,userId).first();
  if(!membership)return {success:false,error:'Approved group membership is required to vote.'};
  const option = await env.DB.prepare("SELECT option_id FROM poll_options WHERE option_id = ? AND poll_id = ?").bind(optionId, pollId).first();
  if (!option) return { success: false, error: "Invalid option for this poll." };

  // one vote per user per poll — enforced by the composite PK in poll_votes;
  // re-voting updates the choice rather than erroring.
  const existing = await env.DB.prepare("SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?").bind(pollId, userId).first();
  if (existing) {
    await env.DB.prepare("UPDATE poll_votes SET option_id = ?, voted_at = datetime('now') WHERE poll_id = ? AND user_id = ?").bind(optionId, pollId, userId).run();
  } else {
    await env.DB.prepare("INSERT INTO poll_votes (poll_id, user_id, option_id) VALUES (?, ?, ?)").bind(pollId, userId, optionId).run();
  }
  return { success: true };
}

/**
 * FIX (Phase 2 whole-backend sweep): this previously had NO access check at
 * all -- poll results for a PRIVATE or HIDDEN group's poll were reachable
 * by anyone who knew or guessed the poll_id, bypassing the entire "hidden
 * groups are never listed anywhere" privacy model Module 5 was built
 * around. Now requires the requester to either be a member of the poll's
 * group, or the group to be public.
 */
export async function getPollResults(env: Env, pollId: number, requesterId: number | null): Promise<{ success: boolean; error?: string; options?: any[] }> {
  const poll = await env.DB.prepare("SELECT group_id FROM polls WHERE poll_id = ?").bind(pollId).first<{ group_id: number }>();
  if (!poll) return { success: false, error: "Poll not found." };

  const group = await env.DB.prepare("SELECT visibility FROM groups WHERE group_id = ? AND status = 'active'").bind(poll.group_id).first<{ visibility: string }>();
  if (!group) return { success: false, error: "Poll not found." };

  if (group.visibility !== "public") {
    if (!requesterId) return { success: false, error: "You must be a member to view this poll." };
    const membership = await env.DB.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND join_status='approved'").bind(poll.group_id, requesterId).first();
    if (!membership) return { success: false, error: "You must be a member to view this poll." };
  }

  const options = await env.DB.prepare(
    `SELECT po.option_id, po.option_text, COUNT(pv.poll_id) as votes
     FROM poll_options po LEFT JOIN poll_votes pv ON pv.option_id = po.option_id
     WHERE po.poll_id = ? GROUP BY po.option_id`
  )
    .bind(pollId)
    .all();
  return { success: true, options: options.results as any[] };
}

/**
 * FIX (Phase 2 whole-backend sweep): there was no way to list a group's
 * posts at all -- createGroupPost existed with zero corresponding read
 * function. Reuses the same visibility/membership check as
 * getPollResults, for consistency.
 */
export async function listGroupPosts(env: Env, groupId: number, requesterId: number | null, limit = 50, before?: string): Promise<{ success: boolean; error?: string; posts?: any[] }> {
  const group = await env.DB.prepare("SELECT visibility FROM groups WHERE group_id = ? AND status = 'active'").bind(groupId).first<{ visibility: string }>();
  if (!group) return { success: false, error: "Group not found." };

  if (group.visibility !== "public") {
    if (!requesterId) return { success: false, error: "You must be a member to view this group." };
    const membership = await env.DB.prepare("SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ? AND join_status='approved'").bind(groupId, requesterId).first();
    if (!membership) return { success: false, error: "You must be a member to view this group." };
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const posts = before
    ? await env.DB.prepare(
        `SELECT p.post_id, p.post_type, p.title, p.body, p.anonymous, p.pinned, p.created_at, u.name
         FROM group_posts p JOIN users u ON u.user_id = p.user_id
         WHERE p.group_id = ? AND p.status = 'active' AND p.created_at < ?
         ORDER BY p.pinned DESC, p.created_at DESC LIMIT ?`
      ).bind(groupId, before, safeLimit).all()
    : await env.DB.prepare(
        `SELECT p.post_id, p.post_type, p.title, p.body, p.anonymous, p.pinned, p.created_at, u.name
         FROM group_posts p JOIN users u ON u.user_id = p.user_id
         WHERE p.group_id = ? AND p.status = 'active'
         ORDER BY p.pinned DESC, p.created_at DESC LIMIT ?`
      ).bind(groupId, safeLimit).all();

  return {
    success: true,
    posts: (posts.results as any[]).map((r) => ({
      postId: r.post_id, postType: r.post_type, title: r.title, body: r.body,
      displayName: r.anonymous ? null : r.name, pinned: !!r.pinned, createdAt: r.created_at,
    })),
  };
}

