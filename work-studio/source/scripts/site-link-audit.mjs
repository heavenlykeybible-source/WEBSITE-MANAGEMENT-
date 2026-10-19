import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const site = join(root, "heavenly-key-website");
const failures = [];
const htmlCache = new Map();

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file));
    else out.push(file);
  }
  return out;
}

function cleanUrl(value) {
  return value.replace(/&amp;/g, "&").trim();
}

function localTarget(fromFile, raw) {
  const value = cleanUrl(raw);
  if (!value || /^(mailto:|tel:|javascript:|data:)/i.test(value)) return null;
  if (value.startsWith("#")) return { file: fromFile, fragment: value.slice(1), raw:value };
  if (/^https?:\/\//i.test(value)) {
    const u = new URL(value);
    if (!["www.heavenlykey.org","heavenlykey.org"].includes(u.hostname)) return null;
    const pathname = u.pathname === "/" ? "/index.html" : u.pathname;
    return { file: join(site, pathname.replace(/^\/+/, "")), fragment: u.hash.slice(1), raw:value };
  }
  if (value.startsWith("/")) {
    const rootPieces = value.split("#",2);
    return { file: join(site, rootPieces[0].replace(/^\/+/, "") || "index.html"), fragment: rootPieces[1] || "", raw:value };
  }
  const pieces = value.split("#",2);
  const beforeHash = pieces[0];
  const fragment = pieces[1] || "";
  const beforeQuery = decodeURIComponent(beforeHash.split("?",1)[0]);
  const file = resolve(dirname(fromFile), beforeQuery || "");
  return { file, fragment, raw:value };
}

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

async function htmlText(path) {
  if (!htmlCache.has(path)) htmlCache.set(path, await readFile(path, "utf8"));
  return htmlCache.get(path);
}

const files = await walk(site);
const htmlFiles = files.filter(f => f.endsWith(".html"));

for (const file of htmlFiles) {
  const text = await htmlText(file);
  const refs = [
    ...[...text.matchAll(/\bhref="([^"]+)"/g)].map(m => ({kind:"href",value:m[1]})),
    ...[...text.matchAll(/\bsrc="([^"]+)"/g)].map(m => ({kind:"src",value:m[1]}))
  ];

  for (const ref of refs) {
    const target = localTarget(file, ref.value);
    if (!target) continue;
    if (target.file === file && !ref.value.includes("#") && ref.kind === "href") continue;

    let candidate = target.file;
    if (candidate.endsWith(sep)) candidate = join(candidate, "index.html");
    if (!await exists(candidate)) {
      failures.push(relative(site,file)+': missing '+ref.kind+' target "'+ref.value+'" -> '+relative(site,candidate));
      continue;
    }

    if (target.fragment && candidate.endsWith(".html")) {
      const targetText = await htmlText(candidate);
      const escaped = target.fragment.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
      const idRe = new RegExp("\\bid=[\\\"']"+escaped+"[\\\"']");
      if (!idRe.test(targetText)) {
        failures.push(relative(site,file)+': missing anchor #'+target.fragment+' in '+relative(site,candidate));
      }
    }
  }
}

const allHtml = (await Promise.all(htmlFiles.map(htmlText))).join("\n");
const banned = [
  ["legacy Facebook URL","https://web.facebook.com/heavenlykey"],
  ["legacy TikTok handle","https://www.tiktok.com/@heavenlykey"]
];
for (const [label,value] of banned) if (allHtml.includes(value)) failures.push(label+" remains in website HTML: "+value);

const requiredHome = await htmlText(join(site,"index.html"));
const requiredGrdpc = await htmlText(join(site,"pages","grdpc.html"));
for (const [label,value] of [
  ["YouTube","https://www.youtube.com/@heavenlykeyministry/live"],
  ["Facebook","https://www.facebook.com/heavenlykey"],
  ["TikTok","https://www.tiktok.com/@adiohwoemmanuel"]
]) {
  if (!requiredHome.includes(value)) failures.push("Homepage GRDPC block is missing official "+label+" live link.");
  if (!requiredGrdpc.includes(value)) failures.push("GRDPC page is missing official "+label+" live link.");
}
if (!requiredHome.includes('href="pages/grdpc.html#reminders"')) failures.push("Homepage is missing the GRDPC reminder-subscription link.");
if (!requiredHome.includes('href="pages/grdpc.html"')) failures.push("Homepage is missing the GRDPC know-more link.");
if (!requiredGrdpc.includes('id="reminders"')) failures.push("GRDPC page is missing the reminders anchor.");

if (failures.length) {
  console.error("SITE LINK AUDIT FAILED");
  for (const failure of failures) console.error("- "+failure);
  process.exit(1);
}
console.log("SITE LINK AUDIT PASSED — checked "+htmlFiles.length+" HTML pages, local links/assets/anchors, and official GRDPC social links.");
