import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const get=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const pages=["about","community","contact","events","grdpc","i-said-yes","legal-requests","ministries","missions","partner","privacy","radio","resources","terms","video"];
test("existing public homepage design is retained and new visual editor runs",()=>{
 const html=get("heavenly-key-website/index.html");
 for(const s of ["class=\"slider\"","class=\"president\"","class=\"ticker\"","class=\"navwrap\"","js/home-slider.js","js/site-cms.js","js/homepage-layout.js","data-cms-section=\"hero\"","data-cms-section=\"media\"","data-cms-section=\"bottom\""])
  assert.ok(html.includes(s),"Missing preserved homepage structure: "+s);
 assert.ok(!html.includes("<script>(function(){var slides"),"Legacy slider should not run twice");
});
test("all public pages are connected to the content editor",()=>{
 for(const name of pages){
  const html=get("heavenly-key-website/pages/"+name+".html");
  assert.ok(html.includes("js/site-cms.js"),name+" missing visual content runtime");
  assert.equal((html.match(/js\/site-cms\.js/g)||[]).length,1,name+" has duplicate editor");
 }
});
test("normal admin contains user-friendly homepage, image library and slide controls",()=>{
 const html=get("heavenly-key-website/pages/admin.html");
 const nav=get("heavenly-key-website/js/admin-dashboard.js");
 const sliders=get("heavenly-key-website/js/homepage-cms-admin.js");
 for(const k of ["homepage-cms-editor","cms-slider-manager","index.html?cms=1","index.html?cms=preview","homepage-cms-admin.js"])
  assert.ok(html.includes(k),k);
 assert.ok(nav.includes("'website','Website Builder'"),"Builder must be reachable from normal dashboard sidebar");
 assert.ok(nav.includes("move('#site-page-editor','website')"),"Other pages must be editable from Website Builder");
 for(const k of ["Save Draft","Publish Slider","Discard Draft","Version History","dragstart","Upload picture and add slide","/api/admin/cms/assets"])
  assert.ok(sliders.includes(k),"Missing slider feature "+k);
});
test("safe page content editor handles previews, uploads, draft and publish",()=>{
 const code=get("heavenly-key-website/js/site-cms.js");
 for(const k of ['"/api/admin/cms/page"','"/api/site-content/cms"','/api/admin/cms/assets','save-draft','"publish"','"restore"','"discard"','mode==="preview"'])
  assert.ok(code.includes(k),"Missing editor feature "+k);
 assert.ok(code.includes('span.textContent = item.node.nodeValue'),"Page editing should be text-only, not HTML");
 assert.ok(code.includes('cms-restore-image'),"Hidden pictures must be recoverable from the editor");
 assert.ok(code.includes('item.restoreButton.hidden'),"Reinserted pictures should restore direct editing");
});
test("homepage section builder supports section order, backgrounds and publication",()=>{
 const html=get("heavenly-key-website/pages/admin.html");
 const frontend=get("heavenly-key-website/js/homepage-layout-admin.js");
 const runtime=get("heavenly-key-website/js/homepage-layout.js");
 const backend=get("src/routes/site-cms.ts");
 assert.ok(html.includes("cms-section-manager")&&html.includes("homepage-layout-admin.js"));
 for(const item of ["Save Layout Draft","Publish Layout","Restore Layout","cms/assets","dragstart"])assert.ok(frontend.includes(item),"Missing section control: "+item);
 assert.ok(runtime.includes("insertBefore(el,before)"));
 assert.ok(runtime.includes("cms=preview")||runtime.includes('mode==="preview"'));
 assert.ok(backend.includes("handleCmsLayout")&&backend.includes("validSections"));
 assert.ok(get("migrations/0039_visual_cms.sql").includes("site_cms_layout_revisions"));
 assert.ok(get("heavenly-key-website/js/site-cms.js").includes('section-id:'),"Editor fields must stay stable when sections are reordered");
});
test("backend guards admin CMS routes with existing website administrator login",()=>{
 const handlers=get("src/routes/site-cms.ts");
 const routes=get("src/index.ts");
 for(const k of ["requireMinimumRole(req,env,\"Administrator\")","originOK(req)","validFields","validSlides","site_cms_revisions","site_cms_slider_revisions","sniff(data)","MEDIA_R2"])
  assert.ok(handlers.includes(k),"Missing backend security/persistence "+k);
 assert.ok(handlers.includes('The public slider needs at least one enabled picture'),"Prevent accidentally publishing an empty homepage slider");
 for(const k of ["/api/admin/cms/page","/api/admin/cms/slider","/api/admin/cms/assets","/api/site-content/slider"])
  assert.ok(routes.includes(k),"Missing route "+k);
 assert.ok(routes.includes("handleCmsImage(request"),"Image asset serving route must be wired");
 assert.ok(get("migrations/0039_visual_cms.sql").includes("site_cms_assets"));
});
test("homepage buttons and menu destinations are visually editable with safe links",()=>{
 const code=get("heavenly-key-website/js/site-cms.js");
 for(const term of ["Edit Menus & Links","openLinkPanel","descriptors.links","safeLink(destination)","item.link.setAttribute(\"href\",saved.value)"])
  assert.ok(code.includes(term),"Missing link editing requirement: "+term);
 assert.ok(code.includes("new URL(value).protocol===\"https:\""),"External destinations must be HTTPS");
 assert.ok(code.includes('!value.startsWith("//")'),"Protocol-relative destinations must be rejected");
});
test("website editor JavaScript syntax is valid",()=>{
 for(const file of ["heavenly-key-website/js/site-cms.js","heavenly-key-website/js/home-slider.js","heavenly-key-website/js/homepage-cms-admin.js","heavenly-key-website/js/homepage-layout.js","heavenly-key-website/js/homepage-layout-admin.js"]){
  assert.doesNotThrow(()=>new vm.Script(get(file),{filename:file}),file);
 }
});
