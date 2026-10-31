import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../source");
const fail = [];
const read = (path) => readFile(resolve(root, path), "utf8");
const [html, headers, worker, wrangler, player, css] = await Promise.all([
  read("index.html"), read("_headers"), read("_worker.js"), read("wrangler.toml"),
  read("js/approved-widget-system.js"), read("css/radio-approved-number-one.css")
]);
const requireText = (condition, message) => { if (!condition) fail.push(message); };

for (const h of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy", "Content-Security-Policy"]) requireText(headers.includes(h), "Missing response header: " + h);
for (const d of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) requireText(headers.includes(d), "CSP missing " + d);
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
for (const script of inlineScripts) {
  const hash = "sha256-" + createHash("sha256").update(script).digest("base64");
  requireText(headers.includes(hash), "CSP hash does not match an inline script: " + hash);
}
requireText(html.includes('src="/js/approved-widget-system.js"') || html.includes('src="/js/approved-widget-system.js"'), "Radio player script reference missing.");
requireText(worker.includes("media-engine-public-v1"), "Account 2 public API marker missing.");
requireText(worker.includes("MEDIA_PUBLIC_ORIGIN"), "Account 2 origin validation missing.");
requireText(worker.includes("redirect: \"manual\""), "Upstream redirects must be rejected.");
requireText(worker.includes("AbortSignal.timeout"), "Upstream request timeout missing.");
requireText(worker.includes("access-control-allow-origin"), "CORS response-header stripping missing.");
requireText(wrangler.includes('name = "heavenlykeyradio"'), "Wrong Cloudflare Worker name.");
requireText(wrangler.includes('run_worker_first = ["/api/*"]'), "API Worker-first route configuration missing.");
requireText(!/MEDIA_ENGINE_SHARED_SECRET|LIVEKIT_API_SECRET|Authorization:\s*Bearer/.test(worker + wrangler), "A backend secret or bearer credential must never be committed to Account 7.");
requireText(player.includes("/api/broadcast/programme?channel=radio"), "Player does not call the Account 7 same-origin programme endpoint.");
requireText(css.includes("prefers-reduced-motion"), "Reduced-motion support missing.");

for (const asset of [
  "assets/ministry/approved-radio-transparent-original.png",
  "assets/ministry/approved-radio-display-20261017.webp"
]) {
  try { await access(resolve(root, asset)); } catch { fail.push("Missing approved artwork: " + asset); }
}
if (fail.length) {
  console.error("ACCOUNT 7 PREFLIGHT FAILED");
  for (const item of fail) console.error("- " + item);
  process.exitCode = 1;
} else {
  console.log("ACCOUNT 7 PREFLIGHT PASSED — static assets, CSP script hashes, proxy safeguards and Worker configuration are present.");
  console.log("This check does not verify Cloudflare configuration, live audio, device playback or production availability.");
}
