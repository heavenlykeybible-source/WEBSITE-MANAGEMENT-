import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";

export async function listLearningPaths(env: Env): Promise<any[]> {
  const result = await env.DB.prepare("SELECT path_id, title, description, audience FROM learning_paths WHERE status = 'active' ORDER BY title").all();
  return result.results as any[];
}

export async function getLesson(env: Env, lessonId: number): Promise<any | null> {
  const lesson = await env.DB.prepare(
    `SELECT lesson_id, course_id, title, memory_verse_ref, lesson_objectives, main_reading_ref,
            scripture_explanation, supporting_scriptures, reflection_questions, practical_application,
            prayer_points, difficulty, estimated_minutes, prerequisite_lesson_id
     FROM lessons WHERE lesson_id = ?`
  )
    .bind(lessonId)
    .first<any>();
  if (!lesson) return null;

  // Enforce prerequisites at the read layer, not just as a UI suggestion.
  if (lesson.prerequisite_lesson_id) {
    lesson.hasPrerequisite = true;
  }

  const quiz = await env.DB.prepare("SELECT question_id, question_text, options FROM lesson_quiz_questions WHERE lesson_id = ?").bind(lessonId).all();
  lesson.quiz = quiz.results;
  return lesson;
}

export async function submitQuizAnswer(env: Env, userId: number, lessonId: number, score: number): Promise<ServiceResult<{ resultId: number }>> {
  const lesson = await env.DB.prepare("SELECT lesson_id FROM lessons WHERE lesson_id = ?").bind(lessonId).first();
  if (!lesson) return { success: false, error: "Lesson not found." };

  const row = await env.DB.prepare(
    "INSERT INTO lesson_quiz_results (lesson_id, user_id, score) VALUES (?, ?, ?) RETURNING result_id"
  )
    .bind(lessonId, userId, score)
    .first<{ result_id: number }>();
  return row ? { success: true, data: { resultId: row.result_id } } : { success: false, error: "Failed to record quiz result." };
}

export async function updateCourseProgress(env: Env, userId: number, courseId: number, lessonId: number, completionStatus: string): Promise<ServiceResult> {
  const existing = await env.DB.prepare("SELECT progress_id FROM course_progress WHERE user_id = ? AND course_id = ? AND lesson_id = ?")
    .bind(userId, courseId, lessonId)
    .first<{ progress_id: number }>();

  if (existing) {
    await env.DB.prepare("UPDATE course_progress SET completion_status = ? WHERE progress_id = ?").bind(completionStatus, existing.progress_id).run();
  } else {
    await env.DB.prepare("INSERT INTO course_progress (course_id, lesson_id, user_id, completion_status) VALUES (?, ?, ?, ?)")
      .bind(courseId, lessonId, userId, completionStatus)
      .run();
  }
  return { success: true };
}

/**
 * "My Spiritual Growth" — PRIVATE BY DEFAULT (Volume 3 §14, frozen by ACR-009).
 * This function takes ONLY the authenticated caller's own userId — there is
 * no parameter or code path here that lets it be called for someone else's
 * data. That is the enforcement of the privacy rule, not a comment about it.
 */
export async function getMyGrowthDashboard(env: Env, userId: number): Promise<any> {
  const lessonsCompleted = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM course_progress WHERE user_id = ? AND completion_status = 'completed'"
  )
    .bind(userId)
    .first<{ c: number }>();

  const quizzesTaken = await env.DB.prepare("SELECT COUNT(*) as c FROM lesson_quiz_results WHERE user_id = ?").bind(userId).first<{ c: number }>();

  const readingProgress = await env.DB.prepare(
    "SELECT plan_id, current_day FROM reading_plan_progress WHERE user_id = ? ORDER BY progress_id DESC LIMIT 1"
  )
    .bind(userId)
    .first<any>();

  // DELIBERATELY NO RANKING, NO PERCENTILE, NO "compared to other members"
  // field anywhere in this response — the anti-gamification rule (Volume 4
  // §13, frozen by ACR-009) is enforced by simply never computing or
  // exposing a comparative metric, not by hiding one that exists.
  return {
    lessonsCompleted: lessonsCompleted?.c ?? 0,
    quizzesTaken: quizzesTaken?.c ?? 0,
    currentReadingPlan: readingProgress ?? null,
  };
}

// ---------- Ministry Analytics — aggregate ONLY, never drill-down to an individual (Volume 3 §14) ----------
export async function getMinistryDiscipleshipAnalytics(env: Env): Promise<any> {
  const totalCompletions = await env.DB.prepare("SELECT COUNT(*) as c FROM course_progress WHERE completion_status = 'completed'").first<{ c: number }>();
  const avgQuizScore = await env.DB.prepare("SELECT AVG(score) as avg FROM lesson_quiz_results").first<{ avg: number | null }>();

  // Note: this function returns aggregates only. There is no function
  // anywhere in this service that lets a caller pass an arbitrary userId
  // to view someone else's individual growth data through an "analytics"
  // route — that would be exactly the privacy violation ACR-016 corrected.
  return {
    totalLessonCompletionsPlatformWide: totalCompletions?.c ?? 0,
    averageQuizScore: avgQuizScore?.avg ?? null,
  };
}
