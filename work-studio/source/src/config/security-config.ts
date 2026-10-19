/**
 * Security Configuration — single source of truth for cryptographic parameters.
 * Per Project Lead request: these values should be frozen in one place,
 * not scattered through the codebase where they'd be easy to change
 * inconsistently or forget about during a review.
 */

export const PASSWORD_HASHING = {
  algorithm: "PBKDF2" as const,
  hash: "SHA-256" as const,
  iterations: 100_000,
  saltLengthBytes: 16,
  derivedKeyLengthBits: 256,
};

export const SESSION = {
  /** Session tokens are opaque random IDs looked up in KV — NOT self-contained
   * JWTs — specifically so that logout can actually revoke a session server-side.
   * See session.ts for the corrected implementation. */
  idLengthBytes: 32,
  defaultTtlSeconds: 3600, // 1 hour
  cookieName: "hk_session",
};

export const RATE_LIMITS = {
  login: { maxAttempts: 5, windowSeconds: 900 },
  register: { maxAttempts: 5, windowSeconds: 900 },
};

export const ACCOUNT_LOCKOUT = {
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 15,
};

/**
 * Maximum text field lengths — Adversarial Audit Finding D2.
 * Before this, only password (auth-service) and prayer title
 * (prayer-service) had any upper bound; a 1MB string was accepted
 * without error into a testimony story during adversarial testing.
 * One shared source of truth, not a limit re-invented per field.
 */
export const MAX_LENGTHS = {
  shortText: 200,      // titles, subjects, category-like fields
  standardText: 5000,  // testimony stories, counselling messages, lesson reflections
  postBody: 3000,       // discussion/group post bodies, comments
};
