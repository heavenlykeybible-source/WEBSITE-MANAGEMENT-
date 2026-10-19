import type { Env } from "./auth-service";
import type { ServiceResult } from "./prayer-service";
import { MAX_LENGTHS } from "../config/security-config";

/**
 * CONSTRAINT CARRIED FORWARD FROM BIBLE-SOURCE-RECOMMENDATION.md:
 * no real KJV text has been approved for import. Every verse row is
 * is_placeholder=1 until the Project Lead approves a source. This service
 * honestly flags that in every response — it does not pretend placeholder
 * text is Scripture.
 */

export async function getChapter(env: Env, bookName: string, chapterNumber: number): Promise<any | null> {
  const chapter = await env.DB.prepare(
    `SELECT c.chapter_id, c.chapter_number, b.name as book_name
     FROM bible_chapters c JOIN bible_books b ON b.book_id = c.book_id
     WHERE b.name = ? AND c.chapter_number = ?`
  )
    .bind(bookName, chapterNumber)
    .first<any>();
  if (!chapter) return null;

  const verses = await env.DB.prepare(
    `SELECT verse_id, verse_number, text_kjv, is_placeholder FROM bible_verses WHERE chapter_id = ? ORDER BY verse_number`
  )
    .bind(chapter.chapter_id)
    .all();

  const versesArr = verses.results as any[];
  const anyPlaceholder = versesArr.some((v) => v.is_placeholder);

  return {
    book: chapter.book_name,
    chapterId: chapter.chapter_id,
    chapter: chapter.chapter_number,
    verses: versesArr.map((v) => ({ verseId: v.verse_id, number: v.verse_number, text: v.text_kjv, isPlaceholder: !!v.is_placeholder })),
    // Honest, structural warning — not buried in a footnote. A client UI
    // should show this prominently, per the platform's own transparency rule.
    warning: anyPlaceholder ? "This chapter contains placeholder text pending an approved KJV source. Do not treat as Scripture." : null,
  };
}

export async function addBookmark(env: Env, userId: number, verseId: number): Promise<ServiceResult> {
  const verse = await env.DB.prepare("SELECT verse_id FROM bible_verses WHERE verse_id = ?").bind(verseId).first();
  if (!verse) return { success: false, error: "Verse not found." };
  await env.DB.prepare("INSERT INTO bookmarks (user_id, verse_id) VALUES (?, ?)").bind(userId, verseId).run();
  return { success: true };
}

export async function listBookmarks(env: Env, userId: number): Promise<any[]> {
  const result = await env.DB.prepare(
    `SELECT bm.bookmark_id, bm.verse_id, v.verse_number, v.is_placeholder, c.chapter_number, b.name as book_name
     FROM bookmarks bm
     JOIN bible_verses v ON v.verse_id = bm.verse_id
     JOIN bible_chapters c ON c.chapter_id = v.chapter_id
     JOIN bible_books b ON b.book_id = c.book_id
     WHERE bm.user_id = ? ORDER BY bm.created_at DESC`
  )
    .bind(userId)
    .all();
  return result.results as any[];
}

export async function addHighlight(env: Env, userId: number, verseId: number, color = "gold"): Promise<ServiceResult> {
  const verse = await env.DB.prepare("SELECT verse_id FROM bible_verses WHERE verse_id = ?").bind(verseId).first();
  if (!verse) return { success: false, error: "Verse not found." };
  await env.DB.prepare("INSERT INTO highlights (user_id, verse_id, color) VALUES (?, ?, ?)").bind(userId, verseId, color).run();
  return { success: true };
}

export async function addNote(env: Env, userId: number, verseId: number, noteText: string): Promise<ServiceResult<{ noteId: number }>> {
  if (!noteText || noteText.length < 1) return { success: false, error: "Note cannot be empty." };
  if (noteText.length > MAX_LENGTHS.standardText) {
    return { success: false, error: `Note must be under ${MAX_LENGTHS.standardText} characters.` };
  }
  const verse = await env.DB.prepare("SELECT verse_id FROM bible_verses WHERE verse_id = ?").bind(verseId).first();
  if (!verse) return { success: false, error: "Verse not found." };

  const row = await env.DB.prepare("INSERT INTO bible_notes (user_id, verse_id, note_text) VALUES (?, ?, ?) RETURNING note_id")
    .bind(userId, verseId, noteText)
    .first<{ note_id: number }>();
  return row ? { success: true, data: { noteId: row.note_id } } : { success: false, error: "Failed to save note." };
}

