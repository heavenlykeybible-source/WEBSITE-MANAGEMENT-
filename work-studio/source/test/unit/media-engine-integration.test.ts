import { describe, expect, it, vi, afterEach } from "vitest";
import { proxyToMediaEngine } from "../../src/services/integrations/media-engine-proxy";
import { encryptField } from "../../src/services/encryption-service";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Media Engine proxy authorization", () => {
  it("propagates the authenticated administrator role name, not numeric level", async () => {
    const request = new Request("https://api.heavenlykey.org/api/admin/media-engine/status", {
      method: "GET",
    }) as Request & { __hkActor?: { userId:number; roleName:string; level:number } };
    request.__hkActor = { userId: 42, roleName: "Administrator", level: 3 };

    let authHeader = "";
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      authHeader = headers.get("Authorization") ?? "";
      return Response.json({ ok: true });
    }));

    const env = {
      MEDIA_ENGINE_URL: "https://media.example.test",
      MEDIA_ENGINE_SHARED_SECRET: "test-shared-secret",
    } as any;

    const response = await proxyToMediaEngine(
      request,
      env,
      "/api/media-engine/status",
    );

    expect(response.status).toBe(200);
    expect(authHeader.startsWith("Bearer ")).toBe(true);

    const token = authHeader.slice("Bearer ".length);
    const encoded = token.split(".")[0];
    const payload = JSON.parse(atob(encoded));
    expect(payload.sub).toBe("42");
    expect(payload.role).toBe("Administrator");
  });

  it("rejects a non-admin actor before calling the Media Engine", async () => {
    const request = new Request("https://api.heavenlykey.org/api/admin/media-engine/status", {
      method: "GET",
    }) as Request & { __hkActor?: { userId:number; roleName:string; level:number } };
    request.__hkActor = { userId: 7, roleName: "Member", level: 1 };

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyToMediaEngine(
      request,
      {
        MEDIA_ENGINE_URL: "https://media.example.test",
        MEDIA_ENGINE_SHARED_SECRET: "test-shared-secret",
      } as any,
      "/api/media-engine/status",
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Encryption configuration", () => {
  it("rejects an invalid AES-256 key with a clear error", async () => {
    await expect(encryptField("secret", "not-a-valid-key")).rejects.toThrow(
      "ENCRYPTION_KEY must be a 64-character hexadecimal AES-256 key.",
    );
  });
});
