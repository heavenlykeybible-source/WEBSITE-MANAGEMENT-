/**
 * Unit tests for auth-service.ts business logic.
 * Per Implementation Handbook §7: "Tested means... a test file that would
 * fail if someone broke it" — not "it ran once in a browser."
 *
 * NOTE: these tests were re-verified directly in the development sandbox
 * using a D1-shaped SQLite adapter and an in-memory KV shim (no network
 * access was available to run the real `wrangler`/`vitest` toolchain).
 * That is a meaningful partial verification of the actual logic — it is
 * NOT the same as running against real Cloudflare D1/KV, which still
 * needs to happen before this module is considered "Tested" per the
 * project's own PROJECT-CHECKLIST.md definition.
 */
import { describe, it, expect } from "vitest";
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  createSession,
  getSessionUserId,
  revokeSession,
  revokeAllUserSessions,
} from "../../src/services/auth-service";

describe("password hashing", () => {
  it("produces a hash that verifies correctly with the right password", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("correcthorsebattery1", salt, "test-pepper");
    const valid = await verifyPassword("correcthorsebattery1", salt, "test-pepper", hash);
    expect(valid).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const salt = generateSalt();
    const hash = await hashPassword("correcthorsebattery1", salt, "test-pepper");
    const valid = await verifyPassword("wrongpassword1", salt, "test-pepper", hash);
    expect(valid).toBe(false);
  });

  it("produces different hashes for the same password with different salts", async () => {
    const hash1 = await hashPassword("samepassword1", generateSalt(), "test-pepper");
    const hash2 = await hashPassword("samepassword1", generateSalt(), "test-pepper");
    expect(hash1).not.toBe(hash2);
  });

  it("generates a unique salt each time", () => {
    expect(generateSalt()).not.toBe(generateSalt());
  });
});

describe("sessions (KV-backed, genuinely revocable)", () => {
  it("resolves an active session to the correct userId", async () => {
    const env = { SESSIONS_KV: makeTestKv() } as any;
    const sessionId = await createSession(env, 77, 3600);
    expect(await getSessionUserId(env, sessionId)).toBe(77);
  });

  it("makes a session unusable immediately after logout/revoke — the original gap this project caught and fixed", async () => {
    const env = { SESSIONS_KV: makeTestKv() } as any;
    const sessionId = await createSession(env, 77, 3600);
    await revokeSession(env, sessionId);
    expect(await getSessionUserId(env, sessionId)).toBeNull();
  });

  it("invalidates every older session after a security epoch change", async () => {
    const env = { SESSIONS_KV: makeTestKv() } as any;
    const first = await createSession(env, 77, 3600);
    const second = await createSession(env, 77, 3600);
    await revokeAllUserSessions(env, 77);
    expect(await getSessionUserId(env, first)).toBeNull();
    expect(await getSessionUserId(env, second)).toBeNull();
    const replacement = await createSession(env, 77, 3600);
    expect(await getSessionUserId(env, replacement)).toBe(77);
  });

  it("rejects an expired session", async () => {
    const env = { SESSIONS_KV: makeTestKv() } as any;
    const sessionId = await createSession(env, 77, -1);
    expect(await getSessionUserId(env, sessionId)).toBeNull();
  });

  it("rejects a session ID that was never issued", async () => {
    const env = { SESSIONS_KV: makeTestKv() } as any;
    expect(await getSessionUserId(env, "never-issued")).toBeNull();
  });
});

function makeTestKv() {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}