export async function updateReadingPlanProgress(env: Env, userId: number, planId: number, currentDay: number): Promise<ServiceResult> {
  const existing = await env.DB.prepare("SELECT progress_id FROM reading_plan_progress WHERE user_id = ? AND plan_id = ?")
    .bind(userId, planId)
    .first<{ progress_id: number }>();

  if (existing) {
    await env.DB.prepare("UPDATE reading_plan_progress SET current_day = ? WHERE progress_id = ?").bind(currentDay, existing.progress_id).run();
  } else {
    await env.DB.prepare("INSERT INTO reading_plan_progress (plan_id, user_id, current_day) VALUES (?, ?, ?)").bind(planId, userId, currentDay).run();
  }
  return { success: true };
}

export async function listAudioBible(env: Env, chapterId?: number): Promise<any[]> {
  const query = chapterId
    ? `SELECT a.audio_id, a.chapter_id, a.duration_seconds, a.source_label, a.media_id,
              m.title, m.file_type, m.storage_status, m.publish_status
         FROM audio_bible a
         JOIN media m ON m.media_id = a.media_id
        WHERE a.chapter_id = ? AND m.file_type = 'audio'
          AND m.storage_status = 'stored' AND m.publish_status = 'published'
          AND m.license_type IN ('public_domain','ministry_owned','licensed')
        ORDER BY a.audio_id DESC LIMIT 20`
    : `SELECT a.audio_id, a.chapter_id, a.duration_seconds, a.source_label, a.media_id,
              m.title, m.file_type, m.storage_status, m.publish_status
         FROM audio_bible a
         JOIN media m ON m.media_id = a.media_id
        WHERE m.file_type = 'audio'
          AND m.storage_status = 'stored' AND m.publish_status = 'published'
          AND m.license_type IN ('public_domain','ministry_owned','licensed')
        ORDER BY a.audio_id DESC LIMIT 50`;
  const result = chapterId ? await env.DB.prepare(query).bind(chapterId).all() : await env.DB.prepare(query).all();
  return (result.results as any[]).map((r) => ({
    audioId: r.audio_id,
    chapterId: r.chapter_id,
    durationSeconds: r.duration_seconds,
    sourceLabel: r.source_label,
    mediaId: r.media_id,
    playbackUrl: `/api/media/${r.media_id}/object`,
  }));
}

export async function attachAudioBible(env: Env, chapterId: number, mediaId: number, durationSeconds?: number, sourceLabel?: string): Promise<ServiceResult<{ audioId: number }>> {
  const chapter = await env.DB.prepare("SELECT chapter_id FROM bible_chapters WHERE chapter_id = ?").bind(chapterId).first();
  if (!chapter) return { success: false, error: "Bible chapter not found." };
  const media = await env.DB.prepare(
    `SELECT media_id FROM media WHERE media_id = ? AND file_type = 'audio' AND storage_status = 'stored'
      AND publish_status = 'published' AND license_type IN ('public_domain','ministry_owned','licensed')`
  ).bind(mediaId).first();
  if (!media) return { success: false, error: "Approved stored audio media is required." };
  const row = await env.DB.prepare(
    `INSERT INTO audio_bible (chapter_id, media_id, duration_seconds, source_label) VALUES (?, ?, ?, ?) RETURNING audio_id`
  ).bind(chapterId, mediaId, durationSeconds ?? null, sourceLabel ?? "Heavenly Key Ministry Library").first<{ audio_id: number }>();
  return row ? { success: true, data: { audioId: row.audio_id } } : { success: false, error: "Failed to attach audio Bible." };
}
