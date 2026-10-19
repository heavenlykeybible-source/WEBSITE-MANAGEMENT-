import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

const path=(name:string)=>join(process.cwd(),"heavenly-key-website",name);

describe("Homepage tidy-up without breaking core components",()=>{
  it("has one slideshow controller rather than two competing timers",async()=>{
    const [html,footer,slider]=await Promise.all([
      readFile(path("index.html"),"utf8"),
      readFile(path("js/site-footer.js"),"utf8"),
      readFile(path("js/home-slider.js"),"utf8")
    ]);
    expect((html.match(/<script src="js\/home-slider\.js"/g)||[])).toHaveLength(1);
    expect(footer).not.toContain("initHomeSlider");
    expect(footer).not.toContain("timer=setInterval(function(){show");
    expect(slider).toContain('function pick(i)');
    expect(slider).toContain('function start()');
    expect(slider).toContain('"/api/site-content/slider"');
  });

  it("keeps LIVE as a working link after the shared navigation enhances it",async()=>{
    const [html,footer]=await Promise.all([
      readFile(path("index.html"),"utf8"),
      readFile(path("js/site-footer.js"),"utf8")
    ]);
    expect(html).toContain('class="live" href="pages/video.html"');
    expect(footer).toContain("live.classList.add('live-indicator')");
    expect(footer).not.toContain("live.replaceWith(indicator)");
    expect(footer).toContain("Watch live ministry broadcast");
  });

  it("renders 10 ministry nation flags without contacting an external image host",async()=>{
    const [html,footer]=await Promise.all([
      readFile(path("index.html"),"utf8"),
      readFile(path("js/site-footer.js"),"utf8")
    ]);
    const row=html.match(/<div class="flagrow" aria-label="Nations">([\s\S]*?)<\/div>/);
    expect(row).not.toBeNull();
    expect((row?.[1].match(/class="hk-flag"/g)||[])).toHaveLength(10);
    expect(row?.[1]).toContain("🇳🇬");
    expect(row?.[1]).toContain("🇩🇪");
    expect(row?.[1]).toContain("🇫🇷");
    expect(html).not.toContain("flagcdn.com");
    expect(footer).toContain("!flagrow.querySelector('.hk-flag')");
  });

  it("preserves exactly one pre-footer five-column spiritual caution and ministry script",async()=>{
    const html=await readFile(path("index.html"),"utf8");
    const from=html.indexOf('id="spiritual-caution"');
    const to=html.indexOf("<footer>");
    expect(from).toBeGreaterThan(html.indexOf('class="verse"'));
    expect(to).toBeGreaterThan(from);
    expect((html.slice(from,to).match(/<article>/g)||[])).toHaveLength(5);
    expect((html.match(/<footer>/g)||[])).toHaveLength(1);
    expect(html).toContain('src="js/site-footer.js"');
    expect(html).toContain('src="js/site-cms.js"');
  });
});
