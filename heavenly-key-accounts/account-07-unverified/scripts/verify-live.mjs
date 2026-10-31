const supplied = process.argv[2] || process.env.RADIO_PUBLIC_ORIGIN || "https://radio.heavenlykey.org";
const origin = new URL(supplied);
if (origin.protocol !== "https:" || origin.username || origin.password) throw new Error("A valid HTTPS radio origin is required.");
const requiredHeaders = ["strict-transport-security", "x-content-type-options", "content-security-policy", "referrer-policy"];
async function request(path, options = {}) {
  const response = await fetch(new URL(path, origin), { ...options, redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(path + " returned HTTP " + response.status);
  return response;
}
const page = await request("/");
const html = await page.text();
for (const name of requiredHeaders) if (!page.headers.has(name)) throw new Error("Missing live security header: " + name);
const csp = page.headers.get("content-security-policy") || "";
for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) if (!csp.includes(directive)) throw new Error("Live CSP missing " + directive);
if (!html.includes("HEAVENLY KEY RADIO")) throw new Error("Radio homepage content was not found.");
for (const path of ["/js/approved-widget-system.js", "/css/radio-approved-number-one.css", "/assets/ministry/approved-radio-transparent-original.png", "/assets/ministry/approved-radio-display-20261017.webp"]) await request(path);
const programmeResponse = await request("/api/broadcast/programme?channel=radio", { headers: { Accept: "application/json" } });
const programme = await programmeResponse.json();
if (!["live", "scheduled", "playlist", "offline", "reconnecting"].includes(programme.mode) || !Array.isArray(programme.items)) throw new Error("Account 2 returned an invalid radio programme response.");
if (programme.transport === "livekit") {
  const tokenResponse = await request("/api/media-engine/livekit/viewer-token", { method: "POST" });
  const token = await tokenResponse.json();
  if (!token.token || !token.url || !Number.isFinite(token.expiresAt)) throw new Error("LiveKit viewer token response is invalid.");
  throw new Error("LiveKit token is available, but browser LiveKit playback is not implemented/verified in this listener. Not launch-ready.");
}
if (!programme.items.length) throw new Error("No playable radio programme is published. Audio playback cannot be verified.");
const item = programme.items[0];
const mediaUrl = new URL(item.url, origin);
if (mediaUrl.protocol !== "https:" || mediaUrl.username || mediaUrl.password || mediaUrl.origin !== origin.origin) throw new Error("Radio playlist media must use the same-origin HTTPS proxy.");
const media = await request(mediaUrl.href, { headers: { Range: "bytes=0-0" } });
if (!/^audio\//i.test(media.headers.get("content-type") || "")) throw new Error("First radio playlist item is not audio media.");
if (media.status !== 206) throw new Error("Byte-range playback is not working (expected HTTP 206).");
if (!media.headers.has("content-range")) throw new Error("Audio response is missing Content-Range.");
await media.body?.cancel();
console.log("LIVE RADIO CHECK PASSED: page, assets, security headers, Account 2 programme and audio byte-range response verified.");
console.log("Separate real-device, background playback, Bluetooth and browser compatibility testing is still required.");
