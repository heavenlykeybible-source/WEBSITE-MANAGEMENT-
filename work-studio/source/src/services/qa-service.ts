import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

export interface QuestionInput {
  userId: number;
  categoryId: number;
  questionText: string;
  anonymous: boolean;
}

export async function askQuestion(env: Env, input: QuestionInput): Promise<ServiceResult<{ questionId: number }>> {
  if (!input.questionText || input.questionText.length < 5) {
    return { success: false, error: "Please write out your question." };
  }
  if (input.questionText.length > MAX_LENGTHS.postBody) {
    return { success: false, error: `Question must be under ${MAX_LENGTHS.postBody} characters.` };
  }
  const category = await env.DB.prepare("SELECT category_id FROM categories WHERE category_id = ? AND module = 'question'")
    .bind(input.categoryId)
    .first();
  if (!category) return { success: false, error: "Invalid category." };

  const row = await env.DB.prepare(
    `INSERT INTO questions (user_id, category_id, anonymous, question_text, status) VALUES (?, ?, ?, ?, 'active') RETURNING question_id`
  )
    .bind(input.userId, input.categoryId, input.anonymous ? 1 : 0, input.questionText)
    .first<{ question_id: number }>();

  if (!row) return { success: false, error: "Failed to submit question." };
  return { success: true, data: { questionId: row.question_id } };
}

export async function submitAnswer(env: Env, questionId: number, userId: number, answerText: string): Promise<ServiceResult<{ answerId: number }>> {
  if (!answerText || answerText.length < 3) {
    return { success: false, error: "Please write out your answer." };
  }
  if (answerText.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Answer must be under ${MAX_LENGTHS.standardText} characters.` };
  }
  const question = await env.DB.prepare("SELECT question_id FROM questions WHERE question_id = ? AND status = 'active'")
    .bind(questionId)
    .first();
  if (!question) return { success: false, error: "Question not found." };

  const row = await env.DB.prepare(
    `INSERT INTO answers (question_id, user_id, answer_text) VALUES (?, ?, ?) RETURNING answer_id`
  )
    .bind(questionId, userId, answerText)
    .first<{ answer_id: number }>();

  if (!row) return { success: false, error: "Failed to submit answer." };
  return { success: true, data: { answerId: row.answer_id } };
}

/** Moderator-only — marks the Recommended Biblical Answer. Voting never overrides this (Module 2 wireframe §4). */
export async function markRecommendedAnswer(env: Env, answerId: number): Promise<ServiceResult> {
  const answer = await env.DB.prepare("SELECT question_id FROM answers WHERE answer_id = ?").bind(answerId).first<{ question_id: number }>();
  if (!answer) return { success: false, error: "Answer not found." };

  // Only one Recommended Answer per question — clear any prior one first.
  await env.DB.prepare("UPDATE answers SET recommended = 0 WHERE question_id = ?").bind(answer.question_id).run();
  await env.DB.prepare("UPDATE answers SET recommended = 1 WHERE answer_id = ?").bind(answerId).run();

  return { success: true };
}

export async function getQuestionWithAnswers(env: Env, questionId: number): Promise<any | null> {
  const exists = await env.DB.prepare("SELECT question_id FROM questions WHERE question_id = ? AND status = 'active'").bind(questionId).first();
  if (!exists) return null;

  // Increment BEFORE re-selecting, so the returned view count reflects this
  // very view — the previous version read the stale pre-increment value
  // (caught by sandbox execution, not code review; see test suite).
  await env.DB.prepare("UPDATE questions SET views = views + 1 WHERE question_id = ?").bind(questionId).run();

  const question = await env.DB.prepare(
    `SELECT q.question_id, q.question_text, q.category_id, q.anonymous, q.views, u.name
     FROM questions q JOIN users u ON u.user_id = q.user_id WHERE q.question_id = ?`
  )
    .bind(questionId)
    .first<any>();
  if (!question) return null;

  const answers = await env.DB.prepare(
    `SELECT a.answer_id, a.answer_text, a.recommended, a.votes, u.name
     FROM answers a JOIN users u ON u.user_id = a.user_id
     WHERE a.question_id = ? ORDER BY a.recommended DESC, a.votes DESC`
  )
    .bind(questionId)
    .all();

  return {
    questionId: question.question_id,
    questionText: question.question_text,
    categoryId: question.category_id,
    displayName: question.anonymous ? null : question.name,
    views: question.views,
    answers: (answers.results as any[]).map((a) => ({
      answerId: a.answer_id,
      answerText: a.answer_text,
      recommended: !!a.recommended,
      votes: a.votes,
      authorName: a.name,
    })),
  };
}

