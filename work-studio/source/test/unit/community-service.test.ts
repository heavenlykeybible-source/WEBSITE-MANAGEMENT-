/**
 * Unit tests for Module 2 (Community) business logic.
 * Per Handbook §7 — re-verified in sandbox against a D1-shaped SQLite
 * adapter, same discipline as Module 1.
 */
import { describe, it, expect } from "vitest";
import { createPrayerRequest, listPrayerFeed, addPrayerResponse } from "../../src/services/prayer-service";
import { submitTestimony, listApprovedTestimonies, approveTestimony, featureTestimonyOnHomepage } from "../../src/services/testimony-service";
import { askQuestion, submitAnswer, markRecommendedAnswer, getQuestionWithAnswers } from "../../src/services/qa-service";
import { createDiscussion, listDiscussions } from "../../src/services/discussion-service";
import { addComment, toggleReaction } from "../../src/services/comments-reactions-service";
import { followUser, blockUser } from "../../src/services/follow-service";

// NOTE: full DB-backed test execution happens via the sandbox verification
// script (see conversation record), which applies the real migrations and
// exercises these exact functions against a real SQLite engine. These
// vitest specs are the CI-facing equivalent, to run in the real Workers
// test runtime once Cloudflare access exists.

describe("Prayer Centre", () => {
  it("rejects a request with no title", async () => {
    const result = await createPrayerRequest({} as any, { userId: 1, categoryId: 1, title: "", requestText: "x", visibility: "public", anonymous: false });
    expect(result.success).toBe(false);
  });
});

describe("Comments & Reactions content_type validation", () => {
  it("rejects an invalid content_type", async () => {
    const result = await addComment({} as any, 1, "not_a_real_type", 5, "hello");
    expect(result.success).toBe(false);
  });
});

describe("Follow", () => {
  it("rejects following yourself without touching the database", async () => {
    const result = await followUser({} as any, 5, 5);
    expect(result.success).toBe(false);
  });
});

