import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

export async function followUser(env: Env, followerId: number, followedId: number): Promise<ServiceResult> {
  if (followerId === followedId) return { success: false, error: "You cannot follow yourself." };

  const blocked = await env.DB.prepare(
    "SELECT 1 FROM follow_blocks WHERE blocker_user_id = ? AND blocked_user_id = ?"
  )
    .bind(followedId, followerId)
    .first();
  if (blocked) return { success: false, error: "Unable to follow this member." };

  await env.DB.prepare(
    "INSERT OR IGNORE INTO follows (follower_user_id, followed_user_id) VALUES (?, ?)"
  )
    .bind(followerId, followedId)
    .run();

  return { success: true };
}

export async function unfollowUser(env: Env, followerId: number, followedId: number): Promise<ServiceResult> {
  await env.DB.prepare("DELETE FROM follows WHERE follower_user_id = ? AND followed_user_id = ?")
    .bind(followerId, followedId)
    .run();
  return { success: true };
}

export async function blockUser(env: Env, blockerId: number, blockedId: number): Promise<ServiceResult> {
  await env.DB.prepare("INSERT OR IGNORE INTO follow_blocks (blocker_user_id, blocked_user_id) VALUES (?, ?)")
    .bind(blockerId, blockedId)
    .run();
  // Blocking also removes any existing follow relationship in either direction.
  await env.DB.prepare("DELETE FROM follows WHERE (follower_user_id = ? AND followed_user_id = ?) OR (follower_user_id = ? AND followed_user_id = ?)")
    .bind(blockerId, blockedId, blockedId, blockerId)
    .run();
  return { success: true };
}
