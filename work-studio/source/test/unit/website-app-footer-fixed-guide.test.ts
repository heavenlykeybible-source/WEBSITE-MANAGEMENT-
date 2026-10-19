import {describe,it,expect} from "vitest";
import {readFile} from "node:fs/promises";
import {join} from "node:path";

const website=(file:string)=>readFile(join(process.cwd(),"heavenly-key-website",file),"utf8");

describe("Heavenly Key App footer and right-side guide",()=>{
  it("uses Heavenly Key App as the heading and Discipleship and Global Community as its smaller description",async()=>{
    const [js,css]=await Promise.all([website("js/site-footer.js"),website("css/heavenly-key-footer-app.css")]);
    expect(js).toContain('<h3 id="hkem-footer-app-title">HEAVENLY KEY APP</h3>');
    expect(js).toContain('<p class="hkem-app-subtitle">Discipleship and Global Community</p>');
    expect(js).not.toContain('<section><img src="/assets/ministry/logo.png"');
    expect(css).toContain(".hkem-app-subtitle{");
    expect(css).toContain("font-size:12px");
    expect(css).toContain("#hkem-footer-app-title");
    expect(js).toContain('<h3 style="color:#ffd500">About Us</h3>');
  });

  it("offers direct live App 5 feature links, two mobile install methods and a separate Community login",async()=>{
    const js=await website("js/site-footer.js");
    const app="https://heavenly-key-app.heavenlykeyapp.workers.dev/";
    const account="https://heavenly-key-global-community.heavenlykeyglobal-cd095c09.workers.dev/account.html";
    expect(js).toContain('class="hkem-app-preview"');
    expect(js).not.toContain('<iframe title="Heavenly Key live web-app preview"');
    for(const section of ['home','bible','community','live'])expect(js).toContain('href="'+app+'#'+section+'"');
    expect((js.match(/hkem-app-platform-icon/g)||[])).toHaveLength(2);
    expect(js).toContain("Android");
    expect(js).toContain("iPhone / iPad");
    expect(js).toContain(account);
    expect(js).toContain("not a Google Play or App Store download");
    expect(js).toContain("sign-in inside the app is still being integrated");
    expect(js).toContain("heavenly-key-footer-app.css?v=20261010");
  });

  it("keeps iframe and clickjacking defenses strict when the preview is link-based",async()=>{
    const headers=await website("_headers");
    expect(headers).toContain("frame-src https://www.youtube-nocookie.com;");
    expect(headers).not.toContain("frame-src https://www.youtube-nocookie.com https://heavenly-key-app.heavenlykeyapp.workers.dev;");
    expect(headers).toContain("X-Frame-Options: DENY");
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).not.toContain("frame-src https:;");
  });

  it("anchors the guide to the bottom-right independently from the left-side radio",async()=>{
    const [css,js,radio]=await Promise.all([
      website("js/ministry-care.css"),website("js/ministry-care.js"),website("js/floating-radio.js")
    ]);
    expect(css).toContain("position:fixed;top:auto;left:auto;right:14px;bottom:calc(var(--hkc-bottom)");
    expect(css).not.toContain("top:42%");
    expect(js).toContain("site==='community'?(window.innerWidth<=720?'84px':'20px'):'16px'");
    expect(js).not.toContain("height+18");
    expect(js).not.toContain("MutationObserver(reposition)");
    expect(radio).toContain("position:fixed;left:10px;right:auto;bottom:");
  });
});
