import {describe,it,expect} from "vitest";
import {moderateText} from "../../global-community/src/moderation";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

describe("Global Christian Community foundation",()=>{
  it("uses the approved relationship and Space terminology",async()=>{
    const root=process.cwd();
    const [app,index,spaces,profile]=await Promise.all([
      readFile(join(root,"global-community/public/app.js"),"utf8"),
      readFile(join(root,"global-community/public/index.html"),"utf8"),
      readFile(join(root,"global-community/public/spaces.html"),"utf8"),
      readFile(join(root,"global-community/public/profile.html"),"utf8"),
    ]);
    expect(app).toContain("GLOBAL CONNECT");
    expect(app).toContain("Global Connections");
    expect(app).toContain("CREATE GLOBAL SPACE");
    expect(spaces).toContain("SPACES");
    expect(profile).toContain("Global Connections");
    expect(index).toContain("Connecting Believers • Building Faith • Growing in Christ");
    expect(app).not.toContain("Followers");
    expect(app).not.toContain("Create Page");
  });

  it("blocks severe prohibited text and holds religious debate for context review",()=>{
    expect(moderateText("Send me money to unlock your miracle blessing","message").decision).toBe("block");
    expect(moderateText("I will kill you tonight","message").decision).toBe("block");
    expect(moderateText("Join Islam and worship Allah instead","post")).toMatchObject({decision:"hold",category:"non_christian_religious_promotion_or_debate"});
  });

  it("allows legitimate Christian testimony or mission references to another religion",()=>{
    expect(moderateText("My testimony: I was a former Muslim and came to Christ.","post").decision).not.toBe("block");
    expect(moderateText("Pray for the salvation of Muslims and for missionaries serving them.","post").decision).not.toBe("block");
  });

  it("keeps community media quarantined until safety approval",async()=>{
    const sql=await readFile(join(process.cwd(),"global-community/migrations/0002_participation_safety.sql"),"utf8");
    const services=await readFile(join(process.cwd(),"global-community/src/services.ts"),"utf8");
    expect(sql).toContain("safety_status TEXT NOT NULL DEFAULT 'pending_review'");
    const {publicMedia}=await import("../../global-community/src/services");
    expect(await publicMedia({} as any,1)).toBeNull();
    expect(services).toContain("Community file uploads are disabled. Use a Design Card or a video link.");
  });

  it("provides focused purpose pages instead of one noisy mega-page",async()=>{
    const pages=["index.html","prayer.html","fellowship.html","groups.html","grow.html","missions.html","messages.html","profile.html","spaces.html","salvation.html","account.html"];
    for(const page of pages){
      const html=await readFile(join(process.cwd(),"global-community/public",page),"utf8");
      expect(html).toContain('id="page-root"');
      expect(html).toContain('id="back-button"');
      expect(html).toContain("Social Home");
    }
  });

  it("disables new media uploads even when called directly",async()=>{
    const {registerMedia,uploadMedia}=await import("../../global-community/src/services");
    await expect(registerMedia({} as any,1,{mimeType:"image/jpeg",sizeBytes:100})).rejects.toThrow("file uploads are disabled");
    await expect(uploadMedia({} as any,1,1,{} as any)).rejects.toThrow("file uploads are disabled");
  });

});
