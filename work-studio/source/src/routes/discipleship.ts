import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Discipleship from "../services/discipleship-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const unauthorized = () => json({ error: { code: "unauthorized", message: "Please log in." } }, 401);

export async function handleListLearningPaths(_request: Request, env: Env): Promise<Response> {
  const items = await Discipleship.listLearningPaths(env);
  return json({ success: true, items });
}

export async function handleGetLesson(_request: Request, env: Env, lessonId: number): Promise<Response> {
  const lesson = await Discipleship.getLesson(env, lessonId);
  return lesson ? json({ success: true, lesson }) : json({ error: { code: "not_found", message: "Lesson not found." } }, 404);
}

export async function handleSubmitQuiz(request: Request, env: Env, lessonId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ score: number }>();
  const result = await Discipleship.submitQuizAnswer(env, userId, lessonId, body.score);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleUpdateProgress(request: Request, env: Env, lessonId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ courseId: number; completionStatus: string }>();
  const result = await Discipleship.updateCourseProgress(env, userId, body.courseId, lessonId, body.completionStatus);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

/** Always uses the authenticated caller's own ID — never accepts a target userId parameter (Volume 3 §14). */
export async function handleMyGrowthDashboard(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const data = await Discipleship.getMyGrowthDashboard(env, userId);
  return json({ success: true, data });
}

export async function handleMinistryDiscipleshipAnalytics(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator"); // Leadership-tier, per ACR-016
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const data = await Discipleship.getMinistryDiscipleshipAnalytics(env);
  return json({ success: true, data });
}
