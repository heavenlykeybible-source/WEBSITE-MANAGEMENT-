import { readFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../source");
const failures = [];
const read = (path) => readFile(resolve(root, path), "utf8");
const [html, headers, worker, wrangler, player, css] = await Promise.all([
  read("index.html"), read("_headers"), read("_worker.js"), read("wrangler.toml"),
  read("js/approved-widget-system.js"), read("css/radio-approved-number-one.css")
]);
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const header of ["Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy", "Content-Security-Policy"]) {
  check(headers.includes(header), "Missing response header: " + header);
}
for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'", "upgrade-insecure-requests"]) {
  check(headers.includes(directive), "CSP missing " + directive);
}
const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
for (const script of inlineScripts) {
  const hash = "sha256-" + createHash("sha256").update(script).digest("base64");
  check(headers.includes(hash), "CSP hash does not match inline script: " + hash);
}
check(html.includes('src="/js/approved-widget-system.js"'), "Radio player script reference missing.");
check(worker.includes("media-engine-public-v1"), "Account 2 public API marker missing.");
check(worker.includes("MEDIA_PUBLIC_ORIGIN"), "Account 2 origin validation missing.");
check(worker.includes('redirect: "manual"'), "Upstream redirects must be rejected.");
check(worker.includes("AbortSignal.timeout"), "Upstream request timeout missing.");
check(worker.includes("access-control-allow-origin"), "CORS response-header stripping missing.");
check(wrangler.includes('name = "heavenlykeyradio"'), "Wrong Cloudflare Worker name.");
check(wrangler.includes('run_worker_first = ["/api/*"]'), "API Worker-first route configuration missing.");
check(!/MEDIA_ENGINE_SHARED_SECRET|LIVEKIT_API_SECRET|Authorization:\s*Bearer/.test(worker + wrangler), "Backend credentials must never be committed to Account 7.");
check(player.includes("/api/broadcast/programme?channel=radio"), "Player does not call the same-origin programme endpoint.");
check(css.includes("prefers-reduced-motion"), "Reduced-motion support missing.");

for (const asset of ["assets/ministry/approved-radio-transparent-original.png", "assets/ministry/approved-radio-display-20261017.webp"]) {
  try { await access(resolve(root, asset)); } catch { failures.push("Missing approved artwork: " + asset); }
}
if (failures.length) {
  console.error("ACCOUNT 7 PREFLIGHT FAILED");
  for (const failure of failures) console.error("- " + failure);
  process.exitCode = 1;
} else {
  console.log("ACCOUNT 7 PREFLIGHT PASSED — static security and source checks passed.");
  console.log("This does not verify Cloudflare configuration, live audio, device playback or production availability.");
}
