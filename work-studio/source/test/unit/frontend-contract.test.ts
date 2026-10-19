import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

describe("frontend contract", () => {
  it("keeps the approved Heavenly Key homepage ministry gateways and four-slide portrait experience", async () => {
    const root = process.cwd();
    const [home, admin] = await Promise.all([
      readFile(join(root, "heavenly-key-website/index.html"), "utf8"),
      readFile(join(root, "heavenly-key-website/pages/admin.html"), "utf8"),
    ]);

    expect(home).toContain("Faith of Our Fathers TV");
    expect(home).toContain("Watch Now");
    expect(home).toContain("Online Revival Radio");
    expect(home).toContain("Listen Live");
    expect(home).toContain("Global Christian Community");
    expect(home).toContain("Join the Community");
    expect(home).toContain("GRDPC");
    expect(home).toContain("Global Revival &amp; Destiny Prayer Cry");
    expect(home).toContain("A PEOPLE");
    expect(home).toContain("PREPARED");
    expect(home).toContain("FOR HIS COMING");
    expect(home).toContain("REVIVAL FOR OUR GENERATION");
    expect(home).toContain("Welcome to");
    expect((home.match(/class=\"slide(?: active)?\"/g) || []).length).toBe(4);
    expect((home.match(/class=\"dot(?: on)?\"/g) || []).length).toBe(4);
    expect(home).not.toContain("Pause animation");

    expect(admin).toContain("Watch Faith Of Our Fathers TV Webcast");
    expect(admin).toContain("ONLINE REVIVAL RADIO");
  });

  it("keeps the public community experience focused on fellowship, prayer, testimonies and groups", async () => {
    const community = await readFile(
      join(process.cwd(), "heavenly-key-website/pages/community.html"),
      "utf8",
    );

    expect(community).toContain("Global Christian Community");
    expect(community).toContain('data-feed="discussion"');
    expect(community).toContain('data-feed="prayer"');
    expect(community).toContain('data-feed="testimony"');
    expect(community).toContain('data-feed="groups"');
    expect(community).toContain("Open Community Feed");
    expect(community).toContain("Prayer Centre");
    expect(community).not.toContain("Watch Faith Of Our Fathers TV Webcast");
    expect(community).not.toContain("Listen to ONLINE REVIVAL RADIO");
    expect(community).not.toContain("Global Revival &amp; Destiny Prayer Cry");
    expect(community).toContain('href="admin.html?view=community"');
  });
});
