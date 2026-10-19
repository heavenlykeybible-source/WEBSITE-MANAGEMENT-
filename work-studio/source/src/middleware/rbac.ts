import type { Env } from "../services/auth-service";
import { requireAuth } from "./session";

/**
 * Role hierarchy, per Volume 3 §2 and Module 6's frozen permissions table.
 * Higher number = more authority. Used for the least-privilege rule:
 * an actor may only act on a target whose role level is strictly lower
 * than their own — never a peer, never someone above them.
 */
export const ROLE_LEVEL: Record<string, number> = {
  Guest: 0,
  Member: 1,
  Moderator: 2,
  Administrator: 3,
  "Deputy Super Administrator": 4,
  "Super Administrator": 5,
};

export async function getUserRole(env: Env, userId: number): Promise<{ roleName: string; level: number } | null> {
  const row = await env.DB.prepare(
    `SELECT r.role_name FROM users u JOIN roles r ON r.role_id = u.role_id WHERE u.user_id = ? AND u.status = 'active'`
  )
    .bind(userId)
    .first<{ role_name: string }>();
  if (!row) return null;
  return { roleName: row.role_name, level: ROLE_LEVEL[row.role_name] ?? 0 };
}

/** Returns the authenticated user's ID + role if they meet the minimum role, otherwise null. */
export async function requireMinimumRole(
  request: Request,
  env: Env,
  minimumRole: string
): Promise<{ userId: number; roleName: string; level: number } | null> {
  const userId = await requireAuth(request, env);
  if (!userId) return null;
  const role = await getUserRole(env, userId);
  if (!role) return null;
  const minLevel = ROLE_LEVEL[minimumRole] ?? Infinity;
  if (role.level < minLevel) return null;
  return { userId, ...role };
}

/**
 * THE least-privilege rule, enforced as code, not just documented.
 * A Moderator may act on a Member, never on a Moderator or Administrator+.
 * This function is the single place that decision is made — every action
 * route calls this, rather than each route re-implementing the check
 * (Authoritative Ownership: this function owns "can actor act on target").
 */
export async function canActorActOnTarget(env: Env, actorUserId: number, targetUserId: number): Promise<boolean> {
  const actor = await getUserRole(env, actorUserId);
  const target = await getUserRole(env, targetUserId);
  if (!actor || !target) return false;
  return actor.level > target.level;
}


export function getRoleLevel(roleName:string): number {
  return ROLE_LEVEL[roleName] ?? -1;
}
