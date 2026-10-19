import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("public intake contract", () => {
  it("keeps anonymous website intake encrypted and high-privilege on read", async () => {
    const src = await readFile(join(process.cwd(), "src/routes/public-site.ts"), "utf8");
    expect(src).toContain("encryptField(");
    expect(src).toContain('requireMinimumRole(request, env, "Deputy Super Administrator")');
    expect(src).toContain('"prayer" | "testimony"');
  });

  it("maps the salvation website fields into the internal encrypted follow-up model", async () => {
    const src = await readFile(join(process.cwd(), "src/routes/evangelism.ts"), "utf8");
    expect(src).toContain("decisionType: body.decisionType ?? body.decision");
    expect(src).toContain('contactMethod: body.contactMethod ?? (body.email ? "email" : undefined)');
    expect(src).toContain("contactValue: body.contactValue ?? body.email");
    expect(src).toContain('wantsFollowup: typeof body.wantsFollowup === "boolean" ? body.wantsFollowup : true');
  });

  it("keeps the public website on the canonical API hostname", async () => {
    const apiClient = await readFile(join(process.cwd(), "heavenly-key-website/js/api-client.js"), "utf8");
    const main = await readFile(join(process.cwd(), "heavenly-key-website/js/main.js"), "utf8");
    const wrangler = await readFile(join(process.cwd(), "wrangler.toml"), "utf8");

    expect(apiClient).toContain('const API_BASE = "https://heavenlykey.alldaywow247.workers.dev"');
    expect(main).toContain('const API_BASE = "https://heavenlykey.alldaywow247.workers.dev"');
    if (!/^routes\s*=\s*\[\]/m.test(wrangler)) {
      expect(wrangler).toContain('pattern = "api.heavenlykey.org"');
      expect(wrangler).toContain("custom_domain = true");
    }
    expect(wrangler).toContain("workers_dev = true");
  });
});
