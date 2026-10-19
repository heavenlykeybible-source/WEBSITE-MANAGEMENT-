import { requireAuth } from "../middleware/session";
import { requireMinimumRole } from "../middleware/rbac";
import { withSecurityHeaders } from "./auth";
import type { Env } from "../services/auth-service";
import * as Bible from "../services/bible-service";
import * as Hymns from "../services/hymns-service";
import * as Devotional from "../services/devotional-service";

function json(data: unknown, status = 200): Response {
  return withSecurityHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }));
}
const unauthorized = () => json({ error: { code: "unauthorized", message: "Please log in." } }, 401);

export async function handleListAudioBible(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const chapterIdRaw = url.searchParams.get("chapterId");
  const chapterId = chapterIdRaw ? Number(chapterIdRaw) : undefined;
  if (chapterIdRaw && (!Number.isInteger(chapterId) || chapterId! < 1)) return json({ error: { code: "invalid", message: "Invalid chapterId." } }, 400);
  const items = await Bible.listAudioBible(env, chapterId);
  return json({ success: true, items });
}

export async function handleGetChapter(_request: Request, env: Env, book: string, chapter: number): Promise<Response> {
  const result = await Bible.getChapter(env, book, chapter);
  return result ? json({ success: true, ...result }) : json({ error: { code: "not_found", message: "Chapter not found." } }, 404);
}

export async function handleAddBookmark(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ verseId: number }>();
  const result = await Bible.addBookmark(env, userId, body.verseId);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListBookmarks(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const items = await Bible.listBookmarks(env, userId);
  return json({ success: true, items });
}

export async function handleAddHighlight(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ verseId: number; color?: string }>();
  const result = await Bible.addHighlight(env, userId, body.verseId, body.color);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleAddNote(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ verseId: number; noteText: string }>();
  const result = await Bible.addNote(env, userId, body.verseId, body.noteText);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleListHymns(_request: Request, env: Env): Promise<Response> {
  const items = await Hymns.listPublicHymnsWithPlayback(env);
  return json({ success: true, items });
}

export async function handleGetHymn(_request: Request, env: Env, hymnId: number): Promise<Response> {
  const hymn = await Hymns.getHymn(env, hymnId);
  return hymn ? json({ success: true, hymn }) : json({ error: { code: "not_found", message: "Hymn not available." } }, 404);
}

export async function handleAttachAudioBible(request: Request, env: Env): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const body = await request.json<{ chapterId: number; mediaId: number; durationSeconds?: number; sourceLabel?: string }>();
  const result = await Bible.attachAudioBible(env, body.chapterId, body.mediaId, body.durationSeconds, body.sourceLabel);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleAttachHymnMedia(request: Request, env: Env, hymnId: number): Promise<Response> {
  const actor = await requireMinimumRole(request, env, "Administrator");
  if (!actor) return json({ error: { code: "forbidden", message: "Administrator access required." } }, 403);
  const body = await request.json<{ mediaId: number }>();
  const result = await Hymns.attachHymnMedia(env, hymnId, body.mediaId);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleToggleFavouriteHymn(request: Request, env: Env, hymnId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const result = await Hymns.toggleFavourite(env, userId, hymnId);
  return result.success ? json({ success: true, ...result.data }) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleTodaysVerse(_request: Request, env: Env): Promise<Response> {
  const content = await Devotional.getTodaysDailyContent(env, "verse_of_day");
  return json({ success: true, content });
}

export async function handleTodaysDevotional(_request: Request, env: Env): Promise<Response> {
  const content = await Devotional.getTodaysDailyContent(env, "devotional");
  return json({ success: true, content });
}

export async function handleKingdomKeys(_request: Request, env: Env): Promise<Response> {
  const content = await Devotional.getCurrentKingdomKeys(env);
  return json({ success: true, content });
}

export async function handleFaithChallenge(_request: Request, env: Env): Promise<Response> {
  const challenge = await Devotional.getCurrentFaithChallenge(env);
  if (!challenge) return json({ success: true, challenge: null, responses: [] });
  const responses = await Devotional.listFaithChallengeResponses(env, challenge.challenge_id);
  return json({ success: true, challenge, responses });
}

export async function handleFaithChallengeRespond(request: Request, env: Env, challengeId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ responseText: string; anonymous?: boolean }>();
  const result = await Devotional.submitFaithChallengeResponse(env, challengeId, userId, body.responseText, !!body.anonymous);
  return result.success ? json({ success: true, ...result.data }, 201) : json({ error: { code: "invalid", message: result.error } }, 400);
}

export async function handleUpdateReadingProgress(request: Request, env: Env): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  const body = await request.json<{ planId: number; currentDay: number }>();
  const result = await Bible.updateReadingPlanProgress(env, userId, body.planId, body.currentDay);
  return result.success ? json({ success: true }) : json({ error: { code: "invalid" } }, 400);
}

export async function handleRecordHymnPlayed(request: Request, env: Env, hymnId: number): Promise<Response> {
  const userId = await requireAuth(request, env);
  if (!userId) return unauthorized();
  await Hymns.recordPlayed(env, userId, hymnId);
  return json({ success: true });
}


export async function handleWebsiteVerseOfDay(_request: Request, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT v.text_kjv AS text, b.name AS book, c.chapter_number AS chapter,
            v.verse_number AS verse, v.is_placeholder
       FROM daily_spiritual_content d
       JOIN bible_verses v ON v.verse_id = d.verse_id
       JOIN bible_chapters c ON c.chapter_id = v.chapter_id
       JOIN bible_books b ON b.book_id = c.book_id
      WHERE d.content_type = 'verse_of_day'
        AND d.scheduled_date = ?
      LIMIT 1`
  ).bind(new Date().toISOString().slice(0, 10)).first<{
    text: string;
    book: string;
    chapter: number;
    verse: number;
    is_placeholder: number;
  }>();

  if (!row || row.is_placeholder) return json({ success: true, items: [] });
  return json({
    success: true,
    items: [{
      text: row.text,
      reference: `${row.book} ${row.chapter}:${row.verse} (KJV)`,
    }],
  });
}

export async function handleWebsiteMemoryVerse(_request: Request, env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT v.text_kjv AS text, b.name AS book, c.chapter_number AS chapter,
            v.verse_number AS verse, v.is_placeholder
       FROM daily_spiritual_content d
       JOIN bible_verses v ON v.verse_id = d.verse_id
       JOIN bible_chapters c ON c.chapter_id = v.chapter_id
       JOIN bible_books b ON b.book_id = c.book_id
      WHERE d.content_type = 'memory_verse'
        AND d.scheduled_date = ?
      LIMIT 1`
  ).bind(new Date().toISOString().slice(0, 10)).first<{
    text: string;
    book: string;
    chapter: number;
    verse: number;
    is_placeholder: number;
  }>();

  if (!row || row.is_placeholder) return json({ success: true, item: null });
  return json({
    success: true,
    item: {
      text: row.text,
      reference: `${row.book} ${row.chapter}:${row.verse} (KJV)`,
    },
  });
}

export async function handleWebsiteDevotional(_request: Request, env: Env): Promise<Response> {
  const content = await Devotional.getTodaysDailyContent(env, "devotional");
  if (!content?.body) return json({ success: true, items: [] });
  return json({
    success: true,
    items: [{
      title: "Daily Devotional",
      excerpt: content.body,
      body: content.body,
      scheduledDate: content.scheduled_date,
    }],
  });
}
