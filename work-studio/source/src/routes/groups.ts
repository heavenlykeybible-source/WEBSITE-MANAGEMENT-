import { requireAuth } from "../middleware/session";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Groups from "../services/groups-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const unauthorized = () => json({ error: { code: "unauthorized", message: "Please log in." } }, 401);

export async function handleCreateGroup(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<any>();
  const result = await Groups.createGroup(env, { ...body, creatorId: userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListGroups(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? undefined;
  const items = await Groups.listGroupDirectory(env, type);
  return json({ success: true, items });
}

export async function handleJoinGroup(request: Request, env: Env, groupId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const result = await Groups.requestOrJoinGroup(env, groupId, userId);
  return result.success ? json({ success: true, ...result.data }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleCreateGroupPost(request: Request, env: Env, groupId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<any>();
  const result = await Groups.createGroupPost(env, { ...body, groupId, userId });
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleCreatePoll(request: Request, env: Env, groupId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ question: string; options: string[] }>();
  const result = await Groups.createPoll(env, groupId, userId, body.question, body.options);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleVotePoll(request: Request, env: Env, pollId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ optionId: number }>();
  const result = await Groups.voteOnPoll(env, pollId, userId, body.optionId);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handlePollResults(request: Request, env: Env, pollId: number): Promise<Response> {
  const userId = await requireAuth(request, env); // nullable -- public groups' polls are viewable without login
  const result = await Groups.getPollResults(env, pollId, userId);
  return result.success ? json({ success: true, options: result.options }) : json({ error: { code: "forbidden", message: result.error } }, 403);
}

export async function handleApproveJoinRequest(request: Request, env: Env, requestId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const result = await Groups.approveJoinRequest(env, requestId, userId);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListGroupPosts(request: Request, env: Env, groupId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;
  const before = url.searchParams.get("before") ?? undefined;
  const result = await Groups.listGroupPosts(env, groupId, userId, limit, before);
  return result.success ? json({ success: true, posts: result.posts }) : json({ error: { code: "forbidden", message: result.error } }, 403);
}
