import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

describe("AllDayWow homepage and community content recovery",()=>{
  it("keeps the spiritual warning five-column section immediately above the footer",async()=>{
    const html=await readFile(join(process.cwd(),"heavenly-key-website/index.html"),"utf8");
    const section=html.indexOf('id="spiritual-caution"');
    const verse=html.indexOf('class="verse"');
    const footer=html.indexOf('<footer>');
    expect(section).toBeGreaterThan(verse);
    expect(footer).toBeGreaterThan(section);
    expect((html.match(/id="spiritual-caution"/g)||[])).toHaveLength(1);
    const warning=html.slice(section,footer);
    expect((warning.match(/<article>/g)||[])).toHaveLength(5);
    for(const phrase of ["SPIRITUAL CAUTION","CHURCH MEMBERSHIP IS NOT SALVATION","END-TIME HAS COME","PRAY HARD","FEAR GOD"]){
      expect(warning).toContain(phrase);
    }
  });
  it("keeps fixed radio and right-side assistant while preserving the new Community AI entrypoints",async()=>{
    const root=process.cwd();
    const [footer,radio,care,app,assistant]=await Promise.all([
      readFile(join(root,"heavenly-key-website/js/site-footer.js"),"utf8"),
      readFile(join(root,"heavenly-key-website/js/floating-radio.js"),"utf8"),
      readFile(join(root,"heavenly-key-website/js/ministry-care.css"),"utf8"),
      readFile(join(root,"global-community/public/app.js"),"utf8"),
      readFile(join(root,"global-community/src/heavenly-key-ai.ts"),"utf8")
    ]);
    expect(footer).toContain("/js/floating-radio.js");
    expect(footer).toContain("/js/ministry-care.js");
    expect(radio).toContain("position:fixed;left:10px");
    expect(care).toContain("position:fixed;top:auto;left:auto;right:14px;bottom:");
    expect(care).not.toContain("top:42%");
    expect(app).toContain("openHeavenlyKeyAi");
    expect(app).toContain("hk-ai-composer");
    expect(app).toContain("hk-ai-search-suggestion");
    expect(assistant).toContain("communityAiDraft");
  });
});
